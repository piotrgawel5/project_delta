# HypnogramChart Data Cutover Plan (Mock -> `sleep_phase_timeline`)

## Goal
Replace mock/generated data in `apps/mobile/components/sleep/dashboard/HypnogramChart.tsx` with real timeline data backed by Supabase table `public.sleep_phase_timeline` (via existing API contract).

## Context Built From Repo + Supabase MCP
- `HypnogramChart.tsx` currently generates random fallback stages in `displayStages` when `stages` is empty.
- `DailyHypnogramCard.tsx` also simulates hypnogram stages when no real stages are passed.
- Existing mobile API helper already exists: `apps/mobile/lib/api.ts` -> `fetchSleepTimeline(userId, date)`.
- Existing backend route already exists: `GET /sleep/:userId/timeline/:date`.
- Existing backend service already reads `sleep_phase_timeline` ordered by `start_time`.
- Supabase table confirmed via MCP:
  - `sleep_phase_timeline(id, sleep_data_id, user_id, cycle_number, stage, start_time, end_time, duration_minutes, confidence, generation_v, created_at)`
  - `stage` allowed: `awake | light | deep | rem`
  - RLS policy exists for authenticated user-owned reads/writes.
- Important repo reality: `HypnogramChart.tsx` currently has no references in `apps/mobile/app` (component appears currently unused in screen tree).

## Staged-Delivery Pre-Flight Declaration
- Stages needed: `P0`, `P1`, `P2`, `P3` (`P4/P5` optional).
- Files expected per stage are listed below.
- Validation commands for this repo:
  - Mobile lint: `cd apps/mobile && npm run lint`
  - Mobile typecheck: `cd apps/mobile && npx tsc --noEmit -p tsconfig.json`
  - API typecheck (only if touched): `cd services/api && npx tsc --noEmit -p tsconfig.json`
  - Mobile targeted tests: `cd apps/mobile && npx jest apps/mobile/lib/__tests__/hypnogramTimeline.test.ts`
- Ambiguity discovered from codebase:
  - `HypnogramChart.tsx` is not wired to any current screen. Data cutover can be completed at component/container level, but user-visible rollout needs explicit mounting target.

---

## P0 - Foundations (Types / Contracts / Scaffolding)
Goal: establish stable contracts for timeline -> chart input mapping, no business logic yet.

### Files
- `apps/mobile/lib/hypnogramTimeline.ts` (new scaffold)
- `apps/mobile/lib/__tests__/hypnogramTimeline.test.ts` (new scaffold with test cases skeleton)
- `apps/mobile/components/sleep/dashboard/HypnogramChart.tsx` (props contract update only)
- `apps/mobile/components/sleep/dashboard/DailyHypnogramCard.tsx` (prop/type wiring only)

### Required changes
1. Define a dedicated input contract for chart stages (or reuse existing one consistently):
   - `stage: 'awake' | 'rem' | 'light' | 'deep'`
   - `startTime: string`
   - `endTime: string`
   - `durationMin: number`
2. Define adapter input contract for API rows:
   - Use `SleepTimelineResponse['phases']` or `SleepPhaseTimelineRow[]` shape (`snake_case`).
3. Extend chart container props to support real fetching lifecycle:
   - `isLoading?: boolean`
   - `error?: string | null`
   - `stages` becomes data source of truth (no implicit random fallback contract).
4. Keep imports aligned with existing aliases (`@lib/*`, `@project-delta/shared`).

### Exit criteria
- `cd apps/mobile && npx tsc --noEmit -p tsconfig.json`
- `cd apps/mobile && npm run lint`

---

## P1 - Core Logic + Data Access (No UI Rendering Changes Yet)
Goal: implement pure mapping/sanitization logic from timeline rows to chart-ready stages.

### Files
- `apps/mobile/lib/hypnogramTimeline.ts`
- `apps/mobile/lib/__tests__/hypnogramTimeline.test.ts`
- (Optional only if needed) `apps/mobile/lib/api.ts` type refinement, not endpoint redesign

### Required changes
1. Implement pure adapter function:
   - Example: `mapTimelinePhasesToHypnogramStages(phases)`
   - Map:
     - `duration_minutes` -> `durationMin`
     - `start_time` -> `startTime`
     - `end_time` -> `endTime`
     - `stage` passthrough
2. Add sanitization:
   - Drop invalid rows (`end <= start`, negative duration, invalid stage).
   - Sort by `startTime` ascending.
   - Clamp tiny negatives from clock drift (if required by data quality).
3. Implement bounds helper:
   - Example: `deriveTimelineBounds(stages)` -> `{ startTime, endTime }`
   - Source of truth should be earliest start and latest end from sanitized rows.
