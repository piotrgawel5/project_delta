# Agent Task: Sleep Algorithm Improvement + Premium Sleep Stage Prediction

## Pre-flight — Read These First

Before writing a single line of code, read both of these in full:

1. `packages/docs/context.md` — project architecture, conventions, path aliases, all constraints
2. `packages/docs/sleep_research.docx` — the scientific basis for every decision in this task. Use `pandoc packages/docs/sleep_research.docx -o /tmp/sleep_research.md` to extract it as readable text, then read `/tmp/sleep_research.md`. The algorithm logic below is derived from this document. If you find a contradiction between this prompt and the research doc, the research doc wins.

Do not proceed until both are read.

---

## Database Schema Reference

Work against these exact column names. Do not invent column names.

```sql
-- user_profiles
"id", "user_id", "created_at", "updated_at", "username",
"date_of_birth",          -- used to compute age
"weight_value", "weight_unit",
"height_value", "height_unit", "height_inches",
"sex",                    -- 'male' | 'female' | null
"preferred_sport",
"activity_level",         -- 'sedentary'|'light'|'moderate'|'active'|'very_active'
"goal",
"onboarding_completed",
"primary_auth_method", "has_passkey",
"avatar_url", "username_changed_at"
-- plan column does NOT exist yet — see Task 0

-- sleep_data
"id", "user_id", "date",
"start_time", "end_time",          -- ISO strings — critical for timeline timestamps
"duration_minutes",
"quality_score",
"deep_sleep_minutes", "rem_sleep_minutes",
"light_sleep_minutes", "awake_minutes",
"data_source", "synced_at", "created_at", "updated_at",
"sleep_score", "score_breakdown",
"source", "confidence",
"estimated_bedtime", "estimated_wakeup",
"screen_time_summary", "edits", "session_id"
```

---

## Task 0 — Database Scaffolding via Supabase MCP

Use the Supabase MCP tool to execute the following. Do this before any TypeScript changes.

**Step 0a — Add `plan` column to `user_profiles`:**
```sql
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free'
  CHECK (plan IN ('free', 'pro', 'premium'));
```

**Step 0b — Set two test records to `'pro'`** (pick any two existing user_ids from the table):
```sql
UPDATE public.user_profiles
SET plan = 'pro'
WHERE user_id IN (
  SELECT user_id FROM public.user_profiles LIMIT 2
);
```

**Step 0c — Verify:**
```sql
SELECT user_id, plan FROM public.user_profiles LIMIT 10;
```

---

## Task 1 — TypeScript Type Updates

### 1a — Add `plan` to `UserProfile` in `apps/mobile/store/profileStore.ts`

```ts
// In the UserProfile interface, add:
plan?: 'free' | 'pro' | 'premium';
```

Default to `'free'` wherever `plan` is not present. Make it optional for backward compat.

### 1b — Update `ScoreBreakdown` in `packages/shared/src/types/`

Add these optional fields (all 0–100):
```ts
efficiencyScore?: number;
wasoScore?: number;
tstScore?: number;
deepScore?: number;
remScore?: number;
regularityScore?: number;
```

### 1c — Add `PremiumSleepPrediction` to `packages/shared/src/types/`

