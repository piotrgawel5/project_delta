# Code snippets — drop-in fixes

Companion to `AUDIT_REPORT.md` and `IMPLEMENTATION_PLAN.md`. Apply only after the user approves the plan.

---

## 1 — `Express.Request.user` type augmentation (P1.1)

**New file**: `services/api/src/types/express.d.ts`

```ts
import type { User } from "@supabase/supabase-js";

declare global {
  namespace Express {
    interface Request {
      user?: User;
      requestId?: string;
    }
  }
}

export {};
```

Ensure `services/api/tsconfig.json` `include` covers `src/**/*.ts` (already does). Then strip every `(req as any)`:

```ts
// Before
const userId = (req as any).user.id as string;
// After
const userId = req.user!.id;  // requireAuth has already run; safe
```

If you want to avoid the non-null assertion, narrow with a typed handler wrapper or split request types via overloads. Module augmentation is sufficient for MVP.

---

## 2 — `requireOwnership` camelCase fix (P0.1)

**File**: `services/api/src/middleware/authorization.ts`

```ts
import { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/AppError";

export function requireOwnership(req: Request, _res: Response, next: NextFunction) {
  const user = req.user;
  if (!user?.id) throw AppError.unauthorized("Authentication required");

  const requestedUserId = req.params.userId ?? (req.body as { userId?: string } | undefined)?.userId;
  if (!requestedUserId) return next();

  if (user.id !== requestedUserId) {
    throw AppError.forbidden("You can only access your own data");
  }
  next();
}
```

**Test scaffold** (`services/api/src/middleware/__tests__/authorization.test.ts`):

```ts
import { requireOwnership } from "../authorization";
import { AppError } from "../../utils/AppError";

const mkReq = (overrides: Partial<{ user: { id: string }; params: any; body: any }> = {}): any => ({
  user: undefined,
  params: {},
  body: {},
  ...overrides,
});

describe("requireOwnership", () => {
  it("401 when no user", () => {
    const next = jest.fn();
    expect(() => requireOwnership(mkReq(), {} as any, next)).toThrow(AppError);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next when no userId to check", () => {
    const next = jest.fn();
    requireOwnership(mkReq({ user: { id: "u1" } }), {} as any, next);
    expect(next).toHaveBeenCalled();
  });

  it("calls next when params.userId matches", () => {
    const next = jest.fn();
    requireOwnership(mkReq({ user: { id: "u1" }, params: { userId: "u1" } }), {} as any, next);
    expect(next).toHaveBeenCalled();
  });

  it("403 when params.userId mismatches", () => {
    const next = jest.fn();
    expect(() =>
      requireOwnership(mkReq({ user: { id: "u1" }, params: { userId: "u2" } }), {} as any, next),
    ).toThrow(AppError);
  });

  it("calls next when body.userId matches (camelCase)", () => {
    const next = jest.fn();
    requireOwnership(mkReq({ user: { id: "u1" }, body: { userId: "u1" } }), {} as any, next);
    expect(next).toHaveBeenCalled();
  });

  it("403 when body.userId mismatches (camelCase)", () => {
    const next = jest.fn();
    expect(() =>
      requireOwnership(mkReq({ user: { id: "u1" }, body: { userId: "u2" } }), {} as any, next),
    ).toThrow(AppError);
  });
});
```

---

## 3 — `BottomSheetFooter` swap for `ExercisePickerSheet` (P0.2)

Full diff to `apps/mobile/components/workout/ExercisePickerSheet.tsx`:

Imports — add `BottomSheetFooter` and its props type:
```ts
import BottomSheet, {
  BottomSheetFooter,
  BottomSheetSectionList,
  BottomSheetTextInput,
  type BottomSheetFooterProps,
} from '@gorhom/bottom-sheet';
```

Inside the component, before `return`:
```tsx
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
```

Update the `BottomSheet` element:
```tsx
<BottomSheet
  ref={sheetRef}
  index={-1}
  snapPoints={snapPoints}
  enablePanDownToClose
  backgroundStyle={styles.sheetBg}
  handleIndicatorStyle={styles.handleIndicator}
  footerComponent={renderFooter}>
  {/* ...existing children, REMOVE the old <View pointerEvents="box-none" style={styles.ctaWrap}> block at the end */}
</BottomSheet>
```

Update styles:
```ts
ctaWrap: {
  paddingHorizontal: 16,
  paddingTop: 22,
  paddingBottom: 22,
  // dropped: position, left, right, bottom
},
listContent: {
  paddingBottom: 24,  // was 110 — footer now reserves its own space
},
```

---

## 4 — Theme additions for `WorkoutFinishSheet` cleanup (P1.2)

Append to `WORKOUT_THEME` in `apps/mobile/constants/theme.ts`:

