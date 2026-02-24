# Codex Task — Full-Width Sleep Hypnogram Redesign (Project Delta)

> Skill: `$staged-delivery-workflow` — follow P0→P1→P2→P3 strictly. Read `packages/docs/context.md` in full before touching any file. Declare stages, files, and validation commands at pre-flight. Do not advance past a failing check.

---

## Pre-Flight Declaration (Codex must produce this before any code)

1. Confirm stack: **Expo RN 54, Expo Router, NativeWind v4 (Tailwind), react-native-svg, react-native-reanimated, TypeScript strict.**
2. List every file that will be created or modified per stage.
3. State validation commands: `npx tsc --noEmit` + `npm run lint` (run from `apps/mobile/`).
4. Confirm `SleepHypnogram.tsx` exists at `apps/mobile/components/sleep/SleepHypnogram.tsx` — if it does not, create it at that path, do not place it elsewhere.

---

## Objective

Redesign the sleep chart from a card-confined column chart into a **pixel-perfect, full-bleed, continuous-timeline hypnogram** that matches the reference design (Apple Health Sleep Stages aesthetic). The chart must:

- Be extracted from any `Card` or `View` container that clips or pads it
- Span the full screen width with no horizontal margin
- Render as a **continuous timeline SVG** where each block's x-position and width are proportional to actual duration on the clock (not uniform columns)
- Show all four sleep depth levels on a vertical axis: Awake (top) → Core → Light → Deep (bottom)
- Show cycle boundary dotted vertical lines
- Show vertical connector "wick" lines between blocks (like candlestick chart)
- Be interactive (tap block → tooltip)
- Be premium-gated with blur overlay
- Be performance-optimised (no re-renders on unrelated state changes, memoised)

---

## Visual Spec (pixel-perfect reference)

### Layout

```
[  full screen width, no horizontal padding  ]
[  optional section title "Sleep Stages ⓘ"  ]  ← outside chart, normal screen padding
[                                             ]
[  SVG full width, height = 260              ]
[  bottom 36px = time axis labels            ]
[  chart draw area = height 224              ]
[                                             ]
```

No surrounding card. No `rounded-2xl`. No `bg-[#1c1c1e]`. The section sits directly on the screen background (`#000000` or `#0f0f0f`).

### X-Axis (Time)

- Range: sleep onset time → wake time (from data)
- Each minute maps to `(totalMinutes / svgWidth)` pixels
- Time labels at even hour boundaries (`5 AM`, `6 AM`, `7 AM`, etc.) rendered as SVG `<Text>` at correct x, `y = chartHeight + 20`, `fill="#4b5563"` `fontSize={11}` `fontWeight="500"`

### Y-Axis (Sleep Stage Depth)

Four discrete rows (no axis lines rendered, just vertical position):

| Stage   | y center (px, in 224px draw area) | Block height |
|---------|-----------------------------------|--------------|
| `awake` | 28                                | 8            |
| `core`  | 84                                | 52           |
| `light` | 148                               | 52           |
| `deep`  | 200                               | 52           |

`awake` is intentionally thin (it is a momentary arousal line, not a block).

### Block Rendering

Each `SleepPhase` entry renders as:
- `<Rect>` with `x` = `timeToX(phase.startMin)`, `width` = `durationToW(phase.durationMin)`, `y` = `STAGE_Y[stage]`, `height` = `STAGE_H[stage]`, `rx={5}` `ry={5}`
- Minimum rendered width: `4px` (so very short phases are still visible)
- Colors:
  ```ts
  const STAGE_COLOR: Record<SleepStage, string> = {
    awake:  '#f97316',  // orange — thin horizontal line appearance
    core:   '#2dd4bf',  // teal
    light:  '#60a5fa',  // periwinkle blue
    deep:   '#9333ea',  // vivid purple
    rem:    '#2dd4bf',  // same as core per reference (teal)
  };
  ```

### Connector Wicks

Between consecutive `SleepPhase` blocks, render a vertical `<Line>` connecting the bottom-center of the departing block to the top-center of the arriving block. This produces the candlestick "wick" effect showing stage transitions.

```
x = timeToX(phase.endMin)
y1 = STAGE_Y[prev] + STAGE_H[prev]   // bottom of previous block
y2 = STAGE_Y[next]                    // top of next block
stroke = gradient from STAGE_COLOR[prev] to STAGE_COLOR[next]
strokeWidth = 1.5
```

