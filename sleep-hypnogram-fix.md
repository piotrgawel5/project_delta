# Codex Task — SleepHypnogram: Surgical Fix + Pixel-Perfect Rebuild

> Skill: `$staged-delivery-workflow`. Read `packages/docs/context.md` in full before touching any file.
> Stack: Expo RN 54 · Expo Router · NativeWind v4 · react-native-svg · react-native-reanimated · TypeScript strict.

---

## Pre-Flight Declaration (produce before any code)

1. Find the sleep screen file. Search `apps/mobile/app/` for the tab that renders the sleep content. It is almost certainly one of: `(tabs)/sleep.tsx`, `(tabs)/index.tsx`, or a screen imported into a tab. Print the exact path.
2. Find `apps/mobile/components/sleep/SleepHypnogram.tsx`. Print its current props interface and the JSX it currently returns.
3. Find where `SleepHypnogram` (or the equivalent chart component) is currently rendered in the sleep screen. Print the surrounding JSX — specifically the parent `View` chain all the way up to the `ScrollView` or screen root.
4. Declare which files will change in each stage.
5. Validation commands: run from `apps/mobile/` — `npx tsc --noEmit` then `npm run lint`.

---

## Diagnosed Bugs (fix all three)

### Bug 1 — Chart still inside a card
The chart is wrapped in a `View` with `bg-[#1c1c1e]`, `rounded-2xl`, and horizontal padding (`px-4` or `mx-4`). This clips the chart and gives it a dark card background instead of pure black.

### Bug 2 — Rect blocks rendering as 1–2px thin lines
Root cause: `svgW` is `undefined` or `0` at the time geometry is computed, making `durationToW()` return near-zero. This happens when `Dimensions.get('window').width` is called before layout, OR when the prop `width` is not passed and falls back to `0`.

### Bug 3 — Connector wicks spanning full chart height
The wick `<Line>` elements have `y1={0} y2={CHART_H}` (full height) instead of `y1={bottomOfDepartingBlock} y2={topOfArrivingBlock}`.

---

## P0 — Types (verify only, no new types needed)

Confirm `SleepPhase`, `SleepHypnogramData`, `SleepStage` exist in `packages/shared/src/types/sleep.ts` with exactly:

```ts
export type SleepStage = 'awake' | 'core' | 'light' | 'deep' | 'rem';

export interface SleepPhase {
  stage: SleepStage;
  startMin: number;      // absolute minutes from midnight
  durationMin: number;
  cycleNumber: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface SleepHypnogramData {
  phases: SleepPhase[];
  sleepOnsetMin: number;
  wakeMin: number;
}
```

If they exist with compatible shape, do not touch the file. If they are missing or incompatible, add them without removing existing fields.

P0 exit: `typecheck` + `lint` pass.

---

## P1 — Verify / Create Mock Data

Confirm `apps/mobile/lib/sleepMocks.ts` exports `MOCK_HYPNOGRAM: SleepHypnogramData`.

If it is missing or the data looks wrong, replace the entire file with exactly this:

