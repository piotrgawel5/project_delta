# Workout MVP Implementation Plan

**Branch**: `feature/workout`
**Source audit**: `AUDIT_REPORT.md` (this folder)
**Workflow**: staged-delivery — validate after every stage before progressing.

Per `AUDIT_MASTER_PROMPT.md`: **plan only**. Do not begin implementation until the user reviews and approves.

---

## P0 — Blockers (security defense + functional break)

### P0.1 — Fix `requireOwnership` body branch

**File**: `services/api/src/middleware/authorization.ts`
**Why**: Dead branch reads `req.body?.user_id` (snake_case) in a camelCase codebase. Future endpoint added with this guard would fail-open on body-keyed checks.

```ts
// Before
const requestedUserId = req.params.userId || req.body?.user_id;

// After
const requestedUserId = req.params.userId ?? req.body?.userId;
```

**Validation**:
- `npx tsc --noEmit -p services/api/tsconfig.json` — clean.
- Add `services/api/src/middleware/__tests__/authorization.test.ts` covering: matching userId in params (next), mismatching params (403), matching userId in body (next), missing entirely (next), missing user (401).

### P0.2 — Add Exercise CTA: switch to `BottomSheetFooter`

**File**: `apps/mobile/components/workout/ExercisePickerSheet.tsx`
**Why**: Absolute-positioned siblings of `BottomSheetSectionList` are the canonical anti-pattern documented in `@gorhom/bottom-sheet`. The library ships `BottomSheetFooter` for sticky CTAs that lift above scrollable lists across iOS+Android.

**Diff outline**:

```tsx
import BottomSheet, {
  BottomSheetFooter,
  BottomSheetSectionList,
  BottomSheetTextInput,
  type BottomSheetFooterProps,
} from '@gorhom/bottom-sheet';

// Inside component, define the footer renderer. useCallback to avoid recreating
// it on every keystroke (which would defeat gorhom's internal memoization).
const renderFooter = useCallback(
  (props: BottomSheetFooterProps) => (
    <BottomSheetFooter {...props} bottomInset={0}>
      <View style={styles.ctaWrap}>
        <LinearGradient
          colors={['rgba(14,14,16,0)', 'rgba(14,14,16,0.96)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.4 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <AnimatedPressable
          onPressIn={() => { ctaScale.value = withTiming(0.97, { duration: 100 }); }}
          onPressOut={() => { ctaScale.value = withTiming(1, { duration: 100 }); }}
          onPress={handleAdd}
          disabled={selected.length === 0}
          style={[styles.cta, selected.length === 0 && styles.ctaDisabled, ctaStyle]}>
          <View style={styles.ctaLeft}>
            <View style={styles.ctaCount}>
              <Text style={styles.ctaCountText}>{selected.length}</Text>
            </View>
            <Text style={styles.ctaText}>Add to workout</Text>
          </View>
          <MaterialCommunityIcons name="arrow-right" size={17} color={WORKOUT_THEME.bg} />
        </AnimatedPressable>
      </View>
    </BottomSheetFooter>
  ),
  [selected.length, handleAdd, ctaScale, ctaStyle],
);

return (
  <BottomSheet
    ref={sheetRef}
    index={-1}
    snapPoints={snapPoints}
    enablePanDownToClose
    backgroundStyle={styles.sheetBg}
    handleIndicatorStyle={styles.handleIndicator}
    footerComponent={renderFooter}>
    {/* ...existing sheet body, MINUS the old ctaWrap block at the bottom */}
  </BottomSheet>
);
```

Update styles:
```ts
ctaWrap: {
  paddingHorizontal: 16,
  paddingTop: 22,
  paddingBottom: 22,
  // remove position/left/right/bottom — footer handles positioning
},
```

`listContent.paddingBottom` can drop from 110 to ~24; `BottomSheetFooter` automatically reserves space.

**Validation**:
- Smoke on iOS Simulator + Android emulator: open picker, select 2 exercises, verify CTA visible at all snap positions and tappable.
- Verify gradient fade still reads cleanly above the last list row.
- Manual on Samsung Galaxy A-series device (the 120Hz target): confirm 60fps+ during sheet drag while CTA is visible.

---

## P1 — Core functionality + design compliance

### P1.1 — `Express.Request` user typing (kill `(req as any)`)

