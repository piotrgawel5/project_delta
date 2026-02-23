# Data Pipeline Infrastructure

Complete documentation of how data flows through Project Delta from collection to storage, including transformation, validation, caching, and synchronization.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DATA SOURCES                                     │
├──────────────┬──────────────────┬─────────────────┬────────────────────┤
│ Health       │ Digital          │ Screen Time     │ Manual Entry       │
│ Connect      │ Wellbeing        │ Native Module   │ User Form          │
└──────┬───────┴────────┬─────────┴────────┬────────┴─────────┬──────────┘
       │                │                  │                  │
       └────────────────┼──────────────────┼──────────────────┘
                        │
                        ▼
       ┌────────────────────────────────────────┐
       │   MOBILE APP (apps/mobile/)            │
       │   ├── Data Collection & Parsing        │
       │   ├── Local Validation & Calculation   │
       │   ├── Async Storage Cache              │
       │   └── Zustand State Management         │
       └────────────┬───────────────────────────┘
                    │
       ┌────────────▼───────────────────────────┐
       │   OFFLINE-FIRST LAYER                  │
       │   ├── Async Storage (SQLite)           │
       │   ├── Pending Sync Queue               │
       │   └── Cache Invalidation Strategy      │
       └────────────┬───────────────────────────┘
                    │
       ┌────────────▼───────────────────────────┐
       │   DATA TRANSMISSION                    │
       │   ├── REST API (JSON)                  │
       │   ├── Batch Sync Endpoint              │
       │   └── Zod Validation Schemas           │
       └────────────┬───────────────────────────┘
                    │
       ┌────────────▼───────────────────────────┐
       │   BACKEND API (services/api/)          │
       │   ├── Auth & Permission Checks         │
       │   ├── Schema Validation                │
       │   ├── Data Transformation              │
       │   └── Business Logic                   │
       └────────────┬───────────────────────────┘
                    │
       ┌────────────▼───────────────────────────┐
       │   DATABASE (services/supabase/)        │
       │   ├── PostgreSQL Storage               │
       │   ├── Real-time Subscriptions          │
       │   └── Audit Trail / Edit History       │
       └────────────────────────────────────────┘
```

---

## 1. Data Sources & Collection

### 1.1 Health Connect (Primary Source - Android)

**File:** `apps/mobile/modules/health-connect/`

**What:** Native Android module that reads sleep sessions from device OS

**Data Format:**

```typescript
SleepSession {
  startTime: Date;       // ISO string
  endTime: Date;         // ISO string
  durationMinutes: number;
  deepSleepMinutes?: number;
  remSleepMinutes?: number;
  lightSleepMinutes?: number;
  awakeSleepMinutes?: number;
}
```

**Confidence:** High  
**Stage Data:** Complete (deep, REM, light, awake)  
**Frequency:** Pulled on app resume or manual refresh

**Code Path:**

```
health-connect/index.ts
├── isAvailable() → Check if HC available
├── requestPermissions() → Prompt user
├── getSleepSessions(startDate, endDate) → Fetch data
└── calculateQualityScore(session) → Local quality calc
```

### 1.2 Digital Wellbeing (Secondary Source - Android)

**File:** `apps/mobile/components/sleep/DigitalWellbeingCard.tsx`

**What:** System-level screen time data (unlock/lock patterns)

**Data Format:**

```typescript
ScreenTimeSummary {
  total_minutes: number;
  last_unlock_before_bedtime: string | null;  // ISO
  first_unlock_after_wakeup: string | null;   // ISO
  provenance: "usage_stats" | "digital_wellbeing" | "estimated";
}
```

**Confidence:** Medium  
**Stage Data:** None (estimated from duration)  
**Frequency:** Pulled from device settings

### 1.3 Manual Entry (User Input)

**File:** `apps/mobile/components/sleep/AddSleepRecordModal.tsx`

**What:** User enters bedtime and wake-up time via circular time picker

**Data Format:**

```typescript
ManualSleepInput {
  startTime: Date;  // User-selected bedtime
  endTime: Date;    // User-selected wake-up time
}
```

**Confidence:** Low  
**Stage Data:** Estimated (see sleep stages estimation)  
**Frequency:** On-demand user entry

**UI Flow:**

1. User opens "Add Sleep Record" modal
2. Circular knob picker for start time (can be previous day)
3. Circular knob picker for end time (reference day)
4. Auto-calculates duration in 10-min steps
5. Calls `forceSaveManualSleep(startTime, endTime)`

### 1.4 Wearable Devices (Future/Optional)

**Data Format:**

```typescript
WearableData {
  source: "wearable";
  confidence: "high";
  deepSleepMinutes: number;
  remSleepMinutes: number;
  lightSleepMinutes: number;
  awakeSleepMinutes: number;
}
```

**Confidence:** High  
**Stage Data:** Complete

---

## 2. Mobile App Data Processing Layer

### 2.1 Sleep Store (State Management)

**File:** `apps/mobile/store/sleepStore.ts`

**What:** Zustand store managing all sleep state, sync logic, and API calls

**State Shape:**

```typescript
interface SleepState {
  isAvailable: boolean; // HC available?
  isConnected: boolean; // HC permission granted?
  checkingStatus: boolean; // Loading state
  lastNightSleep: SleepSession | null;
  weeklyHistory: SleepData[]; // Last 7-30 days
  monthlyData: Record<string, SleepData[]>; // By YYYY-MM
  loading: boolean;
  lastSyncTime: number; // Timestamp