Use SVG `<Defs><LinearGradient>` for transition wicks. Each unique stage-pair transition needs one gradient definition (there are at most 6 combinations — define all upfront).

### Cycle Boundary Lines

At the start of each new `cycleNumber` (where `phase.cycleNumber !== prev.cycleNumber`), render:
```
<Line
  x1={timeToX(phase.startMin)} x2={timeToX(phase.startMin)}
  y1={0} y2={chartHeight}
  stroke="#1f2937"
  strokeWidth={1}
  strokeDasharray="3,5"
/>
```

### Tooltip

On `<Rect onPress>`:
- `useState<SleepPhase | null>(null)` for active phase
- Render as absolute-positioned RN `View` floating over SVG
- Position: horizontally clamp so it never overflows screen edges
- Style: `bg-[#111827] border border-white/10 rounded-2xl p-4 shadow-2xl`
- Content:
  - Stage name in the stage color, `text-sm font-semibold`
  - Time range: `HH:MM – HH:MM`, `text-xs text-gray-400 mt-0.5`
  - Duration + confidence pill: `text-xs text-gray-500 mt-1` — e.g. `31m · high`
- Animate in: `react-native-reanimated` `FadeIn.duration(150)`
- Dismiss: `TouchableWithoutFeedback` wrapping the outer `View`, `onPress={() => setActive(null)}`

### Premium Lock Overlay

If `isPaidPlan === false`:
- Render `expo-blur` `BlurView` absolutely over the full SVG area, `intensity={18}` `tint="dark"`
- Center a `View` with a lock icon (`🔒` or lucide-react-native `Lock` if available) + `text-white text-xs text-center mt-2` label: `"Upgrade to view sleep stages"`
- Do not render phase blocks at all (pass empty array to avoid data leaking through blur)

### Loading Skeleton

If `isLoading === true`:
- Render 5 placeholder `<Rect>` blocks distributed across the chart area
- Animate opacity `0.3 → 0.7 → 0.3` with `react-native-reanimated` looping `withRepeat(withTiming(...))`
- Colors: `#1f2937` for all placeholder rects

---

## File-by-File Changes

### P0 — Types

**`packages/shared/src/types/sleep.ts`** — add if not present:

```ts
export type SleepStage = 'awake' | 'core' | 'light' | 'deep' | 'rem';

export interface SleepPhase {
  stage: SleepStage;
  /** Absolute minutes from midnight, e.g. 4:30 AM = 270 */
  startMin: number;
  durationMin: number;
  cycleNumber: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface SleepHypnogramData {
  phases: SleepPhase[];
  sleepOnsetMin: number;  // minutes from midnight
  wakeMin: number;        // minutes from midnight
}

export interface WeeklySparkEntry {
  day: string;  // 'M' | 'T' | 'W' | 'T' | 'F' | 'S' | 'S'
  value: number;   // 0–1 normalised
  active: boolean;
}
```

Do NOT modify existing types — only add. If a conflicting definition exists, surface it as an ambiguity before proceeding.

P0 exit: `typecheck` + `lint` pass.

---

### P1 — Mock Data

**`apps/mobile/lib/sleepMocks.ts`** (create):