**Files**:
- `services/api/src/types/express.d.ts` (new — see `CODE_SNIPPETS.md`)
- `services/api/src/middleware/authorization.ts:13`
- `services/api/src/middleware/rateLimiter.ts:8`
- `services/api/src/modules/auth/auth.middleware.ts:51`
- `services/api/src/modules/workout/workout.controller.ts:11,33`
- Any other handler reading `req.user`

**Validation**:
- `npx tsc --noEmit -p services/api/tsconfig.json` — clean.
- Grep `(req as any)` across `services/api` — should return zero results in workout/auth scopes.

### P1.2 — `WorkoutFinishSheet` color/token cleanup

**File**: `apps/mobile/components/workout/WorkoutFinishSheet.tsx`
**Plus**: `apps/mobile/constants/theme.ts` — add tinted PR variants.

Add to `WORKOUT_THEME`:
```ts
// PR banner tints (the only place green appears)
successBg:     'rgba(48,209,88,0.14)',
successBorder: 'rgba(48,209,88,0.32)',
successGlow:   'rgba(48,209,88,0.20)',
successInk:    '#0A2415',  // glyph-on-success contrast
// destructive tints
dangerBgSoft:    'rgba(255,69,58,0.08)',
dangerBorderSoft:'rgba(255,69,58,0.24)',
dangerBorderHot: 'rgba(255,69,58,0.32)',
// utility surface tints
overlayWhite05:  'rgba(255,255,255,0.05)',
overlayWhite06:  'rgba(255,255,255,0.06)',
overlayWhite16:  'rgba(255,255,255,0.16)',
handleBg:        'rgba(255,255,255,0.20)',
```

Then in `WorkoutFinishSheet.tsx`:
- Delete the local `PR_GREEN`, `PR_GREEN_BG`, `PR_GREEN_BORDER` constants.
- Replace every literal with the corresponding `WORKOUT_THEME.*` token.
- `confirmDiscardText.color: '#FFFFFF'` → `WORKOUT_THEME.fg`.
- Lightning glyph color → `WORKOUT_THEME.successInk`.

**Validation**:
- `grep -nE "rgba|#[0-9A-Fa-f]{3,8}" apps/mobile/components/workout/WorkoutFinishSheet.tsx` — should return only token references in imports.
- Visual diff against `Finish Sheet.html` mock — colors unchanged.

### P1.3 — Mobile test files referencing deleted modules

**Files**:
- `apps/mobile/lib/__tests__/hypnogramTimeline.test.ts` — delete or update import to `sleepTimeline`.
- `apps/mobile/lib/__tests__/sleepHypnogram.test.ts` — delete or update.
- `apps/mobile/lib/__tests__/sleepWeeklyInsights.test.ts:8` — replace `../sleepChartUtils` import with current source.

**Validation**:
- `npx tsc --noEmit -p apps/mobile/tsconfig.json` — clean.
- `npx jest apps/mobile/lib/__tests__` — green.

---

## P2 — Performance

No FPS-killing bottlenecks were identified in audit. Two optional tightenings if profiling on Samsung Galaxy A reveals frame drops:

### P2.1 — Memoize finish-sheet PR computation upstream

The finish sheet subscribes to the entire `sessions` array. Acceptable today, but if `sessions` ever exceeds ~500 items (90-day default × heavy users), consider a `useWorkoutStore` derived selector that returns a `Map<exerciseId, prevBestKg>` updated on `fetchSessions`/`finishWorkout`. The finish sheet then only re-renders when its specific exercise PRs shift.

**Validation**: Flipper / Reanimated's profile mode → confirm finish-sheet first paint <16ms on Samsung Galaxy A.

### P2.2 — Active screen → `FlatList` if exercise count > 30

`app/workout/active.tsx:184` maps `activeSession.exercises` inside a `ScrollView`. Typical session has <10 exercises; not worth refactoring now. Flag for future if power users push >30.

---

## P3 — Polish

### P3.1 — Finish-sheet snap point

**File**: `apps/mobile/components/workout/WorkoutFinishSheet.tsx:144`
```ts
const snapPoints = useMemo(() => ['87%'], []);
```
Matches the design handoff (~87% of viewport).

### P3.2 — Tighten `authLimiter`

**File**: `services/api/src/middleware/rateLimiter.ts:57`