  // Methods
  checkHealthConnectStatus();
  fetchSleepData(userId);
  syncToSupabase(userId, session, profile);
  forceSaveManualSleep(userId, startTime, endTime);
  syncPendingRecords(userId);
  loadCachedData();
}
```

**Core Functions:**

#### `fetchSleepData(userId: string)`

1. Check cache cooldown (300s)
2. Get sleep from Health Connect
3. Transform to SleepData
4. Calculate quality score via `calculateQualityFromDuration()`
5. Update state: `weeklyHistory` + `monthlyData`
6. Save to cache (async-storage)
7. Mark fetched in cooldown tracker

**Cooldown Logic:**

```typescript
const FETCH_COOLDOWN = 300 * 1000; // 5 minutes
if (now - lastFetch < FETCH_COOLDOWN) {
  console.log('[SleepStore] Fetch cooldown active');
  return; // Skip network call
}
```

#### `syncToSupabase(userId, session, profile)`

1. Transform `SleepSession` → `SleepData`
2. Estimate sleep stages (if HC didn't provide)
3. Calculate deterministic sleep score
4. Build score breakdown
5. Check permissions + cooldowns
6. POST to `/api/sleep/log`
7. On success: update cache + UI
8. On error: queue for retry + show toast

#### `forceSaveManualSleep(userId, startTime, endTime)` ⚠️ **BROKEN**

1. Parse dates → ISO strings
2. Calculate duration in minutes
3. Estimate sleep stages
4. Calculate quality score
5. **Call `calculateDynamicSleepScore()`** → returns complex `ScoreBreakdown`
6. Create `SleepData` object
7. **Optimistic UI update** (show immediately)
8. POST to `/api/sleep/log` with **complex breakdown** ❌ VALIDATION FAILS
9. On error: rollback via `loadCachedData()`

**BUG:** `scoreBreakdown` field is complex object, API expects simple 6-field object.

#### `syncPendingRecords(userId)`

1. Get pending records from cache
2. Filter by sync status
3. Batch them into groups of 30
4. POST to `/api/sleep/sync-batch`
5. On success: mark synced
6. On error: keep in queue for retry

---

### 2.2 Sleep Calculations (Deterministic Scoring)

**File:** `apps/mobile/lib/sleepCalculations.ts`

**What:** Stateless utility functions for sleep metrics

**Main Functions:**

#### `estimateSleepStages(durationMinutes, profile)`

**Input:**

- Duration: 480 minutes (8 hours)
- Profile: age, sex, activity level, chronotype

**Output:**

```typescript
SleepStages {
  deep: number;   // Deep sleep minutes (15-25% of total)
  rem: number;    // REM minutes (20-25% of total)
  light: number;  // Light sleep minutes (50-60% of total)
  awake: number;  // Awake time minutes (5-10% of total)
}
```

**Algorithm:**

1. Age & activity adjustment
2. Lock deep at 15-20% of duration
3. Lock REM at 20-22% of duration
4. Remainder to light sleep
5. Awake = 5-10% of total

**Used for:** Manual entries and missing HC data

#### `calculateQualityFromDuration(durationMinutes, profile)`

**Input:** Duration in minutes + user profile

**Output:** Quality score (0-100)

**Factors:**

- Deviation from sleep goal
- Age-adjusted targets
- Activity level

---

### 2.3 Sleep Analysis (Complex Scoring)

**File:** `apps/mobile/lib/sleepAnalysis.ts`

**What:** Advanced scoring with components, weights, and adjustments

**Main Function:**

#### `calculateSleepScore(input: SleepScoringInput)`

**Input:**

```typescript
SleepScoringInput {
  current: SleepRecord;           // Today's sleep
  history: SleepRecord[];         // Last 7+ days
  userProfile: UserProfile;       // Age, goals, chronotype
}
```

**Output:**

```typescript
{
  sleepScore: number;             // 0-100 (integer)
  scoreBreakdown: ScoreBreakdown;  // Complex object ❌ PROBLEM
}

