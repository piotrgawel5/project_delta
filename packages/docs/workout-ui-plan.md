# Workout Feature — UI Implementation Plan

**Branch:** `feature/workout`  
**Scope:** UI only. Backend stubs are documented contracts — blank implementations, no logic.  
**Reference implementation:** Sleep screen (`apps/mobile/app/(tabs)/sleep.tsx` + `components/sleep/redesign/`)

---

## Locked Decisions

| Decision | Choice | Reason |
|---|---|---|
| Tracking mode | Live (start → track → finish) | User confirmed; high-dopamine iOS-style flow |
| Navigation | Weekly grid → day detail (NOT sleep pager) | Days have 0–N workouts; pager pattern wrong |
| Muscle SVG | `react-native-body-highlighter` npm package | Solves asset gate immediately; anatomically accurate front+back; intensity coloring built-in |
| Hero | Muscle map (week heat) + volume number | Visually differentiated from sleep hero |
| Overtraining | `isOvertrained(muscle, sessions[])` pure function stub | Rule-based 3×/wk + 2-wk lookback; logic deferred, UI reads stub |
| Weekly summary | Cards below grid (like sleep cards) | Consistent pattern |
| Monthly summary | Bottom sheet, "Wrapped" style | Post-MVP polish stage |

---

## Stages

### P0 — Foundations (Types + Fixtures + Store Stub + Backend Stubs)

**Goal:** All types declared, exercise fixture JSON built, store scaffolded, backend files documented but blank. Zero business logic.

#### Files

**`packages/shared/src/types/workout.ts`** — shared types + Zod schemas
```ts
export type MuscleGroup =
  | 'chest' | 'front_delts' | 'side_delts' | 'rear_delts'
  | 'biceps' | 'triceps' | 'forearms'
  | 'upper_back' | 'lats' | 'lower_back' | 'traps'
  | 'abs' | 'obliques'
  | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'hip_flexors';

export type MuscleIntensity = 0 | 1 | 2 | 3; // 0=untrained, 1=light, 2=moderate, 3=heavy/overtrain

export interface Exercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
}

export type ExerciseCategory =
  | 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'core' | 'cardio' | 'full_body';

export interface WorkoutSet {
  id: string;
  exerciseId: string;
  setNumber: number;
  reps: number | null;       // null = time-based
  weightKg: number | null;   // null = bodyweight
  durationSeconds: number | null;
  completedAt: string;       // ISO timestamp
  rpe: number | null;        // 1–10 perceived effort, optional
}

export interface WorkoutExerciseLog {
  exerciseId: string;
  sets: WorkoutSet[];
  notes: string | null;
}

export interface WorkoutSession {
  id: string;
  userId: string;
  date: string;               // YYYY-MM-DD
  startedAt: string;          // ISO timestamp
  finishedAt: string | null;  // null = in progress
  durationSeconds: number | null;
  exercises: WorkoutExerciseLog[];
  notes: string | null;
}

// Zod schemas (collocated)
export const WorkoutSetSchema = z.object({ ... });
export const WorkoutSessionSchema = z.object({ ... });
```

**`apps/mobile/lib/workoutFixtures.ts`** — curated exercise database (~80 exercises)
- Categories: chest, back, shoulders, arms, legs, core
- Each entry: `{ id, name, category, primaryMuscles[], secondaryMuscles[] }`
- Examples: Bench Press → `['chest']` primary, `['front_delts', 'triceps']` secondary
- This is the static data the exercise picker reads from (no API call for exercise list)

**`apps/mobile/store/workoutStore.ts`** — Zustand store stub
```ts
interface WorkoutStore {
  // Session history (loaded from API on mount)
  sessions: WorkoutSession[];
  isLoaded: boolean;

  // Active workout (in-progress session)
  activeSession: WorkoutSession | null;

  // Actions — stubs, logic filled when backend is ready
  startWorkout: () => void;
  addExercise: (exerciseId: string) => void;
  logSet: (exerciseId: string, set: Omit<WorkoutSet, 'id' | 'completedAt'>) => void;
  finishWorkout: () => Promise<void>;
  discardWorkout: () => void;
  fetchSessions: (userId: string) => Promise<void>;
}
```