```ts
import type { SleepHypnogramData, WeeklySparkEntry } from '@project-delta/shared';

// 4:30 AM = 270 min from midnight, 12:40 PM = 760 min from midnight
// Realistic sleep architecture: heavy deep sleep early, more REM later
export const MOCK_HYPNOGRAM: SleepHypnogramData = {
  sleepOnsetMin: 270,
  wakeMin: 760,
  phases: [
    // Cycle 1 — lots of deep
    { stage: 'light', startMin: 270, durationMin: 12, cycleNumber: 1, confidence: 'high' },
    { stage: 'deep',  startMin: 282, durationMin: 50, cycleNumber: 1, confidence: 'high' },
    { stage: 'light', startMin: 332, durationMin: 10, cycleNumber: 1, confidence: 'high' },
    { stage: 'core',  startMin: 342, durationMin: 28, cycleNumber: 1, confidence: 'high' },
    // Cycle 2 — still some deep
    { stage: 'awake', startMin: 370, durationMin: 3,  cycleNumber: 2, confidence: 'medium' },
    { stage: 'light', startMin: 373, durationMin: 18, cycleNumber: 2, confidence: 'high' },
    { stage: 'deep',  startMin: 391, durationMin: 40, cycleNumber: 2, confidence: 'high' },
    { stage: 'light', startMin: 431, durationMin: 14, cycleNumber: 2, confidence: 'high' },
    { stage: 'core',  startMin: 445, durationMin: 35, cycleNumber: 2, confidence: 'high' },
    // Cycle 3 — light deep, more core/REM
    { stage: 'light', startMin: 480, durationMin: 20, cycleNumber: 3, confidence: 'medium' },
    { stage: 'deep',  startMin: 500, durationMin: 22, cycleNumber: 3, confidence: 'medium' },
    { stage: 'core',  startMin: 522, durationMin: 38, cycleNumber: 3, confidence: 'high' },
    { stage: 'awake', startMin: 560, durationMin: 4,  cycleNumber: 3, confidence: 'low' },
    // Cycle 4 — mostly light + core
    { stage: 'light', startMin: 564, durationMin: 25, cycleNumber: 4, confidence: 'high' },
    { stage: 'core',  startMin: 589, durationMin: 42, cycleNumber: 4, confidence: 'high' },
    { stage: 'light', startMin: 631, durationMin: 18, cycleNumber: 4, confidence: 'medium' },
    // Cycle 5 — late sleep, lots of light/core, brief awake at end
    { stage: 'light', startMin: 649, durationMin: 28, cycleNumber: 5, confidence: 'high' },
    { stage: 'core',  startMin: 677, durationMin: 44, cycleNumber: 5, confidence: 'high' },
    { stage: 'light', startMin: 721, durationMin: 25, cycleNumber: 5, confidence: 'medium' },
    { stage: 'awake', startMin: 746, durationMin: 14, cycleNumber: 5, confidence: 'low' },
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
  { day: 'M', value: 0.5, active: false },
  { day: 'T', value: 0.35, active: false },
  { day: 'W', value: 0.3, active: false },
  { day: 'T', value: 0.55, active: false },
  { day: 'F', value: 0.75, active: false },
  { day: 'S', value: 0.9, active: false },
  { day: 'S', value: 1.0, active: true  },
];
```

P1 exit: `typecheck` + `lint` pass.

---

## P2 — Full Rewrite of SleepHypnogram.tsx

**Replace the entire file.** Do not preserve any existing logic — the current implementation has fundamental geometry bugs.

### File: `apps/mobile/components/sleep/SleepHypnogram.tsx`

Write the complete file using the following specification exactly. Do not deviate from geometry constants, render order, or fix implementations.

---

#### 2.1 — Imports

```tsx
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Dimensions, Text, TouchableWithoutFeedback, View } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Defs, Line, LinearGradient, Rect, Stop, Svg, Text as SvgText } from 'react-native-svg';
import type { SleepHypnogramData, SleepPhase, SleepStage } from '@project-delta/shared';
```

---

#### 2.2 — Constants (outside component, top of file after imports)

```ts
// ─── Layout ────────────────────────────────────────────────────────────────
const SVG_HEIGHT = 260;
const AXIS_H     = 36;       // reserved at bottom for time labels
const CHART_H    = SVG_HEIGHT - AXIS_H; // 224 — the actual drawing area

// ─── Stage vertical positions (y = top edge of rect, origin = top of SVG) ──
// Visual order top→bottom: awake · core · light · deep
const STAGE_Y: Record<SleepStage, number> = {
  awake: 8,    // thin awakening line near top
  core:  60,   // upper-mid block
  light: 118,  // mid block
  deep:  176,  // bottom block
  rem:   60,   // same row as core (REM shares upper-mid position)
};

const STAGE_H: Record<SleepStage, number> = {
  awake: 6,    // intentionally thin — momentary arousals
  core:  50,
  light: 50,
  deep:  50,
  rem:   50,
};

// ─── Colors ────────────────────────────────────────────────────────────────
const STAGE_COLOR: Record<SleepStage, string> = {
  awake: '#f97316',  // orange
  core:  '#2dd4bf',  // teal
  light: '#60a5fa',  // periwinkle blue
  deep:  '#9333ea',  // vivid purple
  rem:   '#2dd4bf',  // teal (same as core)
};

// ─── Gradient IDs for transition wicks ─────────────────────────────────────
// Pre-define all stage-pair gradients so SVG <Defs> is static
const STAGE_PAIRS: Array<[SleepStage, SleepStage]> = [
  ['awake','core'],  ['awake','light'],  ['awake','deep'],
  ['core','light'],  ['core','deep'],    ['core','awake'],
  ['light','deep'],  ['light','core'],   ['light','awake'],
  ['deep','core'],   ['deep','light'],   ['deep','awake'],
  ['rem','light'],   ['rem','deep'],     ['rem','awake'],
];
function gradId(a: SleepStage, b: SleepStage) { return `wick-${a}-${b}`; }
```