ScoreBreakdown {
  score: number;                  // Final score
  confidence: "high" | "medium" | "low";
  components: {
    duration: number;
    deepSleep: number;
    remSleep: number;
    efficiency: number;
    waso: number;
    consistency: number;
    timing: number;
    screenTime: number;
  };
  weights: Record<string, number>;
  adjustments: {
    sourceReliabilityFactor: number;
    dataCompletenessFactor: number;
    chronicDebtPenalty: number;
    ageEfficiencyCorrection: number;
    chronotypeAlignmentDelta: number;
  };
  baseline: UserBaseline;
  ageNorm: AgeNorm;
  flags: string[];
  calculatedAt: string;  // ISO
}
```

**Algorithm:**

1. Get age norm from profile
2. Compute baseline from history
3. Assess data completeness
4. Calculate 8 component scores
5. Apply dynamic weights
6. Penalize chronic debt
7. Age efficiency correction
8. Source reliability dampening
9. Confidence-based shrinkage
10. Clamp final score (0-100)

**⚠️ KEY ISSUE:**

- This complex object is sent to API as `score_breakdown`
- API expects simple 6-field object: `{ duration_norm, deep_pct, rem_pct, efficiency, consistency, total }`
- Validation fails → manual sleep save error

---

### 2.4 Sleep Baseline & Norms

**File:** `apps/mobile/lib/sleepBaseline.ts`

**What:** Computes personalized baseline from historical data

**Input:** Array of past 14-30 days' sleep records

**Output:**

```typescript
UserBaseline {
  avgDuration: number;
  avgDeepPct: number;
  avgRemPct: number;
  avgEfficiency: number;
  stdDevDuration: number;
  trendDirection: "improving" | "declining" | "stable";
}
```

**File:** `apps/mobile/lib/sleepNorms.ts`

**What:** Age-adjusted sleep norms from sleep science

**Input:** User age

**Output:**

```typescript
AgeNorm {
  recommendedDuration: number;     // Minutes
  deepSleepTarget: number;         // Percentage
  remSleepTarget: number;          // Percentage
}
```

---

### 2.5 Local Cache Layer

**File:** `apps/mobile/lib/sleepCache.ts`

**What:** Offline-first caching with async-storage (SQLite on mobile)

**Storage Schema:**

```typescript
// Key: "sleep_records"
// Value: Array<CachedSleepRecord>

CachedSleepRecord {
  id: string;
  date: string;                // YYYY-MM-DD
  startTime: string;           // ISO
  endTime: string;             // ISO
  durationMinutes: number;
  deepSleepMinutes: number;
  remSleepMinutes: number;
  lightSleepMinutes: number;
  awakeSleepMinutes: number;
  source: DataSource;
  confidence: ConfidenceLevel;
  sleepScore: number;
  scoreBreakdown: SimpleScoreBreakdown;  // Simple format
  syncStatus: "pending" | "synced" | "conflict";
  lastModified: string;        // ISO
  notes?: string;
}
```

**Core Operations:**

#### `loadFromCache(userId)`

1. Read from async-storage
2. Deserialize JSON
3. Return array of records
4. Fallback to empty array

#### `upsertCacheRecord(record, markPending = true)`

1. Load existing cache
2. Find by date
3. Merge/replace
4. Set `syncStatus: pending` (if new/modified)
5. Write back to storage
6. Return updated record

#### `getPendingSyncRecords()`

1. Load cache
2. Filter by `syncStatus === "pending"`
3. Return for batch sync

#### `markRecordsSynced(dates: string[])`

1. Load cache
2. Find by dates
3. Set `syncStatus: "synced"`
4. Mark `lastSync: now`
5. Write back

#### `resetCooldowns()`

1. Clear fetch + sync timestamps
2. Allow immediate next fetch
3. Used for pull-to-refresh

---

## 3. API Transmission Layer

### 3.1 REST API Client

**File:** `apps/mobile/lib/api.ts`

**What:** Axios wrapper with auth, logging, and error handling

**Configuration:**

```typescript
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3000',
  timeout: 10000, // 10 second timeout
  headers: { 'Content-Type': 'application/json' },
});