```ts
export interface SleepPhaseEvent {
  stage: 'awake' | 'light' | 'deep' | 'rem';
  startTime: string;           // ISO — absolute timestamp, not relative offset
  endTime: string;             // ISO
  durationMinutes: number;
  cycleNumber: number;         // 1-based; 0 = pre-sleep awake
}

export interface SleepCycleMap {
  estimatedCycles: number;
  // Full flat timeline ordered by startTime — compatible with existing SleepTimeline component
  // Each SleepPhaseEvent maps directly to SleepStage in SleepTimeline.tsx
  phaseTimeline: SleepPhaseEvent[];
  cycleBreakdown: Array<{
    cycleNumber: number;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    dominantStage: 'deep' | 'rem' | 'light';
    deepMinutes: number;
    remMinutes: number;
    lightMinutes: number;
    awakeMinutes: number;
  }>;
}

export interface PredictedStageDistribution {
  deepPercent: number;
  remPercent: number;
  lightPercent: number;
  awakePercent: number;
  confidence: 'high' | 'medium' | 'low';
  predictionBasis: string[];   // human-readable: e.g. ["age_calibrated", "vo2max_estimated_hrv", "sleep_debt_rebound"]
}

export interface PremiumSleepPrediction {
  stageDistribution: PredictedStageDistribution;
  cycleMap: SleepCycleMap;
  estimatedPhysiology: EstimatedPhysiology;     // see Task 3
  predictedSleepScore: number;
  sleepDebtMinutes: number;
  recoveryIndex: number;       // 0–100
  insightFlags: string[];
}

export interface EstimatedPhysiology {
  estimatedVO2Max: number;
  estimatedRestingHR: number;
  estimatedHRVrmssd: number;
  estimatedHRMax: number;
  basisNotes: string[];        // e.g. ["age=34", "activity=active", "sex=male"]
}
```

Add `premiumPrediction?: PremiumSleepPrediction` to the existing `SleepRecord` type.

Export everything new from `packages/shared/src/index.ts`.

### 1d — Add `premiumPrediction` to `SleepData` in `sleepStore.ts`

```ts
premiumPrediction?: PremiumSleepPrediction;   // optional, not persisted to DB
```

---

## Task 2 — Plan Guard Utility

Create `apps/mobile/lib/planUtils.ts`:

```ts
export type UserPlan = 'free' | 'pro' | 'premium';

export function isPaidPlan(plan?: string | null): plan is 'pro' | 'premium' {
  return plan === 'pro' || plan === 'premium';
}

export function getPlanFeatures(plan?: string | null) {
  return {
    premiumSleepPrediction: isPaidPlan(plan),
    advancedInsights: isPaidPlan(plan),
    sleepTimeline: isPaidPlan(plan),   // flag for future UI gating
  };
}
```

---

## Task 3 — Physiological Estimation Engine (No Wearable Data Path)

Create `apps/mobile/lib/sleepPhysiologyEstimator.ts`.

This is the core of the premium algorithm. Because heart rate data will typically be unavailable, we derive estimated cardiac/aerobic biomarkers from profile data using validated exercise physiology formulas. These estimates then feed the stage predictor as surrogate signals.

### 3a — VO2max Estimation

Use sex + activity level as the primary lookup, then apply an age-based decline correction.

```ts
// Base VO2max by activity level (mL/kg/min) — from ACSM normative tables
const VO2MAX_BASE: Record<string, { male: number; female: number }> = {
  sedentary:   { male: 35, female: 30 },
  light:       { male: 40, female: 35 },
  moderate:    { male: 46, female: 41 },
  active:      { male: 53, female: 47 },
  very_active: { male: 59, female: 53 },
};

// Age correction: VO2max declines ~1% per year after age 25
// appliedVO2Max = baseVO2Max × (1 - max(0, age - 25) × 0.01)
```

If `sex` is null, use the average of male/female. If `activity_level` is null, default to `'moderate'`. If `date_of_birth` is null, assume age 35.

### 3b — Resting Heart Rate Estimation (Uth-Sørensen formula, rearranged)

```
HRmax = 207 - (0.7 × age)           // Tanaka formula (more accurate than 220-age)
HRrest = HRmax / (VO2max / 15)      // Uth formula rearranged
HRrest = clamp(HRrest, 38, 90)      // physiological bounds
```

### 3c — HRV (rMSSD) Estimation

rMSSD correlates inversely with resting HR and positively with aerobic fitness. Use this linear approximation derived from population normative data:

```
rMSSD = 20 + (70 - HRrest) × 0.9
rMSSD = clamp(rMSSD, 12, 80)

// Sex correction: women average ~5ms higher HF power
if (sex === 'female') rMSSD += 5;

// Age correction: HRV declines with age
rMSSD -= max(0, age - 30) × 0.25
rMSSD = clamp(rMSSD, 12, 80)
```

### 3d — Estimated Respiratory Rate