**`apps/mobile/lib/workoutAnalytics.ts`** — pure function stubs
```ts
// Returns muscle → intensity map for the muscle map component
export function computeMuscleHeatmap(
  sessions: WorkoutSession[],
  lookbackDays: number
): Record<MuscleGroup, MuscleIntensity> { /* stub: returns all 0 */ }

// Overtraining check: muscle trained >3x/week or appears in >6 sessions in 14 days
export function isOvertrained(
  muscle: MuscleGroup,
  sessions: WorkoutSession[]
): boolean { /* stub: returns false */ }

// Weekly volume in total sets
export function computeWeeklyVolume(sessions: WorkoutSession[]): number { /* stub: returns 0 */ }
```

**Backend stubs — documented contracts, blank implementations:**

`services/api/src/modules/workout/workout.routes.ts`
```ts
// POST   /api/workout/sessions          — sync completed session (batch-friendly)
// GET    /api/workout/sessions/:userId  — fetch session history (last 90 days)
// DELETE /api/workout/sessions/:id      — delete a session
// All routes: authenticate + validate(Schema) + asyncHandler(controller.method)
```

`services/api/src/modules/workout/workout.service.ts`
```ts
// fetchSessions(userId: string): Promise<WorkoutSession[]>  — TODO: Supabase query
// saveSession(session: WorkoutSession, userId: string): Promise<void>  — TODO: upsert
// deleteSession(sessionId: string, userId: string): Promise<void>  — TODO: delete with ownership check
```

`services/api/src/modules/workout/workout.validation.ts`
```ts
// WorkoutSessionSyncSchema — Zod schema for POST body
// WorkoutSessionQuerySchema — Zod schema for GET query params
```

`services/supabase/migrations/YYYYMMDDHHMMSS_workout_sessions.sql`
```sql
-- TODO: workout_sessions table
-- TODO: workout_exercise_logs table  
-- TODO: workout_sets table
-- RLS policies: user can only read/write their own rows
```

**P0 Exit Criteria:**
```
[ ] packages/shared/src/types/workout.ts — all types + Zod schemas, exported from index.ts
[ ] apps/mobile/lib/workoutFixtures.ts — ≥40 exercises across all categories
[ ] apps/mobile/store/workoutStore.ts — interface + stub implementations
[ ] apps/mobile/lib/workoutAnalytics.ts — all stubs return safe defaults
[ ] Backend files exist with documented contracts, compile without errors
[ ] npx tsc --noEmit -p apps/mobile/tsconfig.json — passes
[ ] npx tsc --noEmit -p services/api/tsconfig.json — passes
```

---

### P1 — Screen Shell (Navigation + Weekly Grid + Empty State)

**Goal:** workout.tsx rewritten with correct tokens. Weekly Mon–Sun grid. Empty state. "Start Workout" CTA. No live tracking yet.

**Install first:** `npm install react-native-body-highlighter` (in `apps/mobile/`)

#### New tokens in `apps/mobile/constants/theme.ts`
```ts
export const WORKOUT_THEME = {
  accent: '#30D158',               // primary green (same as SLEEP_THEME.success)
  accentDim: 'rgba(48,209,88,0.15)',
  accentMid: '#1D8B41',
  muscleUntrained: 'rgba(255,255,255,0.06)',
  muscleLight: '#1D8B41',
  muscleModerate: '#30D158',
  muscleHeavy: '#FF9F0A',
  muscleOvertrain: '#FF453A',
  heroGradientTop: 'rgba(48,209,88,0.20)',
  heroGradientMid: 'rgba(10,47,28,0.12)',
  restTimerActive: '#30D158',
  restTimerWarning: '#FF9F0A',
  setComplete: '#30D158',
  setIncomplete: 'rgba(255,255,255,0.15)',
} as const;
```

