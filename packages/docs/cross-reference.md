# Cross-Reference: API ↔ Mobile ↔ Stores

Read this file at the start of any task that touches both `services/api/` and `apps/mobile/`.
It replaces the need to trace imports across source files.

---

## Auth

**API module:** `services/api/src/modules/auth/`
**Mobile files:** `apps/mobile/lib/auth.tsx`, `apps/mobile/lib/passkey.ts`, `apps/mobile/store/authStore.ts`, `apps/mobile/components/auth/AuthSheet.tsx`
**Native bridge:** `apps/mobile/modules/credentials-auth/` (Android + iOS WebAuthn)

| Endpoint | Called from mobile |
|---|---|
| POST /api/auth/register/options | `lib/passkey.ts` |
| POST /api/auth/register/verify | `lib/passkey.ts` |
| POST /api/auth/login/options | `lib/passkey.ts` |
| POST /api/auth/login/verify | `lib/passkey.ts` |

**Auth flow:** `AuthSheet.tsx` → `lib/passkey.ts` → API → Supabase session → `authStore` (Zustand)
**Session:** Supabase JWT stored via `expo-secure-store`, attached to all API requests by `lib/api.ts`

---

## Sleep

**API module:** `services/api/src/modules/sleep/`
**Mobile files:** `apps/mobile/store/sleepStore.ts`, `apps/mobile/lib/api.ts`, `apps/mobile/app/(tabs)/sleep.tsx`
**Sleep engine:** `apps/mobile/lib/sleep*.ts` (15 modules — client-side only, never hits API)

| Endpoint | Called from mobile | Notes |
|---|---|---|
| POST /api/sleep/sync-batch | `sleepStore.sync()` | Offline queue flush — all writes go here |
| GET /api/sleep/:userId/timeline/:date | `lib/api.ts → fetchSleepTimeline()` | Premium only, `isPaidPlan` gate |

**Write flow:** Component → `sleepStore` action → AsyncStorage (offline cache) → sync queue → `POST /api/sleep/sync-batch` → Supabase
**Timeline flow:** `sleep.tsx` checks `isPaidPlan` → `fetchSleepTimeline()` in `lib/api.ts` → API → `hypnogramTimeline.ts` adapter → `SleepHypnogram` component
**Important:** Sleep scoring is 100% client-side (15 deterministic modules in `lib/sleep*.ts`). The API only stores/retrieves raw logs and timeline phases. Never call the sleep engine from the API side.

---

## Profile

**API module:** `services/api/src/modules/profile/`
**Mobile files:** `apps/mobile/store/profileStore.ts`, `apps/mobile/components/profile/EditProfileModal.tsx`, `apps/mobile/app/(tabs)/account.tsx`

| Endpoint | Called from mobile |
|---|---|
| GET /api/profile | `profileStore` on load |
| PATCH /api/profile | `profileStore` on update |

**Flow:** `account.tsx` / `EditProfileModal.tsx` → `profileStore` action → API → Supabase `user_profiles` table

---

## Workout

**API module:** `services/api/src/modules/workout/`
**Mobile files:** `apps/mobile/store/workoutStore.ts`, `apps/mobile/app/(tabs)/workout.tsx`, `apps/mobile/app/workout/active.tsx`, `apps/mobile/components/workout/*`

| Endpoint | Called from mobile |
|---|---|
| GET /api/workout/sessions/:userId | `workoutStore.fetchSessions` |
| POST /api/workout/sessions/sync | `workoutStore.drainSyncQueue` (offline batch) |
| DELETE /api/workout/sessions/:id | `workoutStore.removeSession` |

**Logging modes:** `workoutStore.loggingMode` (`quick` | `detailed`) drives `app/workout/active.tsx` layout. Quick mode → `QuickLogCard`. Detailed → `FocusCard` + plate calculator.
**Equipment filter:** `workoutStore.availableEquipment` is checked by `ExercisePickerSheet` via `filterExercisesByEquipment` from `lib/workoutFixtures`.
**Progressive overload:** `lib/workoutProgression.ts` is pure (no store coupling); `QuickLogCard` calls `suggestNextSession(sessionsForExercise, exerciseId)`.

See `packages/docs/mobile/workout.md` for full pillar details.

---

## Nutrition

**API module:** `services/api/src/modules/nutrition/`
**Mobile files:** `apps/mobile/store/nutritionStore.ts`, `apps/mobile/app/(tabs)/nutrition.tsx`, `apps/mobile/components/nutrition/*`, `apps/mobile/lib/nutritionTDEE.ts`
**Migration:** `services/supabase/migrations/20260505000000_create_nutrition_tables.sql` (`foods`, `nutrition_logs` with RLS + pg_trgm)

| Endpoint | Called from mobile |
|---|---|
| GET /api/nutrition/logs/:userId | `nutritionStore.fetchLogs` |
| POST /api/nutrition/logs/sync | `nutritionStore.drainSyncQueue` (offline batch, idempotent by client UUID) |
| DELETE /api/nutrition/logs/:id | `nutritionStore.removeLog` |
| GET /api/nutrition/foods/search | `nutritionStore.searchFoods` |
| GET /api/nutrition/foods/barcode/:code | `nutritionStore.lookupBarcode` |

**Selector rule:** Use `selectLogsForDate(date)` (stable empty-array ref). Compute macros via `useMemo(() => computeMacrosForLogs(logs), [logs])` — never as a Zustand selector (Zustand v5 unstable-selector loop).

See `packages/docs/mobile/nutrition.md`.

---

## Morning Brief (cross-pillar)

**Mobile-only.** Composes sleep/workout/nutrition state into a single `SleepInsight`-shaped card mounted at the top of the Workout and Nutrition tabs.

**Files:** `apps/mobile/lib/morningBrief.ts`, `morningBriefSelectors.ts`, `useMorningBrief.ts`, `apps/mobile/components/home/MorningBriefCard.tsx`

See `packages/docs/mobile/morning-brief.md`.

---

## Health Data (mobile-only, no API)

**Native module:** `apps/mobile/modules/health-connect/` (Android Health Connect bridge)
**Consumer:** `apps/mobile/lib/sleepAnalysis.ts` (uses health data as input to sleep score pipeline)

Health Connect data never leaves the device via API. It feeds the client-side sleep engine only. (The legacy empty `healthStore` has been removed.)

---

## Onboarding (mobile-only flow)

**Screens:** `apps/mobile/app/onboarding/` (activity, birthday, goal, health, height, sex, sport, username, weight)
**Component:** `apps/mobile/components/onboarding/OnboardingScreen.tsx` (shared layout)
**Writes to:** `profileStore` → `PATCH /api/profile` on completion

---

## Shared Types & Constants

**Shared package:** `packages/shared/src/` — imported as `@project-delta/shared` in both mobile and API
**Type files:**
- `packages/shared/src/types/sleep.ts` — sleep data types used by both sides
- `packages/shared/src/types/health.ts` — health data types
- `packages/shared/src/types/nutrition.ts` — nutrition types
- `packages/constants/src/` — sleep scoring constants (weights, norms)

**Rule:** If a type is used by both API and mobile, it lives in `packages/shared`. Never duplicate.

---

## Authenticated API Client (mobile)

All API calls from mobile go through `apps/mobile/lib/api.ts`:
- Attaches Supabase JWT from `authStore`
- 10-second timeout
- Zod-validates responses at the boundary
- Treats 404 as "no data yet" (not an error) for sleep timeline

Do not call `fetch()` directly from components or stores. Always go through `lib/api.ts`.