```ts
// PR / success tints — only for PR celebrations
successBg:       'rgba(48,209,88,0.14)',
successBorder:   'rgba(48,209,88,0.32)',
successGlow:     'rgba(48,209,88,0.20)',
successInk:      '#0A2415',  // glyph contrast on solid success bg

// Destructive tints — only for discard flow
dangerBgSoft:    'rgba(255,69,58,0.08)',
dangerBorderSoft:'rgba(255,69,58,0.24)',
dangerBorderHot: 'rgba(255,69,58,0.32)',
dangerBgHot:     'rgba(255,69,58,0.12)',

// Surface overlays
overlayWhite03:  'rgba(255,255,255,0.03)',
overlayWhite05:  'rgba(255,255,255,0.05)',
overlayWhite06:  'rgba(255,255,255,0.06)',
overlayWhite16:  'rgba(255,255,255,0.16)',
handleBg:        'rgba(255,255,255,0.20)',
```

Then in `WorkoutFinishSheet.tsx`:

Delete:
```ts
const PR_GREEN = '#30D158';
const PR_GREEN_BG = 'rgba(48,209,88,0.14)';
const PR_GREEN_BORDER = 'rgba(48,209,88,0.32)';
```

Replace styles (showing key lines only):
```ts
handle: { backgroundColor: WORKOUT_THEME.handleBg, /* ... */ },
prBanner: { backgroundColor: WORKOUT_THEME.successBg, borderColor: WORKOUT_THEME.successBorder, /* ... */ },
prBannerGlow: { backgroundColor: WORKOUT_THEME.successGlow, /* ... */ },
prTile: { backgroundColor: WORKOUT_THEME.success, shadowColor: WORKOUT_THEME.success, /* ... */ },
prCount: { color: WORKOUT_THEME.success, /* ... */ },
prPill: { backgroundColor: WORKOUT_THEME.successBg, borderColor: WORKOUT_THEME.successBorder },
prPillText: { color: WORKOUT_THEME.success, /* ... */ },
rpeBtn: { backgroundColor: WORKOUT_THEME.overlayWhite05, /* ... */ },
rpeBtnFilled: { backgroundColor: WORKOUT_THEME.overlayWhite16 },
discardIdleBtn: { backgroundColor: WORKOUT_THEME.dangerBgSoft, borderColor: WORKOUT_THEME.dangerBorderSoft, /* ... */ },
discardArmed: { backgroundColor: WORKOUT_THEME.dangerBgSoft, borderColor: WORKOUT_THEME.dangerBorderHot, /* ... */ },
keepBtn: { backgroundColor: WORKOUT_THEME.overlayWhite06, /* ... */ },
confirmDiscardText: { color: WORKOUT_THEME.fg, /* ... */ },
statusBannerError: { backgroundColor: WORKOUT_THEME.dangerBgHot },
```

And the lightning glyph color (line ~339):
```tsx
<MaterialCommunityIcons name="lightning-bolt" size={28} color={WORKOUT_THEME.successInk} />
```

---

## 5 — Finish-flow ordering (P3.3)

**File**: `apps/mobile/app/workout/active.tsx` (around line 238)

```tsx
onSave={async (metadata: SessionMetadata) => {
  try {
    await finishWorkout(metadata);
    discardWorkout();   // clear active session BEFORE navigating
    router.back();      // navigate last; sheet's own close() lands cleanly
  } catch {
    // sheet stays open; inline error banner handles retry
  }
}}
```

This single reorder removes the race between `router.back()` (which unmounts the screen) and the sheet's `sheetRef.current?.close()` callback running on a still-mounted sheet ref.

---

## 6 — Tightened `authLimiter` (P3.2)

**File**: `services/api/src/middleware/rateLimiter.ts`

Replace the single `authLimiter` export:
```ts
export const authVerifyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitResponse("Too many verification attempts. Try again later."),
  handler: (req, res, _next, options) => {
    onLimitReached(req, res, options);
    res.status(429).json(options.message);
  },
});

export const authOptionsLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitResponse("Too many requests. Try again later."),
  handler: (req, res, _next, options) => {
    onLimitReached(req, res, options);
    res.status(429).json(options.message);
  },
});

// Keep `authLimiter` as an alias for backward-compat if other modules import it.
export const authLimiter = authVerifyLimiter;
```

In `auth.routes.ts`:
- `/passkey/register/options`, `/passkey/login/options` → `authOptionsLimiter`
- `/passkey/register/verify`, `/passkey/login/verify`, `/email/login`, `/email/signup`, `/google/login` → `authVerifyLimiter`

---

That's the full drop-in set. Apply in stage order from `IMPLEMENTATION_PLAN.md`.