#### Files

**`apps/mobile/app/(tabs)/workout.tsx`** — full rewrite
- OLED black background (`SLEEP_THEME.screenBg`)
- Animated blur header (same pattern as sleep.tsx)
- Sections stacked vertically: Hero → Weekly Grid → Analytics Cards
- "Start Workout" FAB (floating action button, bottom right, green, spring pop-in)
- Safe area insets, `SLEEP_LAYOUT.screenPaddingH` horizontal padding
- `SLEEP_FONTS` throughout — zero Poppins/Inter/System

**`apps/mobile/components/workout/WorkoutWeekGrid.tsx`**
- Mon–Sun row of day pills
- Each pill: letter + dot (green = workout logged, dim = no workout)
- Today highlighted with white border
- Tap a day → triggers `onDayPress(date)` callback
- Animated selected state (spring scale)

**`apps/mobile/components/workout/WorkoutEmptyState.tsx`**
- Shown when no workouts this week
- Dumbbell icon (subtle, WORKOUT_THEME.accentDim tint)
- "No workouts yet this week" + "Start your first" CTA
- FadeIn animation

**`apps/mobile/components/workout/WorkoutHeroShell.tsx`**
- Hero height: matches `SLEEP_LAYOUT.heroHeight` (356)
- Left: volume number ("24 sets this week") + delta pill
- Right: muscle map preview (small, front view, week heatmap)
- Green radial glow behind muscle map
- Skeleton variant for loading

**P1 Exit Criteria:**
```
[ ] workout.tsx uses only SLEEP_THEME/SLEEP_LAYOUT/SLEEP_FONTS/WORKOUT_THEME tokens
[ ] Zero hardcoded hex values, zero Poppins/Inter fonts
[ ] Weekly grid renders, day selection works
[ ] Empty state renders when sessions = []
[ ] "Start Workout" FAB visible, triggers console.log stub
[ ] npx tsc --noEmit — passes
[ ] npm run lint (apps/mobile) — passes
```

---

### P2 — Live Workout Flow (Start → Track → Finish)

**Goal:** Full in-progress workout experience. iOS-quality animations. Rest timer. Set completion dopamine loop.

#### Flow
```
[workout.tsx] Start Workout FAB
  → router.push('/workout/active')

[app/workout/active.tsx] In-progress screen
  ├── Header: workout name + elapsed timer (HH:MM:SS)
  ├── Exercise list (scrollable)
  │   ├── ExerciseSection: name + muscle badges
  │   └── ActiveSetRow × N sets
  ├── "+ Add Exercise" button → ExercisePickerSheet
  ├── Rest Timer overlay (spring slide-up when set completed)
  └── "Finish Workout" → WorkoutFinishSheet
```

#### Files

**`apps/mobile/app/workout/active.tsx`** — in-progress screen
- `useWorkoutStore(s => s.activeSession)` for live state
- Elapsed timer: `useSharedValue` + `withTiming` 1-second interval
- Animated header (blur on scroll, same pattern)
- On hardware back / swipe back: show discard confirmation dialog
- Spring entrance animation for the whole screen

**`apps/mobile/components/workout/ActiveSetRow.tsx`**
- Row: Set # | Weight field | Reps field | Complete button
- On complete: spring scale pulse → green fill → checkmark (Reanimated 4)
- Input fields: numeric keyboard, large touch targets
- Completed rows: dim text, checkmark icon, not editable
- Previous session's values shown as placeholder (ghost text)

**`apps/mobile/components/workout/RestTimer.tsx`**
- Slides up from bottom as a mini card (not full sheet)
- SVG arc progress ring (react-native-svg + Reanimated shared value)
- Countdown text (large, bold)
- Tap to dismiss / skip
- Color: green → amber at 10s → "Go!" pulse when done
- Haptic on start, haptic on done (`expo-haptics`)
- Default: 90s. User can tap +30s

