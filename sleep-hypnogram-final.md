# Codex Task — SleepHypnogram: Pixel-Perfect Reference Match

> Skill: `$staged-delivery-workflow`. Single file: `apps/mobile/components/sleep/SleepHypnogram.tsx`.
> Stack: Expo RN 54 · NativeWind v4 · react-native-svg · react-native-reanimated · TypeScript strict.

---

## Pre-Flight

1. Open `apps/mobile/components/sleep/SleepHypnogram.tsx`. Read it in full.
2. Confirm `react-native-svg` version in `apps/mobile/package.json`. Print it.
3. Only file changing: `SleepHypnogram.tsx`.
4. Validation: `npx tsc --noEmit` + `npm run lint` from `apps/mobile/`.

---

## Root Cause Analysis — Three Bugs Causing the Delta from Reference

### Bug 1 — Wicks are invisible (most critical)

`<LinearGradient gradientUnits="objectBoundingBox">` applied as the `stroke` of a vertical `<Line>` always renders transparent. Reason: a vertical `<Line>` has **zero width bounding box**. With `objectBoundingBox` units the gradient coordinate system collapses to zero width, making the gradient undefined and the stroke invisible.

**Fix:** Render every wick as a `<Rect>` with a gradient `fill` instead of a `<Line>` with a gradient `stroke`. A `<Rect>` with `width={2}` has a valid bounding box. This is a well-known `react-native-svg` limitation.

```
// WRONG — always invisible on vertical lines:
<Line stroke="url(#wick-core-light)" ... />

// CORRECT — always visible:
<Rect
  x={wickX - 1}        // centered on the transition x-coordinate
  y={yTop}
  width={2}
  height={yBot - yTop}
  fill="url(#wick-core-light)"
/>
```

Every wick gradient must also use `gradientUnits="userSpaceOnUse"` with explicit `x1 y1 x2 y2` coordinates — but since these vary per wick, use `gradientUnits="objectBoundingBox"` on `<Rect>` which works correctly because the rect has non-zero height and non-zero width.

### Bug 2 — Awake markers spike above chart bounds

The current awake implementation draws a `<Line>` with `y1={STAGE_Y.awake}` and `y2={STAGE_Y.core}` where `STAGE_Y.awake = 8`. This starts near the very top of the SVG, making the orange line extend visually above the chart area.

**Fix:** The awake marker in the reference is a short vertical orange accent line that starts at the TOP of the core-level area and goes up only ~18px, with a small circle cap. It must be clipped within chart bounds.

```
// Awake marker:
// Dot at y = STAGE_Y.core - 18   (just above core blocks)
// Line from y = STAGE_Y.core - 18 down to y = STAGE_Y.core
```

### Bug 3 — Block halos look puffy / not like reference

The reference blocks are clean, sharp, flat-colored rectangles with no visible outer glow halo. The glow in the reference is extremely subtle — it's simply the gradient fill (lighter at top, darker at bottom) that gives depth. There is no blurred halo behind blocks.

**Fix:** Remove outer halo rects entirely. Blocks render as single `<Rect>` elements with a vertical gradient fill only.

---

## P1 — Regression Baseline

```bash
npx tsc --noEmit && npm run lint
```

Fix any pre-existing errors before proceeding. Do not continue if checks fail.

---

## P2 — Complete Rewrite of `SleepHypnogram.tsx`

Write the full file from scratch using the spec below. Carry over unchanged: geometry constants, geometry helper functions, `fmtMin`, `fmtAxisHour`, props interface, skeleton, lock overlay, and `Dimensions` width resolution.

---

### 2.1 — Imports

```tsx
import React, { useMemo, useState } from 'react';
import { Dimensions, Text, TouchableWithoutFeedback, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import {
  Circle,
  Defs,
  LinearGradient,
  Rect,
  Stop,
  Svg,
  Text as SvgText,
  Line,
} from 'react-native-svg';
import type { SleepHypnogramData, SleepPhase, SleepStage } from '@project-delta/shared';
```

---

### 2.2 — Constants