// Interceptors:
// 1. Add JWT auth token from session
// 2. Log requests/responses
// 3. Handle 401 (refresh token)
// 4. Catch errors + console.log
```

**Request Pattern:**

```typescript
await api.post('/api/sleep/log', {
  user_id: userId,
  date: "2026-02-14",
  start_time: "2026-02-13T22:00:00Z",
  end_time: "2026-02-14T06:00:00Z",
  duration_minutes: 480,
  quality_score: 85,
  deep_sleep_minutes: 90,
  rem_sleep_minutes: 110,
  light_sleep_minutes: 260,
  awake_minutes: 20,
  sleep_score: 87,
  score_breakdown: {           // ❌ PROBLEM: complex object sent here
    score: 87,
    confidence: "high",
    components: {...},
    weights: {...},
    adjustments: {...},
    baseline: {...},
    ageNorm: {...},
    flags: [...],
    calculatedAt: "2026-02-14T..."
  },
  source: "manual",
  confidence: "low",
  data_source: "manual",
});
```

### 3.2 Endpoints

#### `POST /api/sleep/log` - Single Record

**Purpose:** Save one sleep record

**Middleware Stack:**

1. `requireAuth` - JWT verification
2. `requireOwnership` - user_id matches requester
3. `burstLimiter` - Rate limit (10 req/min)
4. `userWriteLimiter` - Per-user limit
5. **`validate(sleepLogSchema)`** ← **Validation happens here**
6. `asyncHandler` - Error wrapper

**Request Body Validation:**

```typescript
sleepLogSchema = z.object({
  body: z.object({
    user_id: z.string().uuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    start_time: z.string().optional(),
    end_time: z.string().optional(),
    duration_minutes: z.number().int().min(0).max(1440).optional(),
    quality_score: z.number().min(0).max(100).optional(),
    deep_sleep_minutes: z.number().int().min(0).optional(),
    rem_sleep_minutes: z.number().int().min(0).optional(),
    light_sleep_minutes: z.number().int().min(0).optional(),
    awake_minutes: z.number().int().min(0).optional(),

    sleep_score: z.number().int().min(0).max(100).optional(),
    score_breakdown: scoreBreakdownSchema.optional(), // ← Simple object

    source: dataSourceSchema.optional(),
    confidence: confidenceSchema.optional(),
    estimated_bedtime: z.string().optional(),
    estimated_wakeup: z.string().optional(),
    screen_time_summary: screenTimeSummarySchema.optional(),

    edits: z.array(sleepEditSchema).optional(),
    data_source: z.string().optional(),
    synced_at: z.string().optional(),
    heart_rate_avg: z.number().int().min(20).max(200).optional(),
    notes: z.string().max(500).optional(),
  }),
});

scoreBreakdownSchema = z.object({
  duration_norm: z.number().min(0).max(35), // ← 0-35
  deep_pct: z.number().min(0).max(20), // ← 0-20
  rem_pct: z.number().min(0).max(20), // ← 0-20
  efficiency: z.number().min(0).max(15), // ← 0-15
  consistency: z.number().min(0).max(10), // ← 0-10
  total: z.number().min(0).max(100), // ← 0-100
});
```

**⚠️ BUG LOCATION:** When `sleepStore.ts` sends complex `ScoreBreakdown`, it fails this validation.

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "user_id": "uuid",
    "date": "2026-02-14",
    "created_at": "2026-02-14T...",
    "synced_at": "2026-02-14T..."
  }
}
```

**Error Response (400):**

```json
{
  "error": "Validation failed",
  "details": [
    {
      "code": "too_big",
      "maximum": 6,
      "inclusive": true,
      "path": ["body", "score_breakdown"],
      "message": "Object must contain at most 6 properties"
    }
  ]
}
```

#### `POST /api/sleep/sync-batch` - Batch Sync

**Purpose:** Sync multiple pending records in one request

**Request Body:**

```typescript
{
  user_id: "uuid",
  records: [
    { date, start_time, duration_minutes, ... },
    { date, start_time, duration_minutes, ... },
    ...
  ]
}
```

**Validation:** Same as single, but array validation (1-30 records)

**Success Response (200):**

```json
{
  "success": true,
  "synced": 25,
  "failed": 0,
  "results": [
    { date, synced: true },
    { date, synced: true },
    ...
  ]
}
```

---

## 4. Backend Processing

### 4.1 API Entry Point

**File:** `services/api/src/index.ts`

**Server Setup:**

```typescript
import express from 'express';
const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(cookieParser());
app.use(express.json());

// Routes
app.use('/api/sleep', sleepRoutes);
app.use('/api/auth', authRoutes);

// Error handling
app.use(errorHandler);

app.listen(3000);
```

### 4.2 Route Handler

**File:** `services/api/src/modules/sleep/sleep.routes.ts`

**Route Definition:**

```typescript
router.post(
  '/log',
  requireAuth,
  requireOwnership,
  burstLimiter,
  userWriteLimiter,
  validate(sleepLogSchema),
  asyncHandler(sleepController.saveLog),
);
```

**Middleware: `validate(sleepLogSchema)`**

**File:** `services/api/src/middleware/validate.ts`

```typescript
export const validate = (schema: AnyZodObject) => (req, res, next) => {
  try {
    schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    next(); // ✅ Pass to controller
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      }); // ❌ Return 400
    }
  }
};
```

**On Validation Failure:** Returns 400 immediately, never reaches controller

---

### 4.3 Controller

**File:** `services/api/src/modules/sleep/sleep.controller.ts`

**Handler: `saveLog(req, res)`**

```typescript
async saveLog(req: Request, res: Response) {
  const { user_id } = req.body;
  const requester = (req as any).user;

  // Double-check permission (shouldn't reach here if didn't pass validate)
  if (requester.id !== user_id) {
    throw AppError.forbidden("Unauthorized");
  }

  // Call service to save
  const data = await sleepService.saveLog(req.body);

  // Log
  logger.info("Sleep log saved", {
    userId: user_id,
    date: req.body.date,
    source: req.body.source || "unknown",
  });

  res.json({ success: true, data });
}
```

---

### 4.4 Service Layer

