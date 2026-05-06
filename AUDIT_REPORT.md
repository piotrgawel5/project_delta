# Workout MVP Audit Report

**Branch**: `feature/workout`
**Audited**: 2026-05-01
**Auditor**: Claude Opus 4.7
**Scope**: Phase 1 of `AUDIT_MASTER_PROMPT.md` — finish-button compliance, picker-sheet visibility, performance, security, and workflow.

---

## Summary table

| # | Issue | Severity | Location | Fix estimate |
|---|---|---|---|---|
| 1 | Add-Exercise CTA renders but is a fragile `position:absolute` sibling of `BottomSheetSectionList` — wrong gorhom pattern, drives the "invisible/untappable" symptom | **P0 Blocker** | `components/workout/ExercisePickerSheet.tsx:199-229` | 30 min |
| 2 | `requireOwnership` checks `req.body?.user_id` (snake_case) but the codebase is camelCase → middleware silently never fires on POST bodies | **P0 Blocker** | `middleware/authorization.ts:14` | 15 min |
| 3 | `(req as any).user` casts everywhere — violates "no `any`" rule and undermines route-handler type safety | **P1 Warning** | `modules/workout/workout.controller.ts:11,33`; `middleware/authorization.ts:13`; `auth.middleware.ts:51` | 30 min (typed `AuthenticatedRequest`) |
| 4 | `WorkoutFinishSheet` hardcodes `#30D158`, `#0A2415`, `#FFFFFF` and 6+ raw `rgba()` literals — violates "zero hardcoded hex" | **P1 Warning** | `components/workout/WorkoutFinishSheet.tsx:29-31, 339, 569, 696-720, 897-922, 968` | 20 min |
| 5 | Finish-sheet snap point `92%` ; design spec is `~87%` (`87% of 874 ≈ 760`) | **P3 Polish** | `WorkoutFinishSheet.tsx:144` | 1 min |
| 6 | `authLimiter` is 10 req/hr; audit prompt requested ≤5/hr | **P3 Info** | `middleware/rateLimiter.ts:57` | 1 min |
| 7 | Finish flow race: `router.back()` runs before `sheetRef.close()` — works but logs warnings on Android | **P3 Polish** | `app/workout/active.tsx:243-245` | 5 min |
| 8 | `discardWorkout` from finish flow may run on already-unmounted screen (state-after-navigate) | **P3 Polish** | `app/workout/active.tsx:245` | 5 min |
| 9 | Mobile test files reference deleted `sleepHypnogram` / `hypnogramTimeline` / `sleepChartUtils` modules — `tsc -p apps/mobile` fails | **P1 Warning** (unrelated to workout but blocks CI) | `apps/mobile/lib/__tests__/*` | 10 min |
| 10 | API base URL is hardcoded to `https://project-delta-3mqz.onrender.com`; no env-var fallback | **P3 Info** | `apps/mobile/lib/api.ts:7-14` | 10 min |

**Phase 1 verdict**: Two real P0s (one functional, one security defense-in-depth gap), four P1 design/type fixes, four P3 polish items. No memory leaks, no injection vectors, no data-exposure flaws.

---

## Detailed findings — top 5 blockers

### 1 — Add-Exercise CTA: wrong bottom-sheet pattern (P0)

**File**: `apps/mobile/components/workout/ExercisePickerSheet.tsx` lines 199-229.

The CTA is rendered as a `position: absolute, bottom: 0` `<View>` that is a direct sibling of `<BottomSheetSectionList>` inside `<BottomSheet>`. `@gorhom/bottom-sheet` does not guarantee that absolute siblings stack correctly above its scrollable list containers — on Android, the list's internal view has implicit elevation while the absolute wrap has none, so the list visually overlays the CTA. On iOS, the gradient overlay (rendered first inside `ctaWrap`) further reduces button visibility when no items are selected (`opacity: 0.4`).

The library ships a first-class API for this exact pattern: `<BottomSheetFooter>`, which renders inside the sheet's animation context and is automatically lifted above scrollable children. **Switch to `BottomSheetFooter`** rather than reaching for `zIndex`/`elevation` patches.