```ts
import type { SleepPhase, SleepHypnogramData, WeeklySparkEntry } from '@project-delta/shared';

// Sleep 4:30 AM (270 min) → 12:40 PM (760 min)
// Realistic: deep sleep early, REM increases later in night, light sleep bridges

export const MOCK_HYPNOGRAM: SleepHypnogramData = {
  sleepOnsetMin: 270,
  wakeMin: 760,
  phases: [
    // Cycle 1
    { stage: 'light', startMin: 270, durationMin: 15, cycleNumber: 1, confidence: 'high' },
    { stage: 'deep',  startMin: 285, durationMin: 45, cycleNumber: 1, confidence: 'high' },
    { stage: 'light', startMin: 330, durationMin: 10, cycleNumber: 1, confidence: 'high' },
    { stage: 'core',  startMin: 340, durationMin: 31, cycleNumber: 1, confidence: 'high' },
    { stage: 'awake', startMin: 371, durationMin: 3,  cycleNumber: 1, confidence: 'medium' },
    // Cycle 2
    { stage: 'light', startMin: 374, durationMin: 20, cycleNumber: 2, confidence: 'high' },
    { stage: 'deep',  startMin: 394, durationMin: 50, cycleNumber: 2, confidence: 'high' },
    { stage: 'light', startMin: 444, durationMin: 12, cycleNumber: 2, confidence: 'high' },
    { stage: 'core',  startMin: 456, durationMin: 28, cycleNumber: 2, confidence: 'high' },
    // Cycle 3
    { stage: 'light', startMin: 484, durationMin: 18, cycleNumber: 3, confidence: 'medium' },
    { stage: 'deep',  startMin: 502, durationMin: 30, cycleNumber: 3, confidence: 'medium' },
    { stage: 'core',  startMin: 532, durationMin: 35, cycleNumber: 3, confidence: 'high' },
    { stage: 'awake', startMin: 567, durationMin: 4,  cycleNumber: 3, confidence: 'low' },
    // Cycle 4
    { stage: 'light', startMin: 571, durationMin: 22, cycleNumber: 4, confidence: 'high' },
    { stage: 'core',  startMin: 593, durationMin: 40, cycleNumber: 4, confidence: 'high' },
    { stage: 'light', startMin: 633, durationMin: 15, cycleNumber: 4, confidence: 'medium' },
    // Cycle 5
    { stage: 'light', startMin: 648, durationMin: 25, cycleNumber: 5, confidence: 'high' },
    { stage: 'core',  startMin: 673, durationMin: 45, cycleNumber: 5, confidence: 'high' },
    { stage: 'light', startMin: 718, durationMin: 30, cycleNumber: 5, confidence: 'medium' },
    { stage: 'awake', startMin: 748, durationMin: 12, cycleNumber: 5, confidence: 'low' },
  ],
};

export const MOCK_WEEKLY_DOTS: WeeklySparkEntry[] = [
  { day: 'M', value: 1, active: true },
  { day: 'T', value: 1, active: true },
  { day: 'W', value: 1, active: true },
  { day: 'T', value: 1, active: true },
  { day: 'F', value: 1, active: true },
  { day: 'S', value: 1, active: true },
  { day: 'S', value: 1, active: true },
];

export const MOCK_WEEKLY_BARS: WeeklySparkEntry[] = [
  { day: 'M', value: 0.6, active: false },
  { day: 'T', value: 0.4, active: false },
  { day: 'W', value: 0.3, active: false },
  { day: 'T', value: 0.5, active: false },
  { day: 'F', value: 0.8, active: false },
  { day: 'S', value: 0.9, active: false },
  { day: 'S', value: 1.0, active: true  },
];
```

P1 exit: `typecheck` + `lint` pass.

---

### P2 — SleepHypnogram Component (Full Rewrite)

**`apps/mobile/components/sleep/SleepHypnogram.tsx`**

Full rewrite. Keep the filename and export name identical to whatever currently exists — do not rename.

#### Props interface:

```ts
interface SleepHypnogramProps {
  data: SleepHypnogramData;
  isPaidPlan: boolean;
  isLoading?: boolean;
  width?: number;  // defaults to Dimensions.get('window').width
}
```

#### Implementation requirements (in order):

**1. Geometry helpers (pure functions, defined outside component):**

```ts
function timeToX(absoluteMin: number, onsetMin: number, totalMin: number, svgW: number): number {
  return ((absoluteMin - onsetMin) / totalMin) * svgW;
}
function durationToW(durationMin: number, totalMin: number, svgW: number): number {
  return Math.max(4, (durationMin / totalMin) * svgW);
}
```

**2. Constants:**

```ts
const SVG_HEIGHT = 260;
const AXIS_HEIGHT = 36;
const CHART_H = SVG_HEIGHT - AXIS_HEIGHT; // 224

const STAGE_Y: Record<SleepStage, number> = {
  awake: 20, core: 72, light: 130, deep: 185, rem: 72,
};
const STAGE_H: Record<SleepStage, number> = {
  awake: 6, core: 50, light: 50, deep: 50, rem: 50,
};
const STAGE_COLOR: Record<SleepStage, string> = {
  awake: '#f97316', core: '#2dd4bf', light: '#60a5fa', deep: '#9333ea', rem: '#2dd4bf',
};
```

**3. SVG Gradient Defs:**

Define `<LinearGradient id="wick-{from}-{to}">` for all stage transition pairs. Use `gradientUnits="userSpaceOnUse"` with `x1=x x2=x y1 y2` set dynamically per wick using inline SVG props (pass `gradientTransform` or just define 6 static ones for the 6 stage combos and reuse).

**4. Render order inside `<Svg>`:**

