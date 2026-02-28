# Codex Task — SleepHypnogram: Performance Fix + Filter-Free Premium Visual

> Skill: `$staged-delivery-workflow`. Single file change: `apps/mobile/components/sleep/SleepHypnogram.tsx`.
> Stack: Expo RN 54 · NativeWind v4 · react-native-svg · react-native-reanimated · TypeScript strict.

---

## Pre-Flight

1. Confirm `apps/mobile/components/sleep/SleepHypnogram.tsx` exists.
2. Only file changing: `SleepHypnogram.tsx`.
3. Validation: `npx tsc --noEmit` + `npm run lint` from `apps/mobile/`.
4. This task has zero geometry changes — `STAGE_Y`, `STAGE_H`, `SVG_HEIGHT`, `CHART_H`, props, and mock data are untouched.

---

## Root Cause Analysis (mandatory reading before touching the file)

### Bug 1 — FPS destruction (120fps → 10fps)
`feGaussianBlur` SVG filters in `react-native-svg` execute on the **JavaScript thread**, not the GPU. The render pipeline blurs every element every frame. With 20+ blocks × 3 filters each, at 120hz this is catastrophically expensive.

**Fix: delete every `<filter>` and `<feGaussianBlur>` / `<feColorMatrix>` / `<feMerge>` from the file. No exceptions. Do not replace them with lighter filters — use zero SVG filters.**

### Bug 2 — Wicks invisible / blocks disconnected
`filter="url(#...)"` on `<Line>` elements silently breaks stroke rendering in `react-native-svg` on many RN versions — the line becomes transparent. Additionally, the wick gradient `url(#wick-...)` may fail to resolve if the `<Defs>` ordering is wrong.

**Fix: remove `filter` prop from all `<Line>` elements. Make wicks thicker and use a solid fallback color that is guaranteed to render.**

### Bug 3 — PowerPoint appearance
Layered `<Rect>` halos with `opacity={0.3}` + no blur = flat colored rectangle behind another rectangle. Looks like a drop shadow from 2010.

**Fix: glow via 3-layer concentric rects with carefully tuned opacities that simulate a gaussian falloff mathematically — all pure geometry, zero GPU/JS filter cost.**

---

## P1 — Regression Baseline

Run: `npx tsc --noEmit && npm run lint`

If either fails on an error that predates this task, document it and fix it. Do not continue with pre-existing type errors.

---

## P2 — Full Visual Rewrite (filter-free)

Replace `SleepHypnogram.tsx` entirely with the implementation below. The only things carried over unchanged are: geometry helpers (`minToX`, `minToW`, `fmtMin`, `fmtAxisHour`), constants (`STAGE_Y`, `STAGE_H`, `SVG_HEIGHT`, `AXIS_H`, `CHART_H`), and the props interface.

---

### 2.1 — New Color System

Replace the flat `STAGE_COLOR` map and the previous `BLOCK_GRADIENTS` with this richer system:

```ts
// Per-stage color palette — three tones used for layered glow geometry
const STAGE_PALETTE: Record<SleepStage, {
  glow: string;    // outermost halo — most saturated, most transparent
  mid: string;     // middle halo ring
  fill: string;    // base fill color (used in gradient top)
  deep: string;    // gradient bottom (darker, richer)
  wick: string;    // wick line color — brighter than fill for visibility
}> = {
  awake: { glow: '#fb923c', mid: '#f97316', fill: '#fb923c', deep: '#c2410c', wick: '#fed7aa' },
  core:  { glow: '#34d399', mid: '#2dd4bf', fill: '#5eead4', deep: '#0f766e', wick: '#a7f3d0' },
  light: { glow: '#60a5fa', mid: '#3b82f6', fill: '#93c5fd', deep: '#1d4ed8', wick: '#bfdbfe' },
  deep:  { glow: '#a855f7', mid: '#9333ea', fill: '#c084fc', deep: '#6b21a8', wick: '#e9d5ff' },
  rem:   { glow: '#34d399', mid: '#2dd4bf', fill: '#5eead4', deep: '#0f766e', wick: '#a7f3d0' },
};

// Flat color for wick gradient defs (must be a static string, not from object)
function stageWickColor(stage: SleepStage): string {
  return STAGE_PALETTE[stage].wick;
}
```