---

#### 2.3 — Geometry helpers (outside component, pure functions)

```ts
/** Convert absolute minute-from-midnight to SVG x coordinate */
function minToX(
  absoluteMin: number,
  onsetMin: number,
  totalMin: number,
  svgW: number,
): number {
  return ((absoluteMin - onsetMin) / totalMin) * svgW;
}

/** Convert a duration in minutes to SVG width — minimum 5px so short phases are visible */
function minToW(durationMin: number, totalMin: number, svgW: number): number {
  return Math.max(5, (durationMin / totalMin) * svgW);
}

/** Format absolute minutes-from-midnight as HH:MM */
function fmtMin(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** Format absolute minutes-from-midnight as "H AM/PM" for axis labels */
function fmtAxisHour(m: number): string {
  const h = Math.floor(m / 60) % 24;
  return h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;
}
```

---

#### 2.4 — Component

```tsx
interface SleepHypnogramProps {
  data: SleepHypnogramData;
  isPaidPlan: boolean;
  isLoading?: boolean;
  /** Defaults to full screen width. Pass explicit value if inside a constrained container. */
  width?: number;
}

const SleepHypnogram = React.memo(function SleepHypnogram({
  data,
  isPaidPlan,
  isLoading = false,
  width: widthProp,
}: SleepHypnogramProps) {
  // ─── Dimensions ──────────────────────────────────────────────────────────
  // CRITICAL: svgW must be resolved at render time. Never use 0 as default.
  const screenW = Dimensions.get('window').width;
  const svgW = widthProp ?? screenW;
  const totalMin = data.wakeMin - data.sleepOnsetMin; // e.g. 490 minutes

  // ─── Tooltip state ────────────────────────────────────────────────────────
  const [active, setActive] = useState<SleepPhase | null>(null);

  // ─── Skeleton animation ──────────────────────────────────────────────────
  const skeletonOpacity = useSharedValue(0.4);
  React.useEffect(() => {
    if (isLoading) {
      skeletonOpacity.value = withRepeat(withTiming(0.8, { duration: 800 }), -1, true);
    } else {
      skeletonOpacity.value = 1;
    }
  }, [isLoading]);
  const skeletonStyle = useAnimatedStyle(() => ({ opacity: skeletonOpacity.value }));

  // ─── Memoised: cycle boundary lines ──────────────────────────────────────
  const cycleBoundaries = useMemo(() => {
    const lines: React.ReactNode[] = [];
    data.phases.forEach((phase, i) => {
      if (i === 0) return;
      if (phase.cycleNumber !== data.phases[i - 1].cycleNumber) {
        const x = minToX(phase.startMin, data.sleepOnsetMin, totalMin, svgW);
        lines.push(
          <Line
            key={`cb-${i}`}
            x1={x} x2={x}
            y1={0} y2={CHART_H}
            stroke="#1f2937"
            strokeWidth={1}
            strokeDasharray="3,5"
          />
        );
      }
    });
    return lines;
  }, [data.phases, data.sleepOnsetMin, totalMin, svgW]);

  // ─── Memoised: connector wicks between consecutive blocks ─────────────────
  // A wick is a vertical line connecting the BOTTOM EDGE of the previous block
  // to the TOP EDGE of the next block. It must NOT span the full chart height.
  const wicks = useMemo(() => {
    const lines: React.ReactNode[] = [];
    for (let i = 0; i < data.phases.length - 1; i++) {
      const curr = data.phases[i];
      const next = data.phases[i + 1];
      // x is the meeting point: end of current block = start of next block
      const x = minToX(curr.startMin + curr.durationMin, data.sleepOnsetMin, totalMin, svgW);
      // y1 = bottom of current block
      const y1 = STAGE_Y[curr.stage] + STAGE_H[curr.stage];
      // y2 = top of next block
      const y2 = STAGE_Y[next.stage];
      // Only draw wick if there's actually a vertical gap between the blocks
      if (Math.abs(y2 - y1) < 2) continue;
      lines.push(
        <Line
          key={`wick-${i}`}
          x1={x} x2={x}
          y1={Math.min(y1, y2)}
          y2={Math.max(y1, y2)}
          stroke={`url(#${gradId(curr.stage, next.stage)})`}
          strokeWidth={1.5}
        />
      );
    }
    return lines;
  }, [data.phases, data.sleepOnsetMin, totalMin, svgW]);

  // ─── Memoised: phase rect blocks ─────────────────────────────────────────
  const phaseRects = useMemo(() => {
    return data.phases.map((phase, i) => {
      const x = minToX(phase.startMin, data.sleepOnsetMin, totalMin, svgW);
      const w = minToW(phase.durationMin, totalMin, svgW);
      const y = STAGE_Y[phase.stage];
      const h = STAGE_H[phase.stage];
      return (
        <Rect
          key={`phase-${i}`}
          x={x}
          y={y}
          width={w}
          height={h}
          rx={4}
          ry={4}
          fill={STAGE_COLOR[phase.stage]}
          onPress={() => setActive(phase)}
        />
      );
    });
  }, [data.phases, data.sleepOnsetMin, totalMin, svgW]);

  // ─── Memoised: time axis labels ───────────────────────────────────────────
  const axisLabels = useMemo(() => {
    const labels: React.ReactNode[] = [];
    // Find first whole hour at or after sleepOnsetMin
    const firstHour = Math.ceil(data.sleepOnsetMin / 60) * 60;
    for (let m = firstHour; m <= data.wakeMin; m += 60) {
      const x = minToX(m, data.sleepOnsetMin, totalMin, svgW);
      labels.push(
        <SvgText
          key={`axis-${m}`}
          x={x}
          y={CHART_H + 22}
          fill="#4b5563"
          fontSize={11}
          fontWeight="500"
          textAnchor="middle"
        >
          {fmtAxisHour(m)}
        </SvgText>
      );
    }
    return labels;
  }, [data.sleepOnsetMin, data.wakeMin, totalMin, svgW]);

  // ─── Tooltip position (clamped to screen edges) ───────────────────────────
  const TOOLTIP_W = 156;
  const TOOLTIP_H = 76;
  const tooltipPos = useMemo(() => {
    if (!active) return { left: 0, top: 0 };
    const centerX = minToX(
      active.startMin + active.durationMin / 2,
      data.sleepOnsetMin, totalMin, svgW,
    );
    const rawLeft = centerX - TOOLTIP_W / 2;
    const left = Math.max(8, Math.min(rawLeft, svgW - TOOLTIP_W - 8));
    const blockTop = STAGE_Y[active.stage];
    const rawTop = blockTop - TOOLTIP_H - 10;
    const top = Math.max(8, rawTop);
    return { left, top };
  }, [active, data.sleepOnsetMin, totalMin, svgW]);

  // ─── Skeleton rects ───────────────────────────────────────────────────────
  const SKELETON_RECTS = [
    { x: svgW * 0.05, y: STAGE_Y.deep,  w: svgW * 0.18, h: STAGE_H.deep  },
    { x: svgW * 0.10, y: STAGE_Y.light, w: svgW * 0.12, h: STAGE_H.light },
    { x: svgW * 0.28, y: STAGE_Y.deep,  w: svgW * 0.20, h: STAGE_H.deep  },
    { x: svgW * 0.30, y: STAGE_Y.core,  w: svgW * 0.14, h: STAGE_H.core  },
    { x: svgW * 0.55, y: STAGE_Y.light, w: svgW * 0.22, h: STAGE_H.light },
    { x: svgW * 0.72, y: STAGE_Y.core,  w: svgW * 0.16, h: STAGE_H.core  },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Animated.View style={[{ width: svgW, height: SVG_HEIGHT }, skeletonStyle]}>
        <Svg width={svgW} height={SVG_HEIGHT}>
          {SKELETON_RECTS.map((r, i) => (
            <Rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} rx={4} ry={4} fill="#1f2937" />
          ))}
        </Svg>
      </Animated.View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={() => setActive(null)}>
      <View style={{ width: svgW, height: SVG_HEIGHT }}>
        {/* Main SVG chart */}
        <Svg width={svgW} height={SVG_HEIGHT}>
          {/* 1. Gradient defs for wicks */}
          <Defs>
            {STAGE_PAIRS.map(([a, b]) => (
              <LinearGradient
                key={gradId(a, b)}
                id={gradId(a, b)}
                x1="0" y1="0" x2="0" y2="1"
              >
                <Stop offset="0" stopColor={STAGE_COLOR[a]} stopOpacity="1" />
                <Stop offset="1" stopColor={STAGE_COLOR[b]} stopOpacity="1" />
              </LinearGradient>
            ))}
          </Defs>

          {/* 2. Cycle boundary dashed lines (behind everything) */}
          {cycleBoundaries}

          {/* 3. Connector wicks (behind blocks) */}
          {wicks}

          {/* 4. Phase blocks (on top) */}
          {phaseRects}

          {/* 5. Time axis labels */}
          {axisLabels}
        </Svg>

        {/* Tooltip — absolutely positioned RN View over SVG */}
        {active && (
          <Animated.View
            entering={FadeIn.duration(150)}
            style={{
              position: 'absolute',
              left: tooltipPos.left,
              top: tooltipPos.top,
              width: TOOLTIP_W,
              pointerEvents: 'none',
            }}
            className="bg-[#111827] border border-white/10 rounded-2xl p-3 shadow-2xl"
          >
            <Text
              className="text-sm font-semibold"
              style={{ color: STAGE_COLOR[active.stage] }}
            >
              {active.stage.charAt(0).toUpperCase() + active.stage.slice(1)}
            </Text>
            <Text className="text-xs text-gray-400 mt-0.5">
              {fmtMin(active.startMin)} – {fmtMin(active.startMin + active.durationMin)}
            </Text>
            <Text className="text-xs text-gray-500 mt-1">
              {active.durationMin}m · {active.confidence}
            </Text>
          </Animated.View>
        )}

        {/* Premium lock overlay */}
        {!isPaidPlan && (
          <View
            style={{ position: 'absolute', top: 0, left: 0, width: svgW, height: SVG_HEIGHT }}
            className="items-center justify-center"
          >
            {/* Use expo-blur BlurView if available, otherwise dark overlay */}
            <View
              style={{ position: 'absolute', top: 0, left: 0, width: svgW, height: SVG_HEIGHT }}
              className="bg-black/70"
            />
            <Text className="text-white text-2xl mb-2">🔒</Text>
            <Text className="text-white text-xs text-center px-8">
              Upgrade to view sleep stages
            </Text>
          </View>
        )}
      </View>
    </TouchableWithoutFeedback>
  );
});