**File:** `services/api/src/modules/sleep/sleep.service.ts`

**Method: `saveLog(payload)`**

```typescript
async saveLog(payload: unknown) {
  // payload comes from validated req.body
  // At this point, score_breakdown is expected to be simple 6-field object

  const { user_id, date, ...sleepData } = payload;

  // Insert or update
  const { data, error } = await supabase
    .from('sleep_records')
    .upsert(
      {
        user_id,
        date,
        ...sleepData,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,date',  // Conflict key
      }
    )
    .select();

  if (error) throw error;

  return data[0];
}
```

**Conflict Resolution:** Same user + date → **overwrite existing record**

---

## 5. Database Storage

### 5.1 Database Schema

**File:** `services/supabase/migrations/20260201000000_add_sleep_score_and_provenance.sql`

**Table: `sleep_records`**

```sql
CREATE TABLE sleep_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,

  -- Core timing
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  duration_minutes INT CHECK (duration_minutes >= 0 AND duration_minutes <= 1440),

  -- Sleep stages
  deep_sleep_minutes INT CHECK (deep_sleep_minutes >= 0),
  rem_sleep_minutes INT CHECK (rem_sleep_minutes >= 0),
  light_sleep_minutes INT CHECK (light_sleep_minutes >= 0),
  awake_minutes INT CHECK (awake_minutes >= 0),

  -- Scoring (NEW)
  sleep_score INT CHECK (sleep_score >= 0 AND sleep_score <= 100),
  score_breakdown JSONB,  -- Stores 6-field object
  quality_score INT CHECK (quality_score >= 0 AND quality_score <= 100),

  -- Provenance (NEW)
  source TEXT CHECK (source IN ('health_connect', 'digital_wellbeing', 'usage_stats', 'wearable', 'manual')),
  confidence TEXT CHECK (confidence IN ('high', 'medium', 'low')),
  estimated_bedtime TIMESTAMPTZ,
  estimated_wakeup TIMESTAMPTZ,
  screen_time_summary JSONB,

  -- Metadata
  data_source TEXT,  -- Legacy
  synced_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Audit
  edits JSONB,  -- Array of edit records
  notes TEXT CHECK (char_length(notes) <= 500),
  heart_rate_avg INT CHECK (heart_rate_avg >= 20 AND heart_rate_avg <= 200),

  -- Constraints
  UNIQUE(user_id, date),
  CHECK (start_time < end_time)
);

CREATE INDEX idx_sleep_records_user_date ON sleep_records(user_id, date DESC);
CREATE INDEX idx_sleep_records_date ON sleep_records(date);
```

**`score_breakdown` JSONB Structure:**

```json
{
  "duration_norm": 28,
  "deep_pct": 17,
  "rem_pct": 19,
  "efficiency": 12,
  "consistency": 8,
  "total": 84
}
```

---

### 5.2 Upsert Behavior

**Conflict Key:** `(user_id, date)` - Same user, same date

**On Conflict:**

1. Existing record found for user + date
2. Replace ALL fields with incoming data
3. Old record discarded (soft-deleted via `updated_at` tracking)

**Example:**

```
Record 1 (2026-02-14, Health Connect): duration 480 min
↓ User manually edits via AddSleepRecordModal
Record 2 (2026-02-14, Manual): duration 500 min
↓ Upsert on same date
Final: Record 2 overwrites Record 1
```

---

## 6. Data Transformation Pipeline

### 6.1 Health Connect → SleepData

**Source:** `apps/mobile/modules/health-connect/`

**Transform:**

```
SleepSession (from HC)
├── startTime: Date
├── endTime: Date
├── durationMinutes: number
├── deepSleepMinutes: number
├── remSleepMinutes: number
├── lightSleepMinutes: number
└── awakeSleepMinutes: number

    ↓ (sleepStore.ts: syncToSupabase)

SleepData (local storage)
├── id: `hc-${date}-${Date.now()}`
├── user_id: UUID
├── date: "2026-02-14"
├── start_time: "2026-02-13T22:00:00Z"
├── end_time: "2026-02-14T06:00:00Z"
├── duration_minutes: 480
├── quality_score: calculateQualityFromDuration()
├── deep_sleep_minutes: 90
├── rem_sleep_minutes: 110
├── light_sleep_minutes: 260
├── awake_minutes: 20
├── sleep_score: calculateSleepScore()
├── score_breakdown: { duration_norm, deep_pct, rem_pct, ... }
├── source: "health_connect"
├── confidence: "high"
├── data_source: "health_connect"
└── synced_at: ISO timestamp
```

---

### 6.2 Manual Input → SleepData

**Source:** `apps/mobile/components/sleep/AddSleepRecordModal.tsx`

**Transform:**