```ts
// ─── Layout ────────────────────────────────────────────────────────────────
const SVG_HEIGHT = 260;
const AXIS_H     = 36;
const CHART_H    = SVG_HEIGHT - AXIS_H; // 224

// ─── Stage layout ──────────────────────────────────────────────────────────
// Y = top edge of each stage band. Order top→bottom: awake marker · core · light · deep
const STAGE_Y: Record<SleepStage, number> = {
  awake: 0,    // not a band — used only for awake marker dot y-anchor
  core:  28,
  light: 98,
  deep:  168,
  rem:   28,   // same band as core
};

const STAGE_H: Record<SleepStage, number> = {
  awake: 0,    // awake has no rect — rendered as accent line + dot
  core:  58,
  light: 58,
  deep:  48,
  rem:   58,
};

// ─── Colors ────────────────────────────────────────────────────────────────
const STAGE_TOP: Record<SleepStage, string> = {
  awake: '#fdba74',
  core:  '#6ee7df',
  light: '#93c5fd',
  deep:  '#c084fc',
  rem:   '#6ee7df',
};

const STAGE_MID: Record<SleepStage, string> = {
  awake: '#f97316',
  core:  '#2dd4bf',
  light: '#60a5fa',
  deep:  '#9333ea',
  rem:   '#2dd4bf',
};

const STAGE_BOT: Record<SleepStage, string> = {
  awake: '#c2410c',
  core:  '#0d9488',
  light: '#2563eb',
  deep:  '#7e22ce',
  rem:   '#0d9488',
};

// All stage keys for Defs mapping
const ALL_STAGES: SleepStage[] = ['awake', 'core', 'light', 'deep', 'rem'];

// All bidirectional transition pairs for wick gradients
const STAGE_PAIRS: Array<[SleepStage, SleepStage]> = [
  ['core','light'],  ['light','core'],
  ['core','deep'],   ['deep','core'],
  ['light','deep'],  ['deep','light'],
  ['awake','core'],  ['core','awake'],
  ['awake','light'], ['light','awake'],
  ['awake','deep'],  ['deep','awake'],
  ['rem','light'],   ['light','rem'],
  ['rem','deep'],    ['deep','rem'],
];

function wickId(a: SleepStage, b: SleepStage): string { return `w-${a}-${b}`; }
```

---

### 2.3 — Geometry Helpers (pure, outside component)

```ts
function minToX(absMin: number, onsetMin: number, totalMin: number, svgW: number): number {
  return ((absMin - onsetMin) / totalMin) * svgW;
}

function minToW(durMin: number, totalMin: number, svgW: number): number {
  return Math.max(5, (durMin / totalMin) * svgW);
}

function fmtMin(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const mm = m % 60;
  return `${String(h).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
}

function fmtAxisHour(m: number): string {
  const h = Math.floor(m / 60) % 24;
  if (h === 0)  return '12 AM';
  if (h < 12)   return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}
```

---

### 2.4 — `<Defs>` Block

Contains **only** gradients. Zero filters.

```tsx
<Defs>
  {/* Block fill gradients — one per stage */}
  {ALL_STAGES.map((stage) => (
    <LinearGradient key={`f-${stage}`} id={`f-${stage}`} x1="0" y1="0" x2="0" y2="1">
      <Stop offset="0"    stopColor={STAGE_TOP[stage]} stopOpacity="1" />
      <Stop offset="0.45" stopColor={STAGE_MID[stage]} stopOpacity="1" />
      <Stop offset="1"    stopColor={STAGE_BOT[stage]} stopOpacity="1" />
    </LinearGradient>
  ))}

  {/* Wick gradients — one per transition pair
      gradientUnits="objectBoundingBox" works correctly on Rect (non-zero width+height) */}
  {STAGE_PAIRS.map(([a, b]) => (
    <LinearGradient key={wickId(a,b)} id={wickId(a,b)} x1="0" y1="0" x2="0" y2="1">
      <Stop offset="0" stopColor={STAGE_MID[a]} stopOpacity="0.9" />
      <Stop offset="1" stopColor={STAGE_MID[b]} stopOpacity="0.9" />
    </LinearGradient>
  ))}

  {/* Cycle boundary gradient */}
  <LinearGradient id="bd" x1="0" y1="0" x2="0" y2="1">
    <Stop offset="0"   stopColor="#ffffff" stopOpacity="0.02" />
    <Stop offset="0.5" stopColor="#ffffff" stopOpacity="0.10" />
    <Stop offset="1"   stopColor="#ffffff" stopOpacity="0.02" />
  </LinearGradient>
