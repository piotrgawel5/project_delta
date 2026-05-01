# Master Prompt for Claude Opus 4.7: Workout Page MVP Audit & Implementation Plan

## Context: Project Delta

You are auditing and planning fixes for **Project Delta** — a sleep, workout, and nutrition tracking monorepo (Expo 54 React Native, TypeScript, Zustand, NativeWind).

**Working Directory**: `S:\DEV\project_delta`  
**Current Branch**: `feature/workout`  
**MVP Goal**: Make the workout page fully functional and production-ready.

### Key Project Files
- Root architecture: `packages/docs/context.md`
- Mobile guide: `apps/mobile/CLAUDE.md`
- API guide: `services/api/CLAUDE.md`
- Shared types: `packages/shared/CLAUDE.md`
- **Theme tokens**: `apps/mobile/constants/theme.ts` (source of truth for all colors, spacing, fonts)
- **Design system guide**: `packages/docs/mobile/design-system.md`

---

## Phase 1: Audit (Comprehensive)

### 1.1 Finish Workout Button
**Status**: Not following design guidelines.  
**Action**: 
- Read the design handoff at: `C:\Users\Piotr\Downloads\Project Delta Design System (1)\design_handoff_workout`
- Compare the actual implementation in `apps/mobile/components/workout/WorkoutFinishSheet.tsx`
- Flag all deviations from the design (spacing, typography, colors, animations, touch target size)
- Check that the button is wired to the correct action (does it actually finish the workout in state + API?)
- Verify the sheet animation follows `@react-native-reanimated/v4` patterns (no `useNativeDriver: false`)