```
User Input (UI Modal)
├── startTime: 2026-02-13T22:00  (user-selected, can be prev day)
└── endTime: 2026-02-14T06:00    (reference day)

    ↓ (sleepStore.ts: forceSaveManualSleep)

SleepData (local storage)
├── id: `manual-${date}-${Date.now()}`
├── user_id: UUID
├── date: "2026-02-14"
├── start_time: "2026-02-13T22:00:00Z"
├── end_time: "2026-02-14T06:00:00Z"
├── duration_minutes: 480
├── quality_score: calculateQualityFromDuration()
├── deep_sleep_minutes: 72 (estimated)
├── rem_sleep_minutes: 105 (estimated)
├── light_sleep_minutes: 275 (estimated)
├── awake_minutes: 28 (estimated)
├── sleep_score: calculateSleepScore()
├── score_breakdown: ❌ COMPLEX OBJECT (BUG!)
├── source: "manual"
├── confidence: "low"
├── data_source: "manual"
└── synced_at: ISO timestamp

    ↗ API POST /api/sleep/log
        ❌ Validation fails on score_breakdown
```

---

### 6.3 Score Breakdown Transformation (FIX)

**Current (Broken):**

```typescript
// sleepStore.ts line 777
score_breakdown: dynamicScoreResult.scoreBreakdown; // ❌ Complex object
```

**Fixed (Proposed):**

```typescript
// sleepStore.ts line 777
score_breakdown: transformScoreBreakdown(dynamicScoreResult.scoreBreakdown);

// sleepCalculations.ts (new utility)
function transformScoreBreakdown(
  complex: ScoreBreakdown,
): SimpleScoreBreakdown {
  return {
    duration_norm: clamp(complex.components.duration, 0, 35),
    deep_pct: clamp(complex.components.deepSleep, 0, 20),
    rem_pct: clamp(complex.components.remSleep, 0, 20),
    efficiency: clamp(complex.components.efficiency, 0, 15),
    consistency: clamp(complex.components.consistency, 0, 10),
    total: clamp(complex.score, 0, 100),
  };
}

// Result: Simple 6-field object ✅ Passes validation
```

---

## 7. Caching & Sync Strategy

### 7.1 Cache Lifecycle

```
Fresh Data (from HC)
    ↓
upsertCacheRecord(record, markPending=false)
    ├── Save to async-storage
    └── syncStatus: "synced"

Pending Data (manual entry)
    ↓
upsertCacheRecord(record, markPending=true)
    ├── Save to async-storage
    ├── syncStatus: "pending"
    └── Retry interval: 30s

Offline Scenario
    ↓
User adds manual sleep (offline)
    ├── Save to cache
    ├── Show in UI immediately (optimistic)
    ├── Mark "pending"
    └── On app resume → sync

Sync Attempt (online)
    ↓
getPendingSyncRecords()
    ├── Filter syncStatus="pending"
    ├── Batch into groups of 30
    ├── POST /api/sleep/sync-batch
    ├── On success: markRecordsSynced()
    └── On error: retry later
```

### 7.2 Cooldown Tracking

**Purpose:** Prevent excessive API calls

**Keys in Cache:**

```typescript
"sleep_fetch_cooldown": {
  lastFetch: number;  // Timestamp
  lastSync: number;   // Timestamp
}
```

**Timers:**

```typescript
const FETCH_COOLDOWN = 300 * 1000; // 5 minutes
const SYNC_COOLDOWN = 60 * 1000; // 1 minute
const SYNC_RETRY_INTERVAL = 30 * 1000; // 30 seconds (for failed)
```

**Logic:**

```typescript
// fetchSleepData()
if (now - state.lastFetch < FETCH_COOLDOWN) {
  return; // Skip, use cache
}

// forceSaveManualSleep()
// No cooldown - always saves immediately (but still syncs)
```

---

## 8. Error Handling & Retry

### 8.1 Network Errors

**API Timeout (10s):**

```typescript
// api.ts
timeout: 10000;

// sleepStore.ts
try {
  await api.post('/api/sleep/log', payload);
} catch (error) {
  if (error.response?.status === 408 || error.code === 'ECONNABORTED') {
    console.error('[SleepStore] Request timeout');
    // Keep in pending queue
  }
}
```

**Validation Errors (400):**

```json
{
  "error": "Validation failed",
  "details": [
    {
      "code": "too_big",
      "path": ["body", "score_breakdown"],
      "message": "..."
    }
  ]
}
```

**Permission Errors (403):**

```json
{
  "error": "Unauthorized"
}
```

### 8.2 Retry Strategy

**Auto-Retry on Resume:**

```typescript
// initSleepStoreListeners()
AppState.addEventListener('change', (nextAppState) => {
  if (nextAppState === 'active') {
    // App came to foreground
    get().syncPendingRecords(userId);
    get().fetchSleepData(userId); // Refresh
  }
});
```

**Manual Retry:**

```typescript
// User pull-to-refresh
onRefresh={() => {
  resetCooldowns();
  fetchSleepData(userId);
}}
```

**Exponential Backoff:**

```typescript
// Not currently implemented, but recommended:
retry_count: 0;
max_retries: 3;
backoff_ms: 1000 * Math.pow(2, retry_count); // 1s, 2s, 4s
```