</Defs>
```

---

### 2.5 — `phaseBlocks` useMemo

Single `<Rect>` per non-awake phase. For `awake`, render accent line + dot. No halos, no extra rects behind blocks.

```tsx
const phaseBlocks = useMemo(() => {
  const nodes: React.ReactNode[] = [];

  data.phases.forEach((phase, i) => {
    const x = minToX(phase.startMin, data.sleepOnsetMin, totalMin, svgW);
    const w = minToW(phase.durationMin, totalMin, svgW);

    if (phase.stage === 'awake') {
      // Short orange accent: dot at top, vertical line down to core band
      const cx = x + w / 2;
      const dotY  = STAGE_Y.core - 20;   // dot sits 20px above core band top
      const lineY2 = STAGE_Y.core;        // line ends at top of core band
      nodes.push(
        <Line
          key={`aw-l-${i}`}
          x1={cx} x2={cx}
          y1={dotY + 4} y2={lineY2}
          stroke={STAGE_MID.awake}
          strokeWidth={1.5}
          opacity={0.8}
        />,
        <Circle
          key={`aw-c-${i}`}
          cx={cx}
          cy={dotY}
          r={3.5}
          fill={STAGE_MID.awake}
        />,
      );
    } else {
      nodes.push(
        <Rect
          key={`b-${i}`}
          x={x}
          y={STAGE_Y[phase.stage]}
          width={w}
          height={STAGE_H[phase.stage]}
          rx={5}
          ry={5}
          fill={`url(#f-${phase.stage})`}
          onPress={() => setActive(phase)}
        />,
      );
    }
  });

  return nodes;
}, [data.phases, data.sleepOnsetMin, totalMin, svgW]);
```

---

### 2.6 — `wicks` useMemo — THE CRITICAL FIX

**Every wick must be rendered as a `<Rect>` with gradient fill, NOT as a `<Line>` with gradient stroke.**

Reason: `<Line stroke="url(#...)">` with a vertical line has zero-width bounding box → gradient is invisible.
`<Rect fill="url(#...)">` with `width={3}` has a valid bounding box → gradient renders correctly.

```tsx
const wicks = useMemo(() => {
  const nodes: React.ReactNode[] = [];

  for (let i = 0; i < data.phases.length - 1; i++) {
    const curr = data.phases[i];
    const next = data.phases[i + 1];

    // Skip awake→awake or same stage transitions (no vertical gap)
    if (curr.stage === 'awake' && next.stage === 'awake') continue;

    // x = end of current phase = start of next phase
    const xEdge = minToX(
      curr.startMin + curr.durationMin,
      data.sleepOnsetMin,
      totalMin,
      svgW,
    );

    // y1 = bottom of current block, y2 = top of next block
    const y1 = curr.stage === 'awake'
      ? STAGE_Y.core - 16                          // awake marker bottom
      : STAGE_Y[curr.stage] + STAGE_H[curr.stage]; // bottom of normal block

    const y2 = next.stage === 'awake'
      ? STAGE_Y.core - 16                          // awake marker bottom
      : STAGE_Y[next.stage];                       // top of normal block

    const yTop = Math.min(y1, y2);
    const yBot = Math.max(y1, y2);
    const wickH = yBot - yTop;

    if (wickH < 2) continue; // no gap, skip

    const gid = wickId(curr.stage, next.stage);

    nodes.push(
      // Soft glow behind the wick: wider rect, very transparent, same gradient
      <Rect
        key={`wg-${i}`}
        x={xEdge - 3}
        y={yTop}
        width={6}
        height={wickH}
        fill={`url(#${gid})`}
        opacity={0.20}
      />,
      // Sharp wick rect: narrow, fully opaque gradient
      <Rect
        key={`wr-${i}`}
        x={xEdge - 1}
        y={yTop}
        width={2}
        height={wickH}
        fill={`url(#${gid})`}
        opacity={0.90}
      />,
    );
  }

  return nodes;
}, [data.phases, data.sleepOnsetMin, totalMin, svgW]);
```

---

### 2.7 — `cycleBoundaries` useMemo

```tsx
const cycleBoundaries = useMemo(() => {
  const nodes: React.ReactNode[] = [];
  data.phases.forEach((phase, i) => {
    if (i === 0) return;
    if (phase.cycleNumber === data.phases[i - 1].cycleNumber) return;
    const x = minToX(phase.startMin, data.sleepOnsetMin, totalMin, svgW);
    nodes.push(
      <Rect
        key={`bd-${i}`}
        x={x - 0.5}
        y={0}
        width={1}
        height={CHART_H}
        fill="url(#bd)"
        opacity={1}
      />,
    );
  });
  return nodes;
}, [data.phases, data.sleepOnsetMin, totalMin, svgW]);
```

Note: cycle boundaries also rendered as `<Rect>` to avoid the same gradient-on-line invisibility bug.

---

### 2.8 — `axisLabels` useMemo

```tsx
const axisLabels = useMemo(() => {
  const nodes: React.ReactNode[] = [];
  const firstHour = Math.ceil(data.sleepOnsetMin / 60) * 60;
  for (let m = firstHour; m <= data.wakeMin; m += 60) {
    const x = minToX(m, data.sleepOnsetMin, totalMin, svgW);
    nodes.push(
      <SvgText
        key={`al-${m}`}
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
  return nodes;
}, [data.sleepOnsetMin, data.wakeMin, totalMin, svgW]);
```

---

### 2.9 — Full `<Svg>` Render Order

Render in this exact order (z-order: first = behind, last = in front):

```tsx
<Svg width={svgW} height={SVG_HEIGHT}>
  <Defs>{/* all gradients, zero filters */}</Defs>

  {/* 1. Cycle boundary rects — behind everything */}
  {cycleBoundaries}

  {/* 2. Wick glow rects (wide, 20% opacity) */}
  {wicks.filter((_, i) => i % 2 === 0)}

  {/* 3. Wick sharp rects (narrow, 90% opacity) */}
  {wicks.filter((_, i) => i % 2 === 1)}

  {/* 4. Phase blocks + awake markers */}
  {phaseBlocks}

  {/* 5. Axis labels — always on top */}
  {axisLabels}
</Svg>
```

**Alternative if splitting wicks array is complex:** return `{ wickGlows, wickLines }` from the `wicks` useMemo and render separately — same result.

---

### 2.10 — Wrapper View with Hardware Acceleration

```tsx
<TouchableWithoutFeedback onPress={() => setActive(null)}>
  <View>
    <View
      style={{ width: svgW, height: SVG_HEIGHT }}
      shouldRasterizeIOS
      renderToHardwareTextureAndroid
    >
      <Svg width={svgW} height={SVG_HEIGHT}>
        {/* chart content */}
      </Svg>
    </View>

    {/* Tooltip — OUTSIDE rasterized View so it stays interactive and visible */}
    {active && (
      <Animated.View
        entering={FadeIn.duration(120)}
        style={{
          position: 'absolute',
          left: tooltipLeft,
          top: tooltipTop,
          width: 158,
          pointerEvents: 'none',
        }}
        className="bg-[#111827] border border-white/10 rounded-2xl p-3 shadow-2xl"
      >
        <Text className="text-sm font-semibold" style={{ color: STAGE_MID[active.stage] }}>
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

    {/* Lock overlay — OUTSIDE rasterized View */}
    {!isPaidPlan && (
      <View
        style={{ position: 'absolute', inset: 0 }}
        className="items-center justify-center bg-black/65"
      >
        <Text className="text-2xl mb-1">🔒</Text>
        <Text className="text-white text-xs text-center px-8">
          Upgrade to view sleep stages
        </Text>
      </View>
    )}
  </View>
</TouchableWithoutFeedback>
```

---

### 2.11 — Tooltip Position Logic

```tsx
const TOOLTIP_W = 158;
const TOOLTIP_H = 78;

const { tooltipLeft, tooltipTop } = useMemo(() => {
  if (!active) return { tooltipLeft: 0, tooltipTop: 0 };
  const cx = minToX(active.startMin + active.durationMin / 2, data.sleepOnsetMin, totalMin, svgW);
  const rawLeft = cx - TOOLTIP_W / 2;
  const tooltipLeft = Math.max(8, Math.min(rawLeft, svgW - TOOLTIP_W - 8));
  const blockTop = active.stage === 'awake' ? STAGE_Y.core - 20 : STAGE_Y[active.stage];
  const rawTop = blockTop - TOOLTIP_H - 8;
  const tooltipTop = Math.max(4, rawTop);
  return { tooltipLeft, tooltipTop };
}, [active, data.sleepOnsetMin, totalMin, svgW]);
```

---

## P3 — Audit

Run: `npx tsc --noEmit` + `npm run lint` + `npm run format`

### Invariant checklist — verify every item with grep/search before declaring done

- [ ] `grep -n "feGaussianBlur\|<filter\|filter="` returns **zero results** in `SleepHypnogram.tsx`
- [ ] `grep -n "<Line.*stroke=\"url"` returns **zero results** — no gradient stroke on Line elements
- [ ] `grep -n "<Rect.*fill=\"url(#w-"` returns results for wicks — confirms wick gradient-on-Rect pattern used
- [ ] `grep -n "<Rect.*fill=\"url(#f-"` returns results for blocks — confirms block gradient-on-Rect pattern used
- [ ] `grep -n "<Rect.*fill=\"url(#bd"` returns results for boundaries — confirms boundary gradient-on-Rect pattern used
- [ ] `shouldRasterizeIOS` present on SVG wrapper View
- [ ] `renderToHardwareTextureAndroid` present on SVG wrapper View
- [ ] Tooltip and lock overlay rendered OUTSIDE the rasterized View
- [ ] `awake` stage renders as `<Circle>` + `<Line>`, NOT as `<Rect>`
- [ ] All 5 stages covered in `STAGE_Y`, `STAGE_H`, `STAGE_TOP`, `STAGE_MID`, `STAGE_BOT`
- [ ] `React.memo` wrapper present
- [ ] useMemo calls present: `phaseBlocks`, `wicks`, `cycleBoundaries`, `axisLabels`, tooltip position
- [ ] `typecheck` zero errors
- [ ] `lint` zero warnings on touched file

`context.md` update: not required — no structural or convention changes.