**`apps/mobile/components/workout/ExercisePickerSheet.tsx`**
- `@gorhom/bottom-sheet` (snapPoints: ['60%', '90%'])
- Top: search input (auto-focus on open)
- Category filter pills (scrollable horizontal: All / Chest / Back / ...)
- Filtered exercise list (FlatList with `getItemLayout` for perf)
- Each row: exercise name + muscle badges + "+ Add" button
- Multi-select supported (add multiple then confirm)

**`apps/mobile/components/workout/WorkoutFinishSheet.tsx`**
- `@gorhom/bottom-sheet` full-height
- Sections: Duration | Total sets | Muscles trained today
- Muscle map (front + back toggle) colored by today's session
- "Save Workout" CTA → calls `workoutStore.finishWorkout()` → pops to tabs
- Spring entrance for each section (FadeInDown stagger, same delays as sleep cards)

**P2 Exit Criteria:**
```
[ ] Start → active screen transition works
[ ] Set rows: tap to complete, spring animation fires
[ ] Rest timer: appears on set complete, counts down, haptic on done
[ ] Exercise picker: search + category filter functional
[ ] Finish sheet: renders with session stats
[ ] Discard confirmation on back press
[ ] No direct Supabase calls from any component (store actions only)
[ ] npx tsc --noEmit — passes
[ ] npm run lint — passes
```

---

### P3 — Muscle Map + Analytics Cards

**Goal:** Muscle heatmap component wired to `computeMuscleHeatmap()` stub. Analytics cards below the weekly grid.

#### Files

**`apps/mobile/components/workout/MuscleMap.tsx`**
- Wraps `react-native-body-highlighter`
- Props: `heatmap: Record<MuscleGroup, MuscleIntensity>`, `side: 'front' | 'back'`, `size`
- Maps `MuscleIntensity` → `WORKOUT_THEME.muscle*` colors
- Front/back toggle button (animated flip: `withSpring` rotate + scale)
- Overtrained muscles pulse with amber (Reanimated loop animation)
- Loading skeleton: grey body silhouette with shimmer

**`apps/mobile/components/workout/WeeklyVolumeCard.tsx`**
- Same card anatomy as sleep cards (`SLEEP_LAYOUT.cardRadiusOuter/Inner`, `cardPadding`)
- Bar chart: Mon–Sun, each bar = total sets that day (victory-native)
- Total sets this week + delta vs last week (same delta pill as sleep hero)
- Colors: `WORKOUT_THEME.accent` for bars, `SLEEP_THEME.cardBg` background

**`apps/mobile/components/workout/MuscleBalanceCard.tsx`**
- Title: "Muscle Balance"
- Full-width muscle map (front + back side-by-side or toggle)
- Overtrain/undertrain callouts: pills listing e.g. "Chest — overtrained", "Hamstrings — neglected"
- Overtraining badge: amber pill (reads `isOvertrained()` stub)
- Neglected badge: dim pill (muscle not trained in 7+ days)

**`apps/mobile/components/workout/WorkoutSkeletons.tsx`**
- Skeleton variants for: hero, week grid, volume card, muscle balance card
- Same shimmer pattern as `SleepSkeletons.tsx` (`SLEEP_THEME.skeletonBase/skeletonHighlight`)

**P3 Exit Criteria:**
```
[ ] MuscleMap renders front/back, toggle animates
[ ] Heatmap reads computeMuscleHeatmap() (stub → all muscles dim = correct)
[ ] WeeklyVolumeCard renders (shows zeroes from stub — correct)
[ ] MuscleBalanceCard renders (no overtrain warnings from stub — correct)
[ ] Skeletons shown while isLoaded = false
[ ] All FadeInDown stagger animations firing on card entrance
[ ] npx tsc --noEmit — passes
[ ] npm run lint — passes
```

---