---

## 9. Data Flow Diagram (End-to-End)

### Scenario: Manual Sleep Entry

```
┌─────────────────────────────────────────────────────────────┐
│ User Opens App                                              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │ SleepStore: checkStatus()    │
        │ ├── HC available?            │
        │ ├── HC connected?            │
        │ └── loadCachedData()          │
        └──────────────┬─────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │ Render SleepScreen           │
        │ ├── Weekly history (cached)  │
        │ └── "Add Sleep Record" btn   │
        └──────────────┬─────────────────┘
                       │ User clicks "Add"
                       ▼
        ┌──────────────────────────────┐
        │ AddSleepRecordModal opens    │
        │ ├── Circular start knob      │
        │ ├── Circular end knob        │
        │ └── Auto-calc duration       │
        └──────────────┬─────────────────┘
                       │ User saves: 10 PM → 6 AM
                       ▼
        ┌──────────────────────────────┐
        │ sleepStore.forceSaveManualSleep()
        │ startTime="2026-02-13T22:00Z"│
        │ endTime="2026-02-14T06:00Z"  │
        └──────────────┬─────────────────┘
                       │
                       ▼ (Step 1)
        ┌──────────────────────────────────┐
        │ Parse dates → ISO                │
        │ duration = (6-22) * 60 = 480 min │
        │ date = "2026-02-14"              │
        └──────────────┬───────────────────┘
                       │
                       ▼ (Step 2)
        ┌──────────────────────────────────┐
        │ estimateSleepStages(480)         │
        │ deep: 72, rem: 105               │
        │ light: 275, awake: 28            │
        └──────────────┬───────────────────┘
                       │
                       ▼ (Step 3)
        ┌──────────────────────────────────┐
        │ calculateQualityFromDuration()   │
        │ quality_score: 85                │
        └──────────────┬───────────────────┘
                       │
                       ▼ (Step 4)
        ┌──────────────────────────────────┐
        │ calculateDynamicSleepScore()     │
        │ sleepScore: 87                   │
        │ scoreBreakdown: {                │
        │   score: 87,                     │
        │   confidence: "high",            │
        │   components: {...},  ❌ COMPLEX │
        │   weights: {...},                │
        │   adjustments: {...},            │
        │   baseline: {...},               │
        │   ageNorm: {...},                │
        │   flags: [...]                   │
        │ }                                │
        └──────────────┬───────────────────┘
                       │
                       ▼ (Step 5)
        ┌──────────────────────────────────┐
        │ Create SleepData object          │
        │ {                                │
        │   id: "manual-2026-02-14-..."    │
        │   user_id: "uuid"                │
        │   date: "2026-02-14"             │
        │   ...all fields...               │
        │   score_breakdown: ❌ COMPLEX    │
        │   source: "manual"               │
        │   confidence: "low"              │
        │ }                                │
        └──────────────┬───────────────────┘
                       │
                       ▼ (Step 6)
        ┌──────────────────────────────────┐
        │ Optimistic UI Update             │
        │ set(weeklyHistory, monthlyData)  │
        │ → Record appears in UI           │
        └──────────────┬───────────────────┘
                       │
                       ▼ (Step 7)
        ┌──────────────────────────────────┐
        │ Remove id, synced_at             │
        │ POST /api/sleep/log {            │
        │   user_id, date, ...all fields...│
        │   score_breakdown: ❌ COMPLEX    │
        │ }                                │
        └──────────────┬───────────────────┘
                       │
           ┌───────────┴──────────┐
           │                      │
        No Network        Network Available
           │                      │
           ▼                      ▼
    ┌────────────────┐   ┌──────────────────────────┐
    │ Save to cache  │   │ Sent to API              │
    │ syncStatus:    │   └──────────────┬───────────┘
    │ "pending"      │                  │
    └────────────────┘         ┌────────▼────────────┐
           │                   │ validate()          │
           │                   │ scoreBreakdownSchema│
           │                   │ ❌ FAILS (too many  │
           │                   │    properties)      │
           │                   └────────┬────────────┘
           │                            │
           │                    ┌───────▼────────────┐
           │                    │ Return 400:        │
           │                    │ {                  │
           │                    │   error: "Validat…"│
           │                    │   details: [...]   │
           │                    │ }                  │
           │                    └────────┬────────────┘
           │                             │
           └─────────────────┬───────────┘
                             │
                             ▼
                   ┌──────────────────────────┐
                   │ sleepStore catch()       │
                   │ console.error("Error... "│
                   │ loadCachedData()         │
                   │ (rollback optimistic UI) │
                   └──────────────────────────┘
```

---

### With Fix Applied