---

### 2.2 — `<Defs>` Block (gradients only, zero filters)

```tsx
<Defs>
  {/* Block fill gradients — vertical, light top → rich bottom */}
  {(Object.keys(STAGE_PALETTE) as SleepStage[]).map((stage) => (
    <LinearGradient key={`fill-${stage}`} id={`fill-${stage}`} x1="0" y1="0" x2="0" y2="1">
      <Stop offset="0"    stopColor={STAGE_PALETTE[stage].fill} stopOpacity="1" />
      <Stop offset="0.55" stopColor={STAGE_PALETTE[stage].mid}  stopOpacity="1" />
      <Stop offset="1"    stopColor={STAGE_PALETTE[stage].deep} stopOpacity="1" />
    </LinearGradient>
  ))}

  {/* Wick transition gradients — top stage color to bottom stage color */}
  {STAGE_PAIRS.map(([a, b]) => (
    <LinearGradient
      key={`wick-${a}-${b}`}
      id={`wick-${a}-${b}`}
      x1="0" y1="0" x2="0" y2="1"
      gradientUnits="objectBoundingBox"
    >
      <Stop offset="0" stopColor={stageWickColor(a)} stopOpacity="1" />
      <Stop offset="1" stopColor={stageWickColor(b)} stopOpacity="1" />
    </LinearGradient>
  ))}

  {/* Boundary line gradient */}
  <LinearGradient id="boundary-grad" x1="0" y1="0" x2="0" y2="1">
    <Stop offset="0"   stopColor="#ffffff" stopOpacity="0.03" />
    <Stop offset="0.5" stopColor="#ffffff" stopOpacity="0.10" />
    <Stop offset="1"   stopColor="#ffffff" stopOpacity="0.03" />
  </LinearGradient>
</Defs>
```

**There must be zero `<filter>` elements in the entire file.**

---

### 2.3 — Three-Layer Geometric Glow (replaces all SVG filters)

This technique mathematically approximates a gaussian falloff using 3 concentric rects with carefully tuned opacity values. It is pure SVG geometry — zero JS thread cost, renders on the native layer at full 120fps.

The opacity values (0.07 / 0.14 / 1.0) simulate the outer, mid, and core zones of a gaussian blur at σ≈4. The expansion values (12/6/0 padding) set the falloff radius.

In `phaseRects` useMemo, for each phase render:

```tsx
// DO NOT use a <G> wrapper — render halos and blocks as separate arrays
// to control global z-order (all halos behind all blocks)

// — Halo layer (push to `halos` array) —
<>
  {/* Outer glow ring — largest, most transparent */}
  <Rect
    key={`glow-outer-${i}`}
    x={x - 6}     y={y - 6}
    width={w + 12} height={h + 12}
    rx={9}         ry={9}
    fill={STAGE_PALETTE[phase.stage].glow}
    opacity={0.07}
  />
  {/* Mid glow ring */}
  <Rect
    key={`glow-mid-${i}`}
    x={x - 3}     y={y - 3}
    width={w + 6}  height={h + 6}
    rx={7}         ry={7}
    fill={STAGE_PALETTE[phase.stage].mid}
    opacity={0.14}
  />
</>

// — Block layer (push to `blocks` array) —
<Rect
  key={`block-${i}`}
  x={x}   y={y}
  width={w} height={h}
  rx={5}   ry={5}
  fill={`url(#fill-${phase.stage})`}
  onPress={() => setActive(phase)}
/>
```

Implement as two separate arrays returned from one `useMemo`:

```tsx
const { phaseHalos, phaseBlocks } = useMemo(() => {
  const halos: React.ReactNode[] = [];
  const blocks: React.ReactNode[] = [];

  data.phases.forEach((phase, i) => {
    const x = minToX(phase.startMin, data.sleepOnsetMin, totalMin, svgW);
    const w = minToW(phase.durationMin, totalMin, svgW);
    const y = STAGE_Y[phase.stage];
    const h = STAGE_H[phase.stage];
    const { glow, mid } = STAGE_PALETTE[phase.stage];

    // Skip halos for 'awake' stage — it's a thin 6px line, halo would look wrong
    if (phase.stage !== 'awake') {
      halos.push(
        <Rect key={`go-${i}`} x={x-6} y={y-6} width={w+12} height={h+12} rx={9} ry={9}
          fill={glow} opacity={0.07} />,
        <Rect key={`gm-${i}`} x={x-3} y={y-3} width={w+6}  height={h+6}  rx={7} ry={7}
          fill={mid}  opacity={0.14} />,
      );
    }

    blocks.push(
      <Rect key={`block-${i}`} x={x} y={y} width={w} height={h} rx={5} ry={5}
        fill={`url(#fill-${phase.stage})`}
        onPress={() => setActive(phase)} />,
    );
  });

  return { phaseHalos: halos, phaseBlocks: blocks };
}, [data.phases, data.sleepOnsetMin, totalMin, svgW]);
```

---

### 2.4 — Wicks: Visible, Connected, No Filter

The wick is the critical visual element that makes the chart look "connected." Wicks must be:
- `strokeWidth={2.5}` — thick enough to read
- No `filter` prop — ever
- Gradient color from `url(#wick-{from}-{to})`
- A second "glow wick" behind it: same position, `strokeWidth={5}`, `opacity={0.2}`, solid mid-color

```tsx
const wicks = useMemo(() => {
  const lines: React.ReactNode[] = [];

  for (let i = 0; i < data.phases.length - 1; i++) {
    const curr = data.phases[i];
    const next = data.phases[i + 1];

    const x  = minToX(curr.startMin + curr.durationMin, data.sleepOnsetMin, totalMin, svgW);
    const y1 = STAGE_Y[curr.stage] + STAGE_H[curr.stage];  // bottom of current block
    const y2 = STAGE_Y[next.stage];                         // top of next block

    const yTop = Math.min(y1, y2);
    const yBot = Math.max(y1, y2);

    // No wick needed if blocks are at same depth (yBot - yTop < 3)
    if (yBot - yTop < 3) continue;

    const wickId = `wick-${curr.stage}-${next.stage}`;
    const glowColor = STAGE_PALETTE[curr.stage].mid;

    lines.push(
      // Soft glow behind the wick (thick + very transparent, no filter needed)
      <Line
        key={`wg-${i}`}
        x1={x} x2={x} y1={yTop} y2={yBot}
        stroke={glowColor}
        strokeWidth={5}
        opacity={0.18}
      />,
      // The actual wick line (sharp, gradient-colored)
      <Line
        key={`wl-${i}`}
        x1={x} x2={x} y1={yTop} y2={yBot}
        stroke={`url(#${wickId})`}
        strokeWidth={2}
        strokeLinecap="round"
      />,
    );
  }

  return lines;
}, [data.phases, data.sleepOnsetMin, totalMin, svgW]);
```

---

### 2.5 — Render Order Inside `<Svg>` (strict)

```tsx
<Svg width={svgW} height={SVG_HEIGHT}>
  {/* 1. Gradients + wick gradient defs — NO filters */}
  <Defs>...</Defs>

  {/* 2. Depth guide lines — faintest, behind everything */}
  {depthGuides}

  {/* 3. Cycle boundary dashed lines */}
  {cycleBoundaries}

  {/* 4. Glow wick lines (thick+transparent) — behind block halos */}
  {wicks}

  {/* 5. Block outer + mid halos — all halos before any fill block */}
  {phaseHalos}

  {/* 6. Block fill rects — on top of halos */}
  {phaseBlocks}

  {/* 7. Time axis labels — always on top */}
  {axisLabels}
</Svg>
```

---

### 2.6 — Performance: Hardware Acceleration on Wrapper View

Wrap the outer `View` with these native acceleration hints. These instruct the native compositor to rasterize the SVG onto a GPU texture layer, eliminating JS-thread repaints on every frame:

```tsx
<View
  style={{ width: svgW, height: SVG_HEIGHT }}
  // iOS: composite the entire SVG as a single GPU layer
  shouldRasterizeIOS
  // Android: upload the SVG to a hardware texture
  renderToHardwareTextureAndroid
>
  <Svg ...>...</Svg>
  {/* tooltip + overlay here, outside Svg */}