Use resting metabolic state as proxy:
```
baseRR = 14 - (VO2max - 35) × 0.05    // fitter → slightly lower nocturnal RR
baseRR = clamp(baseRR, 12, 17)
```

### 3e — Exported function

```ts
export function estimatePhysiology(profile: {
  dateOfBirth?: string | null;
  sex?: string | null;
  activityLevel?: string | null;
}): EstimatedPhysiology & {
  estimatedRespiratoryRate: number;
}
```

Log all input assumptions in `basisNotes`.

---

## Task 4 — Free-Tier Algorithm Improvements

### 4a — `estimateSleepStages()` in `apps/mobile/lib/sleepCalculations.ts`

Replace the flat percentage distribution with age-calibrated targets from the research:

```
Age < 25:  deep=22%, REM=23%, light=50%, awake=5%
Age 25–44: deep=18%, REM=22%, light=52%, awake=8%
Age 45–64: deep=14%, REM=20%, light=56%, awake=10%
Age 65+:   deep=10%, REM=18%, light=60%, awake=12%
No age:    deep=18%, REM=22%, light=52%, awake=8%
```

The `UserProfile` already has `age` flowing through `toSleepEngineProfile()` in `sleepStore.ts`.

### 4b — `calculateSleepScore()` in `apps/mobile/lib/sleepAnalysis.ts`

Update weights to the research-validated composite:

| Component | New Weight | Old Weight | Scoring logic |
|---|---|---|---|
| Sleep Efficiency | 25% | 15% | SE = duration/timeInBed. Use start/end diff for timeInBed when available, else `duration × 1.08`. SE ≥90%=100pts, 85–90%=80, 80–85%=60, <80%=scaled linear |
| Deep Sleep (N3) | 20% | 20% | Target band 20–25% of TST (age-adjusted). Score 100 in band, linear penalty outside |
| REM Sleep | 20% | 20% | Target band 20–25% of TST. Score 100 in band, linear penalty outside |
| WASO | 15% | 0% (was folded into efficiency) | awake_minutes if available, else estimate timeInBed−duration. <15min=100, linear decay, 60+min=0 |
| Total Sleep Time | 10% | 35% | J-curve: 7–9h=100, 6–7/9–10h=80, 5–6/10–11h=50, <5/>11h=20 |
| Sleep Regularity | 10% | 10% | Unchanged — uses history consistency |

If `awake_minutes` is null and `start_time`/`end_time` are available: `WASO_estimate = timeInBed - duration_minutes`, capped at 0.

Populate all new `ScoreBreakdown` fields from §1b with the per-component scores.

---

## Task 5 — Premium Sleep Stage Predictor

Create `apps/mobile/lib/sleepStagePredictor.ts`.

**This file must be imported ONLY behind the `isPaidPlan()` guard. Never import it at module top-level in the store.**

```ts
import type { SleepPredictionInput, PremiumSleepPrediction } from '@shared';
```

### 5a — Input type

```ts
export interface SleepPredictionInput {
  // Core — always available
  durationMinutes: number;
  startTime: string | null;
  endTime: string | null;

  // From sleep_data — may be null (used for calibration if real data exists)
  existingDeepMinutes?: number | null;
  existingRemMinutes?: number | null;
  existingLightMinutes?: number | null;
  existingAwakeMinutes?: number | null;

  // From estimatePhysiology() — always populated for premium path
  estimatedVO2Max: number;
  estimatedRestingHR: number;
  estimatedHRVrmssd: number;
  estimatedRespiratoryRate: number;

  // User profile
  age?: number;
  sex?: 'male' | 'female' | null;
  chronotype?: 'morning' | 'intermediate' | 'evening';

  // Sleep history context — computed from sleepStore recentHistory
  previousNightDurationMinutes?: number;
  recentSleepDebt?: number;          // minutes below 480 goal, avg last 3 nights
  recentAvgDeepPercent?: number;     // user's personal baseline, avg last 7 nights
  recentAvgRemPercent?: number;
}
```

### 5b — Stage distribution prediction