Split into two limiters:
```ts
export const authVerifyLimiter = rateLimit({ windowMs: 60*60*1000, max: 5, /* ... */ });
export const authOptionsLimiter = rateLimit({ windowMs: 60*60*1000, max: 20, /* ... */ });
```

In `auth.routes.ts`, apply `authVerifyLimiter` to `/passkey/register/verify`, `/passkey/login/verify`, `/email/login`, `/email/signup`, `/google/login`. Keep `authOptionsLimiter` (or the existing `authLimiter`) on `/passkey/*/options`.

### P3.3 — Active-screen finish flow ordering

**File**: `apps/mobile/app/workout/active.tsx:238-249`

Today: `await finishWorkout(metadata); router.back(); discardWorkout();` — sheet's own `handleSave` then calls `sheetRef.current?.close()` AFTER the screen has navigated. Works but emits Android warnings.

Recommended sequencing inside `WorkoutFinishSheet.handleSave` already calls `sheetRef.current?.close()` synchronously. The screen-side `onSave` should:

```ts
onSave={async (metadata) => {
  try {
    await finishWorkout(metadata);
    discardWorkout();        // Clear store BEFORE leaving the screen
    router.back();           // Navigate last so sheet's own close() lands cleanly
  } catch {
    // sheet stays open with inline error
  }
}}
```

**Validation**: Save a workout on Android, watch logcat for `setState on unmounted component` warnings — should be gone.

---

## P4 — Testing & validation

### P4.1 — Unit tests
- `authorization.test.ts` (P0.1).
- `WorkoutFinishSheet` token-coverage snapshot (one assertion per `WORKOUT_THEME.*` reference site, to lock the design system).

### P4.2 — Manual smoke (Samsung Galaxy A-series, 120Hz)
Run through with React Native Performance Monitor open:
1. Start workout → fps stays ≥118 during card entry animations.
2. Add 5 exercises via picker → CTA visible & tappable, sheet drag at 60fps+.
3. Log 4 sets per exercise → focus card pulse animation hits target frame.
4. Pause/resume mid-set → no jank.
5. Tap Finish → finish sheet opens; PR banner renders if PRs detected.
6. Save → optimistic history update → drain to API → finish sheet closes → land on Home.
7. Force airplane mode, finish another workout → enters `syncQueue`, error banner appears, retry succeeds when reconnected.
8. Background app for 30s, foreground → `AppState` listener drains queue.

Record FPS minima per step; any sub-115 result blocks merge.

### P4.3 — Backend
- `npx tsc --noEmit -p services/api/tsconfig.json` — clean.
- Hit `/api/workout/sessions/:wrong-uuid` as another user → expect 403.
- Replay POST /sessions with same `session.id` → idempotent, no duplicate logs/sets (verified by `save_workout_session` `DELETE FROM workout_exercise_logs` step).

---

## P5 — Deployment

### P5.1 — Merge strategy
- Squash-merge `feature/workout` into `main` once P0–P3 land + P4 green.
- PR description must include iOS + Android screenshots of: Home, Active, Picker, Finish (4 shots × 2 platforms).

### P5.2 — Post-launch monitoring
- Watch Render API logs for `Failed to save workout session` over 24h.
- Sentry (if wired) for any `setState on unmounted` warnings — should be zero post-P3.3.
- If PR-detection cost grows on heavy users (`sessions.length > 500`), promote P2.1 from optional to required.

### P5.3 — Schedule cleanup follow-up
After two weeks of soak, schedule a one-time agent to:
- Audit any new hardcoded hex introduced.
- Verify `(req as any)` count stayed at zero.
- Pull Sentry stats for finish-flow errors.

(Use `/schedule` once this PR merges.)

---

## Dependencies between stages

```
P0.1 (auth fix) ──▶ P4.1 (auth tests)
P0.2 (CTA fix)  ──▶ P4.2 manual smoke step 2
P1.1 (typing)   ──▶ P1.2 + P3.2 (cleaner sites)
P1.2 (theme)    ──▶ P4.1 token snapshot
P1.3 (tests)    ──▶ blocks merge gate
P3.x            ──▶ independent
```

P0 and P1 can run in parallel branches; P2 deferred unless profiling demands it; P3 lands after P1 to avoid merge churn on the same files.

---

**Total estimated effort**: 4–6 hours focused work for P0–P3.
**Validation overhead**: ~2 hours including device smoke pass.
