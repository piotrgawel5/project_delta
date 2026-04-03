---
name: mobile-quality-standard
description: Apply Project Delta mobile quality standards for tasks that touch `apps/mobile/` in the Expo React Native app. Use when implementing or reviewing UI, animation, SVG, Zustand fetch flows, performance-sensitive components, design-token usage, or any screen that must match Figma/reference assets without regressions.
---

# Mobile Quality Standard

Apply these standards to every task touching `apps/mobile/`. Treat violations as correctness issues, not style preferences: they create visual regressions, FPS drops, or fetch waterfalls that are expensive to unwind later.

## Pre-Task Mandatory Reads

Read these files before writing code:

1. `packages/docs/context.md` for architecture, route conventions, and shared packages.
2. `apps/mobile/constants/theme.ts` for `SLEEP_THEME`, `SLEEP_LAYOUT`, and `SLEEP_FONTS`. Do not reconstruct any token from memory.
3. The relevant file in `packages/docs/reference_assets/` when the task touches a screen with a Figma or screenshot reference. Do not infer layout from the task description alone.

State what you checked before coding:

`I have read theme.ts and the following reference assets: [list].`

If no reference asset applies, say so explicitly.

## Color System

Use `theme.ts` as the only source of truth for colors.

Forbidden:

```tsx
className="bg-slate-900 text-slate-400 border-slate-700"
className="bg-gray-800 text-blue-400"
style={{ backgroundColor: '#1e293b' }}
```

Required:

```tsx
import { SLEEP_THEME } from '@/constants/theme';

style={{ backgroundColor: SLEEP_THEME.colors.background }}
className="bg-neutral-900 text-neutral-100"
```

Use `neutral-*` only when a needed value is not already covered by `SLEEP_THEME`.

For sleep quality grades, use the `NEON_COLORS` mapping from `apps/mobile/constants/theme.ts`:

- `A -> NEON_COLORS.A`
- `B -> NEON_COLORS.B`
- `C -> NEON_COLORS.C`
- `D -> NEON_COLORS.D`
- `F -> NEON_COLORS.F`

Never hardcode those grade colors.

## Design Tokens

Use `SLEEP_LAYOUT` and `SLEEP_FONTS` instead of arbitrary values.

Spacing and layout:

```tsx
import { SLEEP_LAYOUT } from '@/constants/theme';

style={{
  padding: SLEEP_LAYOUT.cardPadding,
  borderRadius: SLEEP_LAYOUT.cardRadius,
}}
```

Forbidden:

```tsx
style={{ padding: 16, borderRadius: 12 }}
```

Honor the optical-radius rule:

```tsx
const innerRadius = SLEEP_LAYOUT.innerCardRadius;
const outerRadius = innerRadius + SLEEP_LAYOUT.cardPadding;
```

Do not reuse the same radius across nested layers.

For typography on sleep dashboard surfaces, use `DMSans` through `SLEEP_FONTS` only:

```tsx
import { SLEEP_FONTS } from '@/constants/theme';

style={{ fontFamily: SLEEP_FONTS.regular }}
style={{ fontFamily: SLEEP_FONTS.medium }}
style={{ fontFamily: SLEEP_FONTS.semiBold }}
style={{ fontFamily: SLEEP_FONTS.bold }}
```

Forbidden:

```tsx
style={{ fontFamily: 'System' }}
style={{ fontFamily: 'Inter' }}
```

## Animation Rules

Run visual animation work on the UI thread through Reanimated.

Preferred:

```tsx
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const opacity = useSharedValue(0);
const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
opacity.value = withTiming(1, { duration: 300 });
```

Forbidden:

```tsx
const opacity = useRef(new Animated.Value(0)).current;
Animated.timing(opacity, { toValue: 1, useNativeDriver: false }).start();
```

Additional rules:

- Prefer Reanimated v3 worklets for opacity and transform work.
- If legacy React Native `Animated` is unavoidable, set `useNativeDriver: true`.
- Add `renderToHardwareTextureAndroid: true` on animated Android containers.
- Add `shouldRasterizeIOS: true` on animated iOS containers.
- Do not animate `width`, `height`, `padding`, or `margin`.
- Use `react-native-gesture-handler` plus Reanimated for gesture-driven animation.
- Do not drive animation frames from `setInterval` or React state churn.

Performance target:

- Baseline: `120fps` on high-refresh devices.
- Acceptable minimum: `118fps` on a mid-range Android device.
- Anything below `60fps` on a mid-range device is a regression.

Measure with Flipper or Expo DevTools profiler before marking animation work complete.

## SVG Rendering Constraint