1. Cycle boundary dashed lines (render first, behind everything)
2. Connector wick lines (render second)
3. Phase rect blocks (render last, on top)
4. Time axis `<Text>` labels at bottom

**5. Tooltip positioning logic:**

```ts
const tooltipW = 160;
const tooltipH = 80;
const rawX = timeToX(active.startMin + active.durationMin / 2, ...) - tooltipW / 2;
const clampedX = Math.max(8, Math.min(rawX, svgW - tooltipW - 8));
const rawY = STAGE_Y[active.stage] - tooltipH - 8;
const clampedY = Math.max(8, rawY);
```

Render tooltip as an absolutely-positioned RN `View` with `style={{ position: 'absolute', left: clampedX, top: clampedY, width: tooltipW }}`.

**6. Memoisation:**

- Wrap component in `React.memo`
- Memoize `phases` rendering with `useMemo` keyed on `data.phases` reference
- Memoize wick lines with separate `useMemo`
- Memoize cycle boundary lines with separate `useMemo`

**7. Reanimated skeleton:**

```ts
const skeletonOpacity = useSharedValue(0.3);
useEffect(() => {
  if (isLoading) {
    skeletonOpacity.value = withRepeat(withTiming(0.7, { duration: 900 }), -1, true);
  }
}, [isLoading]);
const skeletonStyle = useAnimatedStyle(() => ({ opacity: skeletonOpacity.value }));
```

Wrap skeleton `<Svg>` in `<Animated.View style={skeletonStyle}>`.

---

### P2b — Remove Chart from Card / Wire Sleep Screen

**Target file:** Confirm path from Expo Router structure. Likely `apps/mobile/app/(tabs)/sleep.tsx` or the existing sleep screen — **do not guess, check the file system first**.

Changes:
1. Find wherever `SleepHypnogram` (or equivalent chart) is currently rendered inside a `Card`, `View` with `mx-4`/`px-4`, or any container that adds horizontal margin or `rounded` clipping.
2. Extract it out of that container.
3. Render the section as:

```tsx
{/* Section header — with normal screen padding */}
<View className="px-4 flex-row items-center gap-2 mb-3">
  <Text className="text-white text-xl font-bold">Sleep Stages</Text>
  <TouchableOpacity>
    <View className="w-5 h-5 rounded-full border border-gray-600 items-center justify-center">
      <Text className="text-gray-400 text-xs">i</Text>
    </View>
  </TouchableOpacity>
</View>

{/* Chart — full bleed, no horizontal padding */}
<SleepHypnogram
  data={MOCK_HYPNOGRAM}
  isPaidPlan={true}
  isLoading={false}
/>
```

4. Do NOT change the `SleepMetricCard` layout (Fell Asleep / Woke Up cards). Those stay as-is with their existing padding.
5. Add `mb-6` spacing after the chart before whatever follows.

---

### P3 — Audit & Summary

Run from `apps/mobile/`:
- `npx tsc --noEmit` — must be zero errors
- `npm run lint` — must be zero warnings on touched files
- `npm run format` — auto-fix, commit result

Invariant checklist:
- [ ] Chart is full-bleed (no `mx-*` or `px-*` on chart wrapper)
- [ ] X-axis blocks are proportional to real duration (not uniform columns)
- [ ] Connector wicks render between all consecutive blocks
- [ ] Cycle boundaries render as dashed vertical lines
- [ ] Tooltip clamps to screen edges
- [ ] `isPaidPlan=false` renders BlurView overlay with no data leak
- [ ] `isLoading=true` renders animated skeleton
- [ ] Component is wrapped in `React.memo`
- [ ] Three separate `useMemo` calls (blocks, wicks, boundaries)
- [ ] No `any`, no `@ts-ignore` without documented reason
- [ ] `npm run format` run and clean
- [ ] Optical corner radii rule followed everywhere

Residual risks section: list any edge case not covered, deferred items, or tech debt.

`context.md` update: if `SleepHypnogram` props interface changed structurally, update the relevant section in context.md. Otherwise state "not required."

---

## Out-of-Scope (Do Not Touch)

- Navigation, auth, Zustand stores
- `SleepMetricCard` visual design (keep as-is)
- Any API endpoint or Supabase query
- The bottom tab bar
- Any screen other than the sleep screen
- Any animation beyond what is specified above

If you observe an improvement opportunity outside this scope, log it as `Out-of-scope observation: [description]. Deferring.` and list it in P3 residual risks.