export default SleepHypnogram;
```

**IMPORTANT — BlurView upgrade:** After writing the above, if `expo-blur` is in `apps/mobile/package.json`, replace the plain `bg-black/70` overlay `View` with:
```tsx
import { BlurView } from 'expo-blur';
// ...
<BlurView
  intensity={18}
  tint="dark"
  style={{ position: 'absolute', top: 0, left: 0, width: svgW, height: SVG_HEIGHT }}
/>
```

---

## P2b — Extract Chart from Card in Sleep Screen

**This is mandatory. Do not skip.**

In the sleep screen file (path confirmed at pre-flight):

1. Find the JSX block that wraps `<SleepHypnogram>` (or the old chart component). It will look something like:
   ```tsx
   <View className="mx-4 rounded-2xl bg-[#1c1c1e] p-4 ...">
     <Text ...>Sleep Stages</Text>
     <SleepHypnogram ... />
   </View>
   ```

2. **Replace** that entire wrapper with this structure:
   ```tsx
   {/* Section header — normal screen padding */}
   <View className="flex-row items-center gap-2 mb-3 px-4">
     <Text className="text-white text-xl font-bold">Sleep Stages</Text>
     <View className="w-5 h-5 rounded-full border border-gray-700 items-center justify-center">
       <Text className="text-gray-500 text-[10px]">i</Text>
     </View>
   </View>

   {/* Chart — full bleed. NO px-4, NO mx-4, NO rounded, NO bg card */}
   <SleepHypnogram
     data={MOCK_HYPNOGRAM}
     isPaidPlan={true}
     isLoading={false}
   />

   {/* Bottom spacing */}
   <View className="h-6" />
   ```

3. The chart `View` wrapper has `width: svgW` set internally via `Dimensions.get('window').width`. Do NOT add any `style={{ width }}` or padding on the outside — let it fill naturally.

4. The screen background where the chart sits must be `#000000` (pure black) or `#0f0f0f`. If the `ScrollView` or screen root has a different background, update it. Nothing else about the screen changes.