Implement `predictStageDistribution(input: SleepPredictionInput): PredictedStageDistribution` using this ordered pipeline. At each step, log what was applied to `predictionBasis`.

**If real stage data already exists** (`existingDeepMinutes` etc. are non-null and their sum matches durationMinutes within 5%), skip steps 1–6, use the real data directly, set confidence `'high'`, and go straight to step 7.

**Step 1 — Age-calibrated baseline** (same table as §4a). Confidence starts at `'low'`.

**Step 2 — HRV adjustment** (always run since we have estimated rMSSD):
- rMSSD > 55ms → deep +4%, light −4%
- rMSSD 40–55ms → deep +2%, light −2%
- rMSSD 25–40ms → no change (near average)
- rMSSD < 25ms → deep −4%, awake +2%, light −2%
- Since HRV is estimated (not measured), do NOT upgrade confidence for this step

**Step 3 — Resting HR adjustment** (from estimated value):
- HRrest < 50 → deep +3% (strong athletic cardiac suppression)
- HRrest < 45 → deep +4%, rem +1%
- HRrest > 68 → deep −3%, awake +2%
- HRrest > 78 → deep −5%, awake +3%

**Step 4 — VO2max adjustment** (independent aerobic fitness signal):
- VO2max > 52 → rem +2% (aerobic fitness correlates with REM quality)
- VO2max < 35 → rem −2%, light +2%

**Step 5 — Respiratory rate adjustment** (from estimated value):
- RR 12–14 → deep +2% (N3 respiratory signature)
- RR 15–17 → no change
- RR > 17 → rem +2%, deep −2%

**Step 6 — Sleep debt rebound** (homeostatic pressure, most powerful modifier):
- debt 60–120 min → deep +3%
- debt 120–240 min → deep +5%, rem +2%
- debt > 240 min → deep +8%, rem +3%

**Step 7 — Chronotype offset** (circadian misalignment penalty):
- `evening` chronotype: check `startTime` hour. If sleep starts before 23:00 → rem −3% (REM concentrated in late sleep may be cut short if waking early)
- `morning` chronotype: check `endTime` hour. If wake is after 08:00 → deep −2% (circadian mismatch for morning types sleeping late)

**Step 8 — Personal baseline calibration** (if `recentAvgDeepPercent`/`recentAvgRemPercent` available from history):
- Pull predicted values 20% toward personal baseline: `deep = deep * 0.8 + recentAvgDeepPercent * 0.2`
- Same for REM. This anchors predictions to the user's real historical pattern.
- Mark `predictionBasis` as including `"personal_baseline_calibrated"`

**Step 9 — Confidence upgrade**:
- If `recentAvgDeepPercent` was available → upgrade to `'medium'`
- If real existing stage data was used (skipped to step 7) → `'high'`
- Otherwise stays `'low'`

**Step 10 — Clamp & normalise**:
- Clamp each component: awake [2%, 25%], light [30%, 60%], deep [5%, 35%], rem [10%, 35%]
- Normalise so they sum to exactly 100%

### 5c — Phase timeline generation (the key new output)

Implement `generatePhaseTimeline(input: SleepPredictionInput, dist: PredictedStageDistribution): SleepCycleMap`.

This produces a flat `SleepPhaseEvent[]` with actual ISO timestamps. The output is directly compatible with `TimelineData.stages` in the existing `SleepTimeline.tsx` component — no adapter needed.

**Algorithm:**

```
totalMinutes = input.durationMinutes
startMs = new Date(input.startTime).getTime()
estimatedCycles = clamp(Math.round(totalMinutes / 95), 3, 6)

// Distribute stage budgets
deepBudget = totalMinutes * dist.deepPercent / 100
remBudget  = totalMinutes * dist.remPercent  / 100
lightBudget = totalMinutes * dist.lightPercent / 100
awakeBudget = totalMinutes * dist.awakePercent / 100
```

**Pre-sleep awake phase** (always first — based on sleep onset latency research):
```
// Sleep onset latency: estimated from HRV/fitness
// Higher fitness → faster sleep onset
SOL = HRrest > 70 ? 20 : HRrest > 58 ? 14 : 8   (minutes)
SOL = clamp(SOL, 5, 25)

// Emit phase: stage='awake', cycleNumber=0
// startTime = input.startTime
// endTime = startTime + SOL minutes
// Deduct SOL from awakeBudget
```