```
                        ▼ (Step 4.5) ✅ NEW
        ┌──────────────────────────────────┐
        │ transformScoreBreakdown()        │
        │ Extract components:              │
        │ {                                │
        │   duration_norm: 28,             │
        │   deep_pct: 17,                  │
        │   rem_pct: 19,                   │
        │   efficiency: 12,                │
        │   consistency: 8,                │
        │   total: 84                      │
        │ }                                │
        └──────────────┬───────────────────┘
                       │
                       ▼ (Step 5 - Modified)
        ┌──────────────────────────────────┐
        │ Create SleepData with SIMPLE      │
        │ score_breakdown ✅               │
        └──────────────┬───────────────────┘
                       │
                       ▼ (Step 7 - Modified)
        ┌──────────────────────────────────┐
        │ POST /api/sleep/log {            │
        │   user_id, date, ...all fields...│
        │   score_breakdown: ✅ SIMPLE     │
        │ }                                │
        └──────────────┬───────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────┐
        │ validate(sleepLogSchema)         │
        │ ✅ PASSES                        │
        └──────────────┬───────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────┐
        │ Controller: saveLog()            │
        │ Logger: "Sleep log saved"        │
        └──────────────┬───────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────┐
        │ Service: saveLog()               │
        │ Upsert to DB                     │
        └──────────────┬───────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────┐
        │ Cache: markRecordsSynced()       │
        │ syncStatus: "synced"             │
        │ ✅ Sync complete                │
        └──────────────────────────────────┘
```

---

## 10. Summary Table

| Stage                | Component                  | Format                      | Cooldown           | Error Handling           |
| -------------------- | -------------------------- | --------------------------- | ------------------ | ------------------------ |
| **Collection**       | Health Connect, Manual, DW | `SleepSession` / Form Input | None               | HC permission denied     |
| **Local Processing** | sleepStore, sleepCalcs     | `SleepData` (in-memory)     | 5m fetch, 1m sync  | Parse errors             |
| **Local Cache**      | async-storage (SQLite)     | JSON array                  | Tracked per record | IO errors                |
| **API Transmission** | axios client               | JSON POST                   | 10s timeout        | Network timeout/401/403  |
| **Validation**       | Zod schema                 | sleepLogSchema              | N/A                | 400 Validation failed ❌ |
| **Processing**       | Express controller         | SQL insert/update           | Rate limit         | Logic errors             |
| **Storage**          | PostgreSQL                 | JSONB fields                | N/A                | Constraint violations    |
| **Sync Status**      | Cache metadata             | pending/synced flag         | 30s retry          | Displayed in error toast |

---

## 11. Key Data Formats

### SleepData (Mobile Cache Format)

```typescript
{
  id: string;
  user_id: string;
  date: string;                         // YYYY-MM-DD
  start_time: string;                   // ISO
  end_time: string;                     // ISO
  duration_minutes: number;
  quality_score: number;                // 0-100
  deep_sleep_minutes: number;
  rem_sleep_minutes: number;
  light_sleep_minutes: number;
  awake_minutes: number;
  sleep_score?: number;                 // 0-100
  score_breakdown?: SimpleScoreBreakdown;
  source?: DataSource;
  confidence?: ConfidenceLevel;
  data_source: string;
  synced_at: string;                    // ISO
}

SimpleScoreBreakdown {
  duration_norm: number;                // 0-35
  deep_pct: number;                     // 0-20
  rem_pct: number;                      // 0-20
  efficiency: number;                   // 0-15
  consistency: number;                  // 0-10
  total: number;                        // 0-100
}
```

### Complex ScoreBreakdown (sleepAnalysis.ts Output) ⚠️

```typescript
{
  score: number;
  confidence: "high" | "medium" | "low";
  components: {
    duration: number;
    deepSleep: number;
    remSleep: number;
    efficiency: number;
    waso: number;
    consistency: number;
    timing: number;
    screenTime: number;
  };
  weights: Record<string, number>;
  adjustments: {
    sourceReliabilityFactor: number;
    dataCompletenessFactor: number;
    chronicDebtPenalty: number;
    ageEfficiencyCorrection: number;
    chronotypeAlignmentDelta: number;
  };
  baseline: UserBaseline;
  ageNorm: AgeNorm;
  flags: string[];
  calculatedAt: string;                 // ISO
}
```

---

## 12. Known Issues & Fixes

| Issue                               | Location          | Status         | Fix                                      |
| ----------------------------------- | ----------------- | -------------- | ---------------------------------------- |
| **Manual sleep validation fails**   | sleepStore.ts:777 | ❌ Open        | Transform complex to simple breakdown    |
| **Score breakdown field mismatch**  | API validation    | ❌ Open        | Update validation or transform on mobile |
| **No exponential backoff on retry** | sleepStore.ts     | ⚠️ Enhancement | Add backoff_ms tracking to cache         |
| **Hardcoded timeout (10s)**         | api.ts            | ⚠️ Performance | Make configurable per request type       |
| **No batch deduplication**          | sleepCache.ts     | ⚠️ Enhancement | Check sync before upsert                 |

---

**Last Updated:** February 14, 2026  
**Status:** Production Ready (with manual sleep fix pending)