Verification path: open the picker, select 1 exercise, attempt to tap "Add to workout" near the bottom of the sheet. On Samsung Galaxy A-series the button is visually clipped or unresponsive. The Sleep tab doesn't hit this because its sheets use `BottomSheetView`, not `BottomSheetSectionList`.

**Remediation** — see `IMPLEMENTATION_PLAN.md` § P1.1 for the exact diff.

### 2 — `requireOwnership` middleware silently never fires on bodies (P0)

**File**: `services/api/src/middleware/authorization.ts:14`.

```ts
const requestedUserId = req.params.userId || req.body?.user_id;
```

The codebase is camelCase end-to-end (Zod schemas, mappers, mobile types). No request body in the workout, sleep, or profile modules contains `user_id` — they all use `userId`. The middleware therefore only ever guards `req.params.userId`, which is fine for `GET /api/workout/sessions/:userId` but the body branch is dead code that gives a false sense of defense-in-depth.

This isn't an exploitable hole today (workout `POST /sessions` doesn't use `requireOwnership`; ownership is checked in `save_workout_session()` SQL function). But the dead branch is a footgun: a future endpoint mounted with `requireOwnership` and a camelCase `userId` body field would fail-open. Fix: read `req.body?.userId`, drop the snake_case fallback, and add an explicit unit test.

### 3 — `(req as any).user` casts (P1)

**Files**: `workout.controller.ts:11,33`; `authorization.ts:13`; `auth.middleware.ts:51`; `rateLimiter.ts:8`.

Per `services/api/CLAUDE.md` and root `CLAUDE.md`, the API forbids `any`. Every handler that reads the authenticated user does so via `(req as any).user.id`. This breaks IDE autocomplete, hides refactor breakage, and means a typo like `req.user.uid` would compile cleanly.

Fix: declare a module-augmented `Express.Request.user` type once (`services/api/src/types/express.d.ts`) and remove every cast. ~7 sites change. See `CODE_SNIPPETS.md`.

### 4 — `WorkoutFinishSheet` hardcoded colors (P1)

**File**: `apps/mobile/components/workout/WorkoutFinishSheet.tsx`.

Direct violations of "zero hardcoded hex":
- Lines 29-31: `PR_GREEN = '#30D158'` (already in `WORKOUT_THEME.success`), plus two `rgba(48,209,88,...)` literals.
- Line 339: `color="#0A2415"` for the lightning-bolt glyph.
- Line 569: `'rgba(255,255,255,0.20)'` handle background.
- Lines 696-720: `'rgba(48,209,88,0.20)'`, glow effects.
- Lines 775-781, 897-922: `'rgba(255,255,255,0.05)'`, `'rgba(255,69,58,0.08)'`, etc.
- Line 968: `'#FFFFFF'` for confirm-discard text (should be `WORKOUT_THEME.fg`).

The handoff README explicitly maps every value to a `WORKOUT_THEME` token. `success` exists already; the only missing piece is a `successDim` variant (the 14% / 32% green tints used in the PR banner). Add to theme, then strip locals.

### 5 — Auth rate limiter exceeds requested ceiling (P3 info)

**File**: `services/api/src/middleware/rateLimiter.ts:57`.

```ts
export const authLimiter = rateLimit({ windowMs: 60*60*1000, max: 10, ... });
```