5. Ensure `MOCK_HYPNOGRAM` is imported from `@lib/sleepMocks`.

---

## P3 — Audit & Final Check

Run from `apps/mobile/`:
- `npx tsc --noEmit` — zero errors
- `npm run lint` — zero warnings on touched files  
- `npm run format` — auto-fix and confirm clean

### Invariant checklist

- [ ] `svgW` is never `0` or `undefined` — it resolves to `Dimensions.get('window').width` at minimum
- [ ] `totalMin = data.wakeMin - data.sleepOnsetMin` — confirmed positive (490 for mock data)
- [ ] Each `<Rect>` has `width = Math.max(5, ...)` — no zero-width blocks
- [ ] Wick `y1` = bottom of departing block = `STAGE_Y[stage] + STAGE_H[stage]`
- [ ] Wick `y2` = top of arriving block = `STAGE_Y[stage]`
- [ ] Wicks use gradient `url(#wick-{from}-{to})` — no solid-color wicks
- [ ] Cycle boundary lines use `y1={0} y2={CHART_H}` (full chart height, NOT full SVG height)
- [ ] Chart is NOT inside a card — no `bg-[#1c1c1e]`, no `rounded-2xl`, no `mx-4` on chart wrapper
- [ ] Screen background is `#000000` or `#0f0f0f` behind the chart
- [ ] Tooltip `left` is clamped: `Math.max(8, Math.min(rawLeft, svgW - TOOLTIP_W - 8))`
- [ ] `isPaidPlan=false` renders overlay (no data leak through blur)
- [ ] `isLoading=true` renders animated skeleton
- [ ] Component is `React.memo` wrapped
- [ ] Three separate `useMemo` calls: `cycleBoundaries`, `wicks`, `phaseRects`
- [ ] `axisLabels` in a fourth `useMemo`
- [ ] No `any`, no `@ts-ignore` without explicit comment
- [ ] `npm run format` run and diff is clean

### context.md update

If `SleepHypnogram` props interface changed structurally from what context.md documents, update the relevant section. Otherwise state: `context.md update not required — no structural or convention changes.`

### Residual risks

List any edge cases not covered, deferred items, and out-of-scope observations noticed during implementation.

---

## Scope Guard

**Do NOT touch:**
- `SleepMetricCard` (Fell Asleep / Woke Up cards) — leave exactly as-is
- Navigation, auth, Zustand stores
- Any other screen or component
- Bottom tab bar

If you notice something broken outside this scope, log it as `Out-of-scope observation: [description]. Deferring.`