**Cycle construction** — iterate from cycle 1 to estimatedCycles:
```
Each cycle target duration ≈ totalMinutes / estimatedCycles

Deep allocation per cycle:
  // N3 is front-loaded: first third of cycles get 60% of deep budget
  if (cycle <= ceil(estimatedCycles/3)):
    cycleDeepMins = deepBudget * 0.60 / ceil(estimatedCycles/3)
  else:
    cycleDeepMins = deepBudget * 0.40 / (estimatedCycles - ceil(estimatedCycles/3))

REM allocation per cycle:
  // REM is back-loaded: last third of cycles get 60% of REM budget
  if (cycle >= estimatedCycles - floor(estimatedCycles/3) + 1):
    cycleRemMins = remBudget * 0.60 / floor(estimatedCycles/3)
  else:
    cycleRemMins = remBudget * 0.40 / (estimatedCycles - floor(estimatedCycles/3))

Within each cycle, emit phases in this order:
  1. light (transition descent): ~15–20% of cycle or remaining lightBudget fraction
  2. deep (if cycleDeepMins > 0): cycleDeepMins
  3. light (transition ascent): same as descent
  4. rem (if cycleRemMins > 0): cycleRemMins
  5. brief awake at cycle boundary (micro-arousal): 2–3 min from awakeBudget, only if awakeBudget remains

Each phase:
  startTime = ISO string of currentMs
  endTime = ISO string of currentMs + durationMinutes * 60000
  Advance currentMs by durationMinutes * 60000
```

After all cycles, if `currentMs < endMs` (remaining time), emit a final `light` or `awake` phase to fill the gap.

**Normalise** the final timeline: ensure the last phase's `endTime` equals `input.endTime` exactly (adjust the last segment's duration if needed to avoid floating point gaps).

**Verify invariant**: sum of all `durationMinutes` in timeline == `input.durationMinutes` ± 1 minute. Throw if violated.

### 5d — Recovery index

```ts
function calculateRecoveryIndex(
  dist: PredictedStageDistribution,
  input: SleepPredictionInput
): number {
  const deepScore     = Math.min(100, (dist.deepPercent / 20) * 100) * 0.40;
  const remScore      = Math.min(100, (dist.remPercent  / 22) * 100) * 0.30;
  const durationScore = Math.min(100, (input.durationMinutes / 480) * 100) * 0.20;
  const debtImpact    = input.recentSleepDebt != null
    ? Math.max(0, 100 - (input.recentSleepDebt / 4)) * 0.10
    : 85 * 0.10;
  return Math.round(deepScore + remScore + durationScore + debtImpact);
}
```

### 5e — Insight flags

```ts
function generateInsightFlags(
  dist: PredictedStageDistribution,
  input: SleepPredictionInput,
  recoveryIndex: number
): string[] {
  const flags: string[] = [];
  if (dist.deepPercent >= 20 && dist.confidence !== 'low')   flags.push('OPTIMAL_DEEP');
  if (dist.deepPercent < 12)                                  flags.push('LOW_DEEP');
  if (dist.remPercent > 27)                                   flags.push('REM_REBOUND');
  if (dist.remPercent < 15)                                   flags.push('LOW_REM');
  if (dist.awakePercent > 15)                                 flags.push('HIGH_FRAGMENTATION');
  if ((input.recentSleepDebt ?? 0) > 180)                    flags.push('SLEEP_DEBT_HIGH');
  if ((input.recentSleepDebt ?? 0) > 120 && recoveryIndex >= 80) flags.push('SLEEP_DEBT_CLEARING');
  if (input.estimatedVO2Max > 52 && dist.confidence !== 'low') flags.push('AEROBIC_ADVANTAGE');
  return flags;
}
```

### 5f — Main exported function