### 1.2 Add Exercise Bottom Sheet Button Invisible
**Status**: Button is not visible (doesn't exist or is off-screen).  
**Action**:
- Inspect `apps/mobile/components/workout/ExercisePickerSheet.tsx`
- Check layout: is the button rendered? Is it inside a ScrollView that clips it? Is overflow hidden?
- Check z-index / stacking context: does the sheet have proper `zIndex` positioning?
- Check dimensions: is the button width/height 0 or negative? Is it positioned off-screen?
- Verify touch target size meets accessibility standard (min 48px on both axes)
- Test on both iOS and Android (different layout engines may hide it differently)

### 1.3 Performance Audit (120Hz Device, 115fps+ Floor)
**Target Device**: Samsung Galaxy A-series (mid-range Android, 120Hz display)  
**Requirement**: FPS must never drop below 115 on any workout flow.

**Audit Checklist**:
- [ ] Reanimated animations: Are they using `useSharedValue` + `useAnimatedStyle`? (No `useNativeDriver: false`)
- [ ] SVG muscle map: Are gradients correctly applied to `<Rect>` not `<Line>`? Is bounding box correct?
- [ ] Image rendering: Uses `expo-image`? No `Image` from React Native?
- [ ] List rendering: Does the exercise list use `FlatList` or `FlashList`? Any inline functions in `renderItem`?
- [ ] State updates: Does Zustand use granular selectors (`useSleepStore(s => s.field)`) not full store (`useSleepStore()`)?
- [ ] Network waterfalls: Are calls batched with `Promise.all` in Zustand, not chained in `useEffect`?
- [ ] Animations: Are only `transform`, `opacity` animated? Never `width`, `height`, `padding`?
- [ ] Bottom sheets: Uses only `@gorhom/bottom-sheet`? Any conflicting gesture handlers?
- [ ] Colors: Are all colors from `SLEEP_THEME` in `apps/mobile/constants/theme.ts`? Any hardcoded hex?

**Deliverable**: List of FPS-killing bottlenecks with line numbers.

### 1.4 Security Audit (All Issues = MVP Blockers)
**Audit Checklist**:

#### Rate Limiting
- [ ] Is `/api/sleep/sync-batch` rate-limited? Check `services/api/middleware/rateLimiter.ts`
- [ ] Are auth endpoints rate-limited separately? (`/api/auth/login/verify`, `/api/auth/register/verify`)
- [ ] Limit should be ≤5 req/hour for auth, ≤100 req/15min global

#### Authentication & Authorization
- [ ] Does every non-public API route have `authenticate` middleware?
- [ ] Does every route validate `req.user.id` to prevent user-enumeration / privilege escalation?
- [ ] Are JWT tokens validated on every request? (Check `services/api/middleware/authorization.ts`)
- [ ] Are refresh tokens secure? (Check storage in mobile: should be AsyncStorage + encrypted)

#### Data Exposure
- [ ] Does the workout endpoint expose other users' data? Check WHERE clauses in Supabase queries.
- [ ] Are RLS (Row-Level Security) policies enabled on all tables? Check `services/supabase/migrations/`
- [ ] Is sensitive data (scores, PRs, volume) filtered by `userId` before returning?

#### Memory Leaks
- [ ] Do event listeners / timers in components have cleanup? (useEffect return function)
- [ ] Are subscriptions to Zustand store unsubscribed? (selectors don't prevent leaks, but unmounting should clean)
- [ ] Are REST calls aborted if component unmounts? (Check `lib/api.ts` for AbortController)
- [ ] Are animations cleaned up? (Reanimated should auto-cleanup, but check for manual `.setValue()` in effects)

#### Injection Attacks
- [ ] Is any user input interpolated into SQL? (Should never happen — use Supabase `.eq()` not string concat)
- [ ] Are exercise names / set descriptions HTML-escaped before rendering? (Check components)
- [ ] Are API responses validated with Zod before use? (Check `lib/api.ts` boundary validation)

#### Supply Chain / Dependencies
- [ ] Any outdated critical packages? (`npm audit` output)
- [ ] Are secrets stored in `.env` or `config/index.ts` (NOT in code)?
- [ ] Is the API Dockerfile multi-stage? (Doesn't leak node_modules into final image)

**Deliverable**: List of security vulnerabilities with severity + CVSS score if applicable. **Any blocker must be detailed with remediation steps.**

### 1.5 Workflow & State
- [ ] Does finishing a workout properly update Zustand `workoutStore`?
- [ ] Is the sync queue triggered? (Should batch to `POST /api/workout/sync-batch` if it exists, or similar)
- [ ] Does the UI optimistically update or wait for API response?
- [ ] Are errors handled gracefully? (Offline workout saved locally?)

---

## Phase 2: Implementation Plan (Staged Delivery)

Using **staged-delivery-workflow**, break fixes into **P0–P5 stages**:

### P0: Blockers (Security + Crashes)
- List every security issue from 1.4 that prevents MVP launch
- For each: precise remediation (code location, what to change)

### P1: Core Functionality
- Finish workout button: Fix rendering + wiring + design compliance
- Add exercise button: Fix visibility (layout, z-index, or rendering)

### P2: Performance
- FPS bottlenecks: Optimize rendering, animations, state selectors
- List changes with expected FPS improvement

### P3: Polish & Design
- Typography, spacing, colors to match design handoff
- Animations (spring, timing, easing)
- Touch feedback (haptics, scale on press)

### P4: Testing & Validation
- Unit tests for new logic
- Manual smoke test on 120Hz Samsung device (record FPS with DevTools)

### P5: Deployment
- Merge strategy, PR checklist, post-launch monitoring

---

## Output Format

**For 1M Token Window Efficiency**:

1. **AUDIT_REPORT.md** (max 2000 words)
   - Summary table: Issue → Severity → Location → Fix Estimate
   - Detailed findings for top 5 blockers

2. **IMPLEMENTATION_PLAN.md** (max 3000 words)
   - P0–P3 stages with concrete code locations
   - For each stage: Files to modify, pseudocode, dependencies
   - Validation checklist per stage

3. **CODE_SNIPPETS.md** (if applicable)
   - Drop-in fixes for minor issues
   - Animation patterns to copy-paste

---

## Critical Constraints

### Non-Negotiable Rules (from CLAUDE.md)
- **Colors**: All from `SLEEP_THEME` in `apps/mobile/constants/theme.ts`. Zero hardcoded hex.
- **Spacing**: `SLEEP_LAYOUT` tokens. Outer radius = inner radius + padding.
- **Fonts**: `SLEEP_FONTS` (DMSans only). No System or Inter.
- **Animations**: Reanimated 4 only. Never animate width/height/padding — use `transform`.
- **SVG**: Gradients on `<Rect>`, never `<Line>`. Bounding box must be correct.
- **Fetch**: No waterfalls. Batch in Zustand with `Promise.all`.
- **State**: Granular selectors only. No full-store subscriptions.
- **Types**: No `any`. Validate with Zod at boundaries.
- **Security**: `authenticate` middleware on every non-public route. `validate(Schema)` before use. `asyncHandler` on all async handlers.

---

## Resources You'll Need

```
# Type-check mobile
npx tsc --noEmit -p apps/mobile/tsconfig.json

# Type-check API
npx tsc --noEmit -p services/api/tsconfig.json

# Run tests
npx jest apps/mobile/lib/__tests__

# Start dev server (to inspect runtime behavior)
cd apps/mobile && npm run start
```

---

## Design Files Reference

- **Path**: `C:\Users\Piotr\Downloads\Project Delta Design System (1)\design_handoff_workout`
- **Read these files**: Look for finish button specs, exercise picker sheet layout, colors, spacing, animations
- **Translate to React Native**: The .jsx/.html files show the target UI — adapt their layout/spacing to NativeWind classes and Reanimated

---

## Next Steps (After This Audit)

1. Read this entire prompt
2. Run the Phase 1 audit on the codebase (read files, check for issues)
3. Compile findings into AUDIT_REPORT.md
4. Use **staged-delivery-workflow** skill to create IMPLEMENTATION_PLAN.md
5. Output both reports + code snippets
6. **Do NOT implement yet** — just plan. The user will review and approve before you code.

---

## Questions to Guide Your Audit

- Where is the button defined that's not visible? (Search `ExercisePickerSheet.tsx`)
- What layout system is it using? (View, Pressable, or custom wrapper?)
- Is it inside a ScrollView that clips overflow?
- Does the design handoff show where it should be positioned?
- For performance: which component re-renders most frequently during an active workout?
- For security: what happens if I fetch `/api/workout/456` when logged in as user 789?

---

## Success Criteria

✅ Audit identifies every issue blocking MVP  
✅ Plan is staged P0–P5 with clear remediation steps  
✅ Performance & security issues have root cause + fix  
✅ All locations referenced with file:line numbers  
✅ Plan fits in 1M token window for easy handoff to implementation  

---

**You are Claude Opus 4.7. Conduct this audit thoroughly, then produce the plan. Begin with Phase 1.**