Do not use `Line stroke="url(#gradient)"` for vertical gradient lines in `react-native-svg`; it collapses because the bounding box width is zero.

Forbidden:

```tsx
<Line x1={x} y1={y1} x2={x} y2={y2} stroke='url(#linearGrad)' strokeWidth={4} />
```

Required:

```tsx
<Rect
  x={x - strokeWidth / 2}
  y={Math.min(y1, y2)}
  width={strokeWidth}
  height={Math.abs(y2 - y1)}
  fill='url(#linearGrad)'
/>
```

## Fetch Architecture

Do not create waterfall fetches on mount.

Forbidden:

```tsx
useEffect(() => {
  fetchUser();
}, []);
useEffect(() => {
  fetchSleepData();
}, [userId]);
useEffect(() => {
  fetchTimeline();
}, [sleepDataId]);
useEffect(() => {
  fetchInsights();
}, [sleepDataId]);
```

Use one coordinated store action with parallel requests and cache guards:

```tsx
const useSleepStore = create<SleepState>((set, get) => ({
  data: null,
  isLoaded: false,

  fetchAll: async (userId: string, date: string) => {
    if (get().isLoaded) return;

    const [sleepData, timeline, insights] = await Promise.all([
      api.getSleepData(userId, date),

```

Invalidate cached state only on:

1. Manual sleep edits.
2. Date navigation.
3. Explicit pull-to-refresh.

Do not invalidate on unmount/remount or navigation stack changes.

## Re-Render Discipline

Memoize derived values and callbacks passed to children.

```tsx
const sleepGrade = useMemo(() => deriveSleepGrade(score), [score]);

const handlePress = useCallback(() => {
  navigation.navigate('SleepAnalysis');
}, [navigation]);
```

Use Zustand selectors instead of subscribing to the entire store.

Forbidden:

```tsx
const store = useSleepStore();
```

Required:

```tsx
const score = useSleepStore((s) => s.data?.sleepData?.score);
const isLoaded = useSleepStore((s) => s.isLoaded);
```

Wrap expensive list items in `React.memo`. For fixed-height `FlatList` items, always provide `keyExtractor` and `getItemLayout`.

## Component Conventions

- Use `@gorhom/bottom-sheet` for bottom sheets.
- Use `expo-blur` `BlurView` for frosted-glass treatments.
- Use `expo-image` instead of React Native `Image`.
- Keep icon sets consistent within a feature.
- Use Expo Router file-based navigation only.
- Keep `swipeEnabled: false` on tabs when horizontal swipe is reserved for sleep-day paging.
- Route writes through Zustand plus the async-storage queue and batch sync endpoint.
- Do not write directly to Supabase from mobile components.

## UI Completion Checklist

Before calling a UI task done, verify all of the following:

- All colors come from `SLEEP_THEME` or `NEON_COLORS`.
- No `slate-*` classes or arbitrary hex values remain.
- All spacing comes from `SLEEP_LAYOUT`.
- Corner radii follow `outer = inner + padding`.
- Typography uses `DMSans` via `SLEEP_FONTS`.
- The relevant reference asset was checked and proportions match.
- UI details match the spec exactly; do not accept "close enough".
- Gradients use the correct SVG technique.
- Shadows and glows prefer geometric approximation over SVG filters.

## Immediate-Failure Anti-Patterns

Treat each item below as an immediate failure:

| Anti-pattern                                     | Why it fails                               |
| ------------------------------------------------ | ------------------------------------------ |
| `slate-*` Tailwind classes                       | Breaks the design system color temperature |
| `useNativeDriver: false`                         | Forces JS-thread animation                 |
| SVG filter blur/glow on animated elements        | Causes severe FPS drops                    |
| `Line stroke="url(#gradient)"` on vertical lines | Makes gradients disappear                  |
| Multiple mount-time `useEffect` fetches          | Creates a visible request cascade          |
| Full-store Zustand subscriptions                 | Re-renders on unrelated state changes      |
| Same `borderRadius` on nested components         | Creates optical misalignment               |
| Hardcoded hex values outside `theme.ts`          | Breaks consistency and theming             |
| Animating `width`, `height`, or padding          | Triggers layout work                       |
| `setInterval` as an animation driver             | Produces unstable JS-thread timing         |

## Validation Before Completion

Do not consider the task complete until these checks pass:

- `npm run lint`
- `npm run typecheck` when available
- No `console.warn` or `console.error` in touched files
- All new animations use Reanimated worklets or native-driver-safe legacy animation
- A grep for `slate-` in touched files is empty
- No mount-time fetch waterfall was introduced
- Zustand selectors are used instead of full-store subscriptions
- Reference assets were compared when applicable
- Corner radii are derived instead of hardcoded