4. Unit tests (happy path + edge cases):
   - Empty input -> empty output
   - Out-of-order rows -> sorted output
   - Invalid row dropped
   - Duration field mismatch handled deterministically (choose one rule and test it)

### Exit criteria
- `cd apps/mobile && npx tsc --noEmit -p tsconfig.json`
- `cd apps/mobile && npm run lint`
- `cd apps/mobile && npx jest apps/mobile/lib/__tests__/hypnogramTimeline.test.ts`

---

## P2 - UI Integration (Wire Real Data, Remove Mock Generation)
Goal: stop mock generation and feed chart from timeline fetched from backend/table path.

### Files
- `apps/mobile/components/sleep/dashboard/HypnogramChart.tsx`
- `apps/mobile/components/sleep/dashboard/DailyHypnogramCard.tsx`
- Screen/container where chart is mounted (currently none found; choose target before rollout)

### Required changes
1. `HypnogramChart.tsx`
   - Remove random fallback generation in `displayStages`.
   - Render from provided `stages` only.
   - Add explicit states:
     - loading skeleton/placeholder
     - empty state (`No timeline yet`)
     - error state (`Failed to load timeline`)
2. `DailyHypnogramCard.tsx`
   - Remove simulation path based on aggregate minutes.
   - Accept already-resolved timeline stages and pass through.
3. Container/screen wiring
   - Fetch via existing `fetchSleepTimeline(userId, date)`.
   - Map response with P1 adapter.
   - Pass mapped `stages`, derived bounds, and loading/error props into chart/card.
4. Keep premium gating consistent with existing app behavior:
   - Free plan must not expose timeline data render path.

### Exit criteria
- `cd apps/mobile && npx tsc --noEmit -p tsconfig.json`
- `cd apps/mobile && npm run lint`
- Manual smoke checks:
  - premium + timeline exists -> chart renders real data
  - premium + no rows -> empty state
  - fetch failure -> error state
  - free plan -> locked behavior unchanged

---

## P3 - Testing + Audit + Summary
Goal: verify cutover quality gates and document invariants.

### Required checks
1. `cd apps/mobile && npx tsc --noEmit -p tsconfig.json`
2. `cd apps/mobile && npm run lint`
3. `cd apps/mobile && npx jest apps/mobile/lib/__tests__/hypnogramTimeline.test.ts`
4. If any API files touched: `cd services/api && npx tsc --noEmit -p tsconfig.json`

### Required deliverables
1. Implementation summary
2. Invariant checklist:
   - No random/mock generation remains in `HypnogramChart.tsx`
   - Timeline data source = API response backed by `sleep_phase_timeline`
   - Stage/time mapping is deterministic and tested
   - Loading/empty/error paths render correctly
3. Residual risks list
4. `context.md` status:
   - `context.md update not required — no structural or convention changes.` (unless mounting location introduces new architecture convention)

---

## P4 - Hardening (Optional but Recommended)
Use if timeline generation can lag behind sleep record writes.

### Suggested hardening tasks
1. Keep lightweight retry/backoff in container (similar to current Sleep tab timeline pattern).
2. Guard duplicate requests for same `userId/date`.
3. Add stale-response cancellation guard to avoid race conditions when date changes quickly.

### Validation
- Targeted test(s) for adapter remain green.
- Manual rapid date-switch test confirms no wrong-day chart flashes.

---

## P5 - Rollout / Observability (Optional)
1. Add structured logs for timeline fetch outcome (`hit/empty/error`).
2. Add temporary metric counters for empty timeline rate after rollout.
3. Remove dead mock utilities after stabilization window.

---

## Concrete File Checklist
- [ ] `apps/mobile/lib/hypnogramTimeline.ts` (new adapter + bounds logic)
- [ ] `apps/mobile/lib/__tests__/hypnogramTimeline.test.ts` (new tests)
- [ ] `apps/mobile/components/sleep/dashboard/HypnogramChart.tsx` (remove mock path, states)
- [ ] `apps/mobile/components/sleep/dashboard/DailyHypnogramCard.tsx` (remove simulation path)
- [ ] Chart container screen/component (mount point) wiring to `fetchSleepTimeline`
- [ ] Optional cleanup: `apps/mobile/lib/sleepTransform.ts` if no longer needed

## Out-of-Scope Observations (Deferred)
1. `HypnogramChart.tsx` appears unmounted in current app routing; rollout target needs explicit selection.
2. There is another timeline visualization path in active Sleep tab (`SleepHypnogram` + `MOCK_HYPNOGRAM`) that is separate from this dashboard chart and may need its own cutover task.