### P4 — Monthly "Wrapped" Summary

**Goal:** End-of-month summary bottom sheet. Spotify Wrapped-style animated reveal.

> **Note:** This stage requires real session data to look impressive. Build the shell now; populate with real data when backend is live.

**`apps/mobile/components/workout/MonthlyWrapSheet.tsx`**
- Full-screen bottom sheet (`snapPoints: ['100%']`)
- Animated sequence (each card slides/fades in on a stagger):
  1. "Month in Review" title + month name
  2. Total workouts count (number count-up animation)
  3. Total sets + PRs stat grid  
  4. Most trained muscle (large muscle highlight)
  5. Consistency ring (days worked out / days in month)
  6. "Your #1 exercise" card
- Confetti on open (react-native-confetti-cannon or simple particle system)
- Dismiss: swipe down or "Close" button
- Accessible from: long-press on month header in weekly grid

---

### P5 — Polish Pass

**Goal:** Match sleep screen quality bar. 120fps. Every interaction has haptic + animation response.

- [ ] All skeleton states tested (isLoaded = false)
- [ ] All empty states tested (no sessions)
- [ ] Haptics: set complete, rest timer done, workout saved, exercise added
- [ ] Spring config audit: no linear animations; all physics-based
- [ ] Gesture responsiveness: rest timer dismiss, sheet drag, set row swipe-to-delete
- [ ] Active workout screen: persists across tab switches (store-backed, not local state)
- [ ] Background timer: elapsed timer continues if user switches tabs (use Date.now diff, not interval state)
- [ ] workout.tsx cards: FadeInDown stagger delay matches sleep (220ms, 270ms, 320ms per card)

---

## Backend Contracts (Documented, Not Implemented)

### POST `/api/workout/sessions`
```ts
// Request body (WorkoutSessionSyncSchema):
{
  session: WorkoutSession  // full session including sets
}
// Response: { data: { id: string } }
// Auth: JWT required
// Idempotent: upsert by session.id
```

### GET `/api/workout/sessions/:userId`
```ts
// Query params: { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' }
// Response: { data: WorkoutSession[] }
// Auth: JWT required, userId must match req.user.id
```

### DELETE `/api/workout/sessions/:id`
```ts
// Response: 204 No Content
// Auth: JWT required, session must belong to req.user.id
```

---

## Database Schema (Documented, Not Migrated)

```sql
-- workout_sessions
CREATE TABLE workout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  date DATE NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  duration_seconds INT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- workout_exercise_logs
CREATE TABLE workout_exercise_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL,  -- references fixture, not a DB table
  exercise_order INT NOT NULL,
  notes TEXT
);

-- workout_sets
CREATE TABLE workout_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id UUID NOT NULL REFERENCES workout_exercise_logs(id) ON DELETE CASCADE,
  set_number INT NOT NULL,
  reps INT,
  weight_kg NUMERIC(6,2),
  duration_seconds INT,
  rpe NUMERIC(3,1),
  completed_at TIMESTAMPTZ NOT NULL
);

-- RLS: users can only SELECT/INSERT/UPDATE/DELETE their own sessions
```

---

## Validation Commands

```bash
# Type check
npx tsc --noEmit -p apps/mobile/tsconfig.json
npx tsc --noEmit -p services/api/tsconfig.json

# Lint
cd apps/mobile && npm run lint
cd services/api && npm run lint

# Tests (no new test files required — stubs are not testable yet)
npx jest apps/mobile/lib/__tests__
```

---

## Implementation Order

```
P0  Types + fixtures + store stub + backend stubs   (foundation, no visual output)
P1  Screen shell + weekly grid + tokens             (visual scaffold)
P2  Live workout flow                               (core feature, high dopamine loop)
P3  Muscle map + analytics cards                    (differentiation)
P4  Monthly wrapped sheet                           (delight, post-MVP polish)
P5  Full polish pass                               (quality bar)
```

**Start P0 only when this plan is approved.**