Audit prompt requested ≤5 req/hour for auth endpoints. Implementation is 10/hr, IP-keyed (correct, since pre-auth there is no user id to key on). Tightening to 5/hr is a one-line change but consider that 5/hr is aggressive for legitimate users mistyping passwords — recommend 5/hr for `verify` routes and 20/hr for `options` routes (which don't accept credentials).

---

## Audit checklist results

### 1.3 Performance (120Hz / 115fps floor)

| Check | Result |
|---|---|
| Reanimated 4 patterns (no `useNativeDriver: false`) | ✅ all `useSharedValue` + `useAnimatedStyle` |
| Animated properties limited to `transform`/`opacity` | ✅ no width/height/padding animation |
| Image rendering via `expo-image` | ⚠️ workout has no images — N/A |
| Lists use `FlatList`/`FlashList` | ✅ `BottomSheetSectionList` (picker), `ScrollView` (active session — fine, max ~20 exercises) |
| Granular Zustand selectors | ✅ every site uses `useWorkoutStore(s => s.field)` |
| No fetch waterfalls | ✅ `fetchSessions` + `drainSyncQueue` fired in parallel from `workout.tsx:47-49` |
| Bottom-sheet library | ✅ `@gorhom/bottom-sheet` only |
| Colors from theme | ⚠️ `WorkoutFinishSheet` regression (finding #4) |

**No fps-killing bottlenecks identified.** The picker `buildSections(query)` runs on every keystroke but iterates ~50 fixture entries — negligible. PR detection inside the finish sheet recomputes on `sessions` change but `useMemo`-gated and only mounts during finish.

### 1.4 Security

**Rate limiting** — global 100/15m, burst 10/10s, user-write 30/15m, user-read 100/15m, auth 10/hr (IP). All workout endpoints have `burstLimiter + userReadLimiter`/`userWriteLimiter`. ✅ except note in finding #6.

**Auth/Z**:
- Every workout route has `requireAuth` ✅
- `GET /sessions/:userId` adds `requireOwnership` ✅
- `POST /sessions` ownership enforced in `save_workout_session()` SQL (`p_session.userId === p_user_id` or RAISE 42501) ✅
- `DELETE /sessions/:id` fetches session first, compares `user_id` to authed user ✅
- `requireOwnership` body branch is dead code (finding #2)

**Data exposure** — every Supabase query either filters on `auth.uid()`-equivalent `userId` or operates inside the SECURITY DEFINER function. RLS policies enabled on all three workout tables (`20260418000000_create_workout_tables.sql:60-86`). Service role key bypasses RLS but ownership re-checked in queries. ✅

**Memory leaks** — `AppState` listener removed (`workout.tsx:56`); `discardArmed` setTimeout cleared (`WorkoutFinishSheet.tsx:163`); Reanimated values auto-clean. `lib/api.ts` does NOT abort fetches on unmount, but the 10s `setTimeout`-based abort always fires, so no leak (only delayed result discarded). ✅ (acceptable)

**Injection** — all queries use `.eq()`/`.gte()`/`.lte()`. The SQL function uses parameterized values via `jsonb` operators. `SECURITY DEFINER` is paired with `SET search_path = public, pg_catalog` ✅. Exercise names rendered as `<Text>` — no XSS surface.

**Supply chain** — not audited (out of scope for this pass).

### 1.5 Workflow & state

- `finishWorkout` correctly: appends to `sessions[]` (optimistic), pushes to `syncQueue`, sets `syncStatus: 'syncing'`, calls `drainSyncQueue`, throws if any session failed. ✅
- Finish sheet stays open on error (`syncStatus === 'error'` surfaces inline retry banner). ✅
- `activeSession` not cleared inside `finishWorkout` to prevent the active screen from unmounting mid-animation; cleared by `active.tsx:245` after `router.back()`. ✅ but ordering is fragile (finding #7).
- `AppState` listener triggers `drainSyncQueue` on foreground. ✅
- `syncQueue` and `activeSession` persisted to AsyncStorage via `partialize`. ✅
- PR detection (`detectSessionPRs`) correctly excludes the just-finished session by id (`workoutPRs.ts:43`). ✅

---

## Out-of-scope notes

- The mobile typecheck (`tsc --noEmit -p apps/mobile`) fails on three test files referencing deleted Sleep modules. Not a workout regression but blocks CI; flagged as #9 because it would block any "merge to main" gate.
- API base URL hardcoded to Render (#10) — fine for this branch but should land an env-var override before MVP launch so QA can hit a staging API.
- `AUDIT_MASTER_PROMPT.md` lists `/api/auth/login/verify` paths; the actual server mounts at `/auth/passkey/login/verify` and mobile calls match. Prompt is stale; no real bug.

---

**Phase 2 deliverable**: `IMPLEMENTATION_PLAN.md` (P0–P5 stages with concrete diffs). `CODE_SNIPPETS.md` carries the drop-in `Express.Request` type augmentation.