```ts
export function buildPremiumPrediction(
  input: SleepPredictionInput
): PremiumSleepPrediction {
  const dist     = predictStageDistribution(input);
  const cycleMap = generatePhaseTimeline(input, dist);
  const recovery = calculateRecoveryIndex(dist, input);
  const flags    = generateInsightFlags(dist, input, recovery);
  const debtMin  = input.recentSleepDebt ?? 0;

  const predictedScore = calculateSleepScore({   // from sleepAnalysis.ts
    current: {
      durationMinutes: input.durationMinutes,
      deepSleepMinutes: Math.round(input.durationMinutes * dist.deepPercent / 100),
      remSleepMinutes:  Math.round(input.durationMinutes * dist.remPercent  / 100),
      lightSleepMinutes: Math.round(input.durationMinutes * dist.lightPercent / 100),
      awakeSleepMinutes: Math.round(input.durationMinutes * dist.awakePercent / 100),
      startTime: input.startTime,
      endTime:   input.endTime,
      source: 'premium_prediction',
      confidence: dist.confidence,
    } as any,
    history: [],
    userProfile: { sleepGoalMinutes: 480, age: input.age },
  }).sleepScore;

  return {
    stageDistribution: dist,
    cycleMap,
    estimatedPhysiology: {
      estimatedVO2Max:      input.estimatedVO2Max,
      estimatedRestingHR:   input.estimatedRestingHR,
      estimatedHRVrmssd:    input.estimatedHRVrmssd,
      estimatedHRMax:       Math.round(207 - 0.7 * (input.age ?? 35)),
      basisNotes: dist.predictionBasis,
    },
    predictedSleepScore: predictedScore,
    sleepDebtMinutes:    debtMin,
    recoveryIndex:       recovery,
    insightFlags:        flags,
  };
}
```

---

## Task 6 — Wire into `sleepStore.ts`

### 6a — Helper: `computeRecentDebt`

```ts
function computeRecentDebt(history: SleepData[]): number {
  const recent = [...history]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3);
  if (recent.length === 0) return 0;
  const avg = recent.reduce((s, r) => s + (r.duration_minutes ?? 0), 0) / recent.length;
  return Math.max(0, 480 - avg);
}
```

### 6b — Helper: `computeRecentStageAverages`

```ts
function computeRecentStageAverages(history: SleepData[]) {
  const valid = history
    .filter(r => r.duration_minutes > 0 && r.deep_sleep_minutes != null)
    .slice(0, 7);
  if (valid.length === 0) return {};
  const avgDeep = valid.reduce((s, r) =>
    s + (r.deep_sleep_minutes! / r.duration_minutes) * 100, 0) / valid.length;
  const avgRem  = valid.reduce((s, r) =>
    s + ((r.rem_sleep_minutes ?? 0) / r.duration_minutes) * 100, 0) / valid.length;
  return { recentAvgDeepPercent: avgDeep, recentAvgRemPercent: avgRem };
}
```

### 6c — Integration point in `fetchSleepData()` and `forceSaveManualSleep()`

After `scoreAndPersistRecords()` completes and you have `scoredRecentHistory`, add:

```ts
const plan = useProfileStore.getState().profile?.plan;

if (isPaidPlan(plan)) {
  // Dynamic import — never loaded for free users
  const { buildPremiumPrediction } = await import('@lib/sleepStagePredictor');
  const { estimatePhysiology }     = await import('@lib/sleepPhysiologyEstimator');
  const profile = useProfileStore.getState().profile;

  const phys = estimatePhysiology({
    dateOfBirth:   profile?.date_of_birth,
    sex:           profile?.sex,
    activityLevel: profile?.activity_level,
  });

  const debt = computeRecentDebt(scoredRecentHistory);
  const stageAvgs = computeRecentStageAverages(scoredRecentHistory);

  scoredRecentHistory.forEach(record => {
    if (!record.start_time || !record.end_time) return;
    const age = phys.basisNotes
      .find(n => n.startsWith('age='))
      ?.replace('age=', '');

    record.premiumPrediction = buildPremiumPrediction({
      durationMinutes:          record.duration_minutes,
      startTime:                record.start_time,
      endTime:                  record.end_time,
      existingDeepMinutes:      record.deep_sleep_minutes,
      existingRemMinutes:       record.rem_sleep_minutes,
      existingLightMinutes:     record.light_sleep_minutes,
      existingAwakeMinutes:     record.awake_minutes,
      estimatedVO2Max:          phys.estimatedVO2Max,
      estimatedRestingHR:       phys.estimatedRestingHR,
      estimatedHRVrmssd:        phys.estimatedHRVrmssd,
      estimatedRespiratoryRate: phys.estimatedRespiratoryRate,
      age:                      age ? parseInt(age) : undefined,
      sex:                      (profile?.sex as any) ?? null,
      chronotype:               (profile as any)?.chronotype ?? 'intermediate',
      recentSleepDebt:          debt,
      ...stageAvgs,
    });
  });
}
```