</View>
```

**Important:** These props go on the `View` that wraps `<Svg>`, NOT on the `TouchableWithoutFeedback`. Move the `TouchableWithoutFeedback` one level out:

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

    {/* Tooltip — outside SVG, outside rasterized View, so it stays interactive */}
    {active && <Animated.View ...>...</Animated.View>}

    {/* Lock overlay — also outside rasterized View */}
    {!isPaidPlan && <View ...>...</View>}
  </View>
</TouchableWithoutFeedback>
```

---

### 2.7 — Awake Stage: Thin Orange Accent (not a block)

The `awake` stage is a momentary arousal marker, not a sleep stage rectangle. Render it as a thin accent line with a dot cap instead of a rect:

```tsx
// Inside phaseBlocks loop, special-case 'awake':
if (phase.stage === 'awake') {
  const cx = x + w / 2;
  blocks.push(
    // Thin vertical accent line
    <Line
      key={`awake-line-${i}`}
      x1={cx} x2={cx}
      y1={STAGE_Y.awake} y2={STAGE_Y.core}   // from top down to core level
      stroke={STAGE_PALETTE.awake.fill}
      strokeWidth={1.5}
      opacity={0.7}
    />,
    // Orange dot at top
    <Circle
      key={`awake-dot-${i}`}
      cx={cx}
      cy={STAGE_Y.awake}
      r={4}
      fill={STAGE_PALETTE.awake.fill}
    />,
  );
} else {
  blocks.push(<Rect ... />);
}
```

Add `Circle` to the `react-native-svg` import.

---

### 2.8 — Depth Guide Lines (subtle horizontal stage dividers)

```tsx
const depthGuides = useMemo(() => (
  <>
    {(['core', 'light', 'deep'] as SleepStage[]).map((stage) => (
      <Line
        key={`guide-${stage}`}
        x1={0} x2={svgW}
        y1={STAGE_Y[stage] + STAGE_H[stage] / 2}
        y2={STAGE_Y[stage] + STAGE_H[stage] / 2}
        stroke="#ffffff"
        strokeWidth={0.4}
        opacity={0.035}
      />
    ))}
  </>
), [svgW]);
```

---

## P3 — Audit

Run: `npx tsc --noEmit` + `npm run lint` + `npm run format`

### Invariant checklist

- [ ] **Zero `<filter>` elements in the file** — grep for `<filter` and `feGaussianBlur` and confirm 0 results
- [ ] **Zero `filter="url(..."` props on any `<Line>` or `<Rect>`** — grep for `filter=` and confirm 0 results
- [ ] Wicks have `strokeWidth={2}` (sharp line) + a separate `strokeWidth={5} opacity={0.18}` glow line behind them
- [ ] Wicks have NO `filter` prop
- [ ] `phaseHalos` rendered before `phaseBlocks` in SVG
- [ ] `awake` stage renders as `<Line>` + `<Circle>`, not as a `<Rect>`
- [ ] `shouldRasterizeIOS` + `renderToHardwareTextureAndroid` on the SVG wrapper `View`
- [ ] Tooltip and overlay rendered **outside** the rasterized `View`
- [ ] `STAGE_PALETTE` covers all 5 stages: `awake`, `core`, `light`, `deep`, `rem`
- [ ] `STAGE_PAIRS` covers all bidirectional transitions
- [ ] `<Defs>` contains: `fill-{stage}` gradients (×5) + `wick-{a}-{b}` gradients + `boundary-grad` — nothing else
- [ ] Geometry constants unchanged: `STAGE_Y`, `STAGE_H`, `SVG_HEIGHT=260`, `CHART_H=224`
- [ ] Props interface unchanged
- [ ] `React.memo` wrapper present
- [ ] `useMemo` calls: `{ phaseHalos, phaseBlocks }`, `wicks`, `cycleBoundaries`, `axisLabels`, `depthGuides`
- [ ] `typecheck` zero errors
- [ ] `lint` zero warnings

`context.md` update: not required — no structural or convention changes.

---

## Scope Guard

One file. Zero geometry changes. Zero screen layout changes. Zero prop changes.

Out-of-scope observations → log and defer to P3 residual risks.