`premiumPrediction` is **not persisted to Supabase** — computed client-side on every fetch. Never include it in API payloads.

---

## Task 7 — Unit Tests

Create `apps/mobile/lib/__tests__/sleepStagePredictor.test.ts` and `apps/mobile/lib/__tests__/sleepPhysiologyEstimator.test.ts`.

### Physiology estimator tests:
1. Active 30yo male → VO2max ~53, HRrest ~44–50, rMSSD ~35–45
2. Sedentary 60yo female → VO2max ~27–30, HRrest ~65–75, rMSSD ~20–28
3. Null inputs → returns defaults without throwing
4. Age 25 exact → no age correction applied to VO2max
5. `basisNotes` always populated

### Stage predictor tests:
1. Input with all null existing stages + `low_confidence` phys → confidence `'low'`, output sums to 100
2. High HRV (rMSSD=65) → deep% higher than low HRV (rMSSD=20) baseline for same age
3. Sleep debt 250min → deep% and rem% both higher than zero-debt baseline
4. Real existing stage data provided → `confidence='high'`, dist matches existing data exactly
5. All percentages stay within: awake [2,25], light [30,60], deep [5,35], rem [10,35]
6. `generatePhaseTimeline` → sum of `durationMinutes` across all events == input `durationMinutes` ± 1
7. `generatePhaseTimeline` → every `endTime` equals next event's `startTime` (no gaps, no overlaps)
8. `generatePhaseTimeline` → first event is always `stage='awake'`, `cycleNumber=0`
9. `generatePhaseTimeline` → `estimatedCycles` in [3,6] for any valid input
10. `isPaidPlan('free')` → false; `isPaidPlan('pro')` → true; `isPaidPlan(undefined)` → false

### Score improvement tests:
11. 8h sleep, 22% deep, 22% REM → score ≥ 82
12. 4h sleep → score < 48
13. Same duration but awake_minutes=60 → lower WASO component score than awake_minutes=5
14. J-curve: 9.5h → lower TST score than 7.5h

---

## Constraints

- **TypeScript strict mode** throughout
- **No external ML libraries.** Pure deterministic TypeScript only. No `mathjs`, no `tensorflow`.
- **No new npm packages** — none are needed
- **Dynamic import** the predictor module (`await import(...)`) — never statically import `sleepStagePredictor.ts` from the store. This ensures the premium code path is tree-shakeable and never executes for free users
- **`premiumPrediction` must never be serialised to Supabase** — add a comment on the field, strip it from any API payload construction
- Backward compatibility: all existing `SleepData` without `premiumPrediction` continue to work everywhere. All new type fields are optional
- **Do NOT modify** `AddSleepRecordModal.tsx`, `SleepCalendar.tsx`, or any component in `components/sleep/`. Logic changes only
- The `SleepPhaseEvent[]` produced by `generatePhaseTimeline` uses the same field names as `SleepStage` in `SleepTimeline.tsx` (`stage`, `startTime`, `endTime`, `durationMinutes`) — this is intentional and required for future chart integration. Do not rename them
- Run `npm run lint` from `apps/mobile/`. Fix all errors before finishing
- Commit: `feat(sleep): research-backed scoring improvements + premium stage prediction w/ estimated physiology`
