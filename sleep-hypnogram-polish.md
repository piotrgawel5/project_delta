# Codex Task — SleepHypnogram Visual Polish (Glow · Gradients · Depth)

> Skill: `$staged-delivery-workflow` — P0 is skipped (no type changes). Start at P1 (verify no regressions), then P2 (visual only). Single file changes only.

---

## Pre-Flight

1. Confirm `apps/mobile/components/sleep/SleepHypnogram.tsx` exists and currently renders correctly (blocks visible, proportional widths, wicks between blocks).
2. Only file changing: `apps/mobile/components/sleep/SleepHypnogram.tsx`
3. Validation: `npx tsc --noEmit` + `npm run lint` from `apps/mobile/`
4. This task is **purely additive SVG visual layer** — no geometry constants change, no props change, no mock data change, no screen layout change.

---

## Objective

Add a premium visual layer to the existing correct chart implementation using SVG `<filter>`, `<LinearGradient>` block fills, enhanced wicks with glow, and subtle depth cues. The result must match the Apple Health Sleep Stages aesthetic: rich saturated blocks with a soft outer glow, smooth gradient-colored connectors, and a sense of depth/luminosity.

---

## P1 — Regression Check

Before touching anything, run:
```bash
npx tsc --noEmit && npm run lint
```
If either fails, fix the pre-existing error first and document it. Do not proceed if checks fail.

---

## P2 — Visual Polish (the entire change set)

### 2.1 — Add SVG `<Defs>` Section (expanded)

The `<Defs>` block currently has wick gradient definitions. Expand it to include:

#### A. Per-stage block fill gradients (vertical, light→base)

Each stage gets a `<LinearGradient>` for the `fill` of its `<Rect>` blocks. The gradient goes top→bottom, from a lightened/saturated version of the color at the top to the base color at the bottom, giving each block a subtle 3D convex appearance.

```tsx
// Block fill gradients — id pattern: "fill-{stage}"
const BLOCK_GRADIENTS: Array<{
  stage: SleepStage;
  id: string;
  top: string;    // lighter/brighter top edge
  mid: string;    // base color at center
  bot: string;    // slightly darker bottom edge
}> = [
  { stage: 'awake', id: 'fill-awake', top: '#fdba74', mid: '#f97316', bot: '#c2410c' },
  { stage: 'core',  id: 'fill-core',  top: '#5eead4', mid: '#2dd4bf', bot: '#0f766e' },
  { stage: 'light', id: 'fill-light', top: '#93c5fd', mid: '#60a5fa', bot: '#2563eb' },
  { stage: 'deep',  id: 'fill-deep',  top: '#c084fc', mid: '#9333ea', bot: '#6b21a8' },
  { stage: 'rem',   id: 'fill-rem',   top: '#5eead4', mid: '#2dd4bf', bot: '#0f766e' },
];
```

Add inside `<Defs>`:
```tsx
{BLOCK_GRADIENTS.map(({ id, top, mid, bot }) => (
  <LinearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
    <Stop offset="0"   stopColor={top} stopOpacity="1" />
    <Stop offset="0.5" stopColor={mid} stopOpacity="1" />
    <Stop offset="1"   stopColor={bot} stopOpacity="1" />
  </LinearGradient>
))}
```

#### B. Glow filter (feGaussianBlur + feComposite)

Add a single `<filter>` definition for the block glow effect:

```tsx
<filter id="block-glow" x="-40%" y="-40%" width="180%" height="180%">
  {/* Step 1: blur the source graphic to create the glow halo */}
  <feGaussianBlur stdDeviation="3.5" result="blur" />
  {/* Step 2: composite the original sharp graphic on top of the blur */}
  <feComposite in="SourceGraphic" in2="blur" operator="over" />
</filter>
```

#### C. Subtle ambient glow filter (softer, for the outer halo only)

```tsx
<filter id="outer-glow" x="-60%" y="-60%" width="220%" height="220%">
  <feGaussianBlur stdDeviation="6" result="blur" />
  <feColorMatrix type="saturate" values="2" in="blur" result="saturated" />
  <feComposite in="saturated" in2="SourceGraphic" operator="out" result="halo" />
  <feMerge>
    <feMergeNode in="halo" />
    <feMergeNode in="SourceGraphic" />
  </feMerge>
</filter>
```

#### D. Wick glow filter (thin line glow)

```tsx
<filter id="wick-glow" x="-500%" y="-20%" width="1100%" height="140%">
  <feGaussianBlur stdDeviation="2" result="blur" />
  <feMerge>
    <feMergeNode in="blur" />
    <feMergeNode in="SourceGraphic" />
  </feMerge>
</filter>
```

---

### 2.2 — Render Each Block as Two Layered Rects

Replace the current single `<Rect>` per phase with **two stacked rects** — a glow halo behind and the filled block on top. This gives the blocks their luminous, glowing appearance.

In the `phaseRects` `useMemo`, change each block from:
```tsx
<Rect key={...} x={x} y={y} width={w} height={h} rx={4} ry={4} fill={STAGE_COLOR[phase.stage]} onPress={...} />
```

To a `<G>` (group) containing:
```tsx
<G key={`phase-${i}`}>
  {/* Layer 1: outer glow halo — slightly larger, semi-transparent, blurred */}
  <Rect
    x={x - 2}
    y={y - 2}
    width={w + 4}
    height={h + 4}
    rx={6}
    ry={6}
    fill={STAGE_COLOR[phase.stage]}
    opacity={0.35}
    filter="url(#outer-glow)"
  />
  {/* Layer 2: main block with gradient fill and subtle inner glow */}
  <Rect
    x={x}
    y={y}
    width={w}
    height={h}
    rx={4}
    ry={4}
    fill={`url(#fill-${phase.stage})`}
    filter="url(#block-glow)"
    onPress={() => setActive(phase)}
  />
</G>
```

**Important:** The `onPress` stays on Layer 2 (the visible block), not the halo. The halo has no interaction.

---

### 2.3 — Enhance Connector Wicks

Change wicks from thin 1.5px lines to glowing 2px lines with the wick-glow filter.

In the `wicks` `useMemo`, update each `<Line>`:
```tsx
<Line
  key={`wick-${i}`}
  x1={x} x2={x}
  y1={Math.min(y1, y2)}
  y2={Math.max(y1, y2)}
  stroke={`url(#${gradId(curr.stage, next.stage)})`}
  strokeWidth={2}
  filter="url(#wick-glow)"
/>
```

Also increase wick gradient richness — update the wick `<LinearGradient>` stop colors to use the **lighter top color** from `BLOCK_GRADIENTS` instead of the flat `STAGE_COLOR`:

```tsx
// Helper to get the top highlight color for a stage
const STAGE_HIGHLIGHT: Record<SleepStage, string> = {
  awake: '#fdba74',
  core:  '#5eead4',
  light: '#93c5fd',
  deep:  '#c084fc',
  rem:   '#5eead4',
};

// In wick gradient defs:
{STAGE_PAIRS.map(([a, b]) => (
  <LinearGradient key={gradId(a,b)} id={gradId(a,b)} x1="0" y1="0" x2="0" y2="1">
    <Stop offset="0"   stopColor={STAGE_HIGHLIGHT[a]} stopOpacity="0.9" />
    <Stop offset="1"   stopColor={STAGE_HIGHLIGHT[b]} stopOpacity="0.9" />
  </LinearGradient>
))}
```

---

### 2.4 — Cycle Boundary Lines: Subtle Upgrade

Change from solid gray to a very subtle white-to-transparent vertical gradient:

Add to `<Defs>`:
```tsx
<LinearGradient id="boundary-grad" x1="0" y1="0" x2="0" y2="1">
  <Stop offset="0"   stopColor="#ffffff" stopOpacity="0.06" />
  <Stop offset="0.5" stopColor="#ffffff" stopOpacity="0.12" />
  <Stop offset="1"   stopColor="#ffffff" stopOpacity="0.04" />
</LinearGradient>
```

Update cycle boundary `<Line>` in the `cycleBoundaries` useMemo:
```tsx
<Line
  key={`cb-${i}`}
  x1={x} x2={x}
  y1={0} y2={CHART_H}
  stroke="url(#boundary-grad)"
  strokeWidth={1}
  strokeDasharray="3,6"
/>
```

---

### 2.5 — Chart Background: Subtle Depth Grid

Add three horizontal level indicator lines — very subtle, behind everything — to give a sense of the y-axis depth layers. These go at the vertical center of each stage band.

Render these **before** cycle boundaries (first child inside `<Svg>`):

```tsx
{/* Depth level guides — behind everything */}
{(['core', 'light', 'deep'] as SleepStage[]).map((stage) => (
  <Line
    key={`level-${stage}`}
    x1={0}
    x2={svgW}
    y1={STAGE_Y[stage] + STAGE_H[stage] / 2}
    y2={STAGE_Y[stage] + STAGE_H[stage] / 2}
    stroke="#ffffff"
    strokeWidth={0.5}
    strokeOpacity={0.04}
    strokeDasharray="1,8"
  />
))}
```

---

### 2.6 — Render Order (final, after all changes)

Inside `<Svg>`, render strictly in this order so z-layering is correct:

```
1. <Defs> (all gradients + filters)
2. Depth level guide lines (faintest, bottommost)
3. Cycle boundary dashed lines
4. Connector wick lines (with glow filter)
5. Phase blocks — halo layer (G → Rect halo with outer-glow filter)
6. Phase blocks — fill layer (G → Rect fill with block-glow filter)
7. Time axis SvgText labels
```

**Implementation note:** The two-layer phase rendering (halo + fill) should render all halos first, then all filled blocks on top — so no block's halo bleeds over a neighboring block's fill. Restructure the `phaseRects` useMemo to return two separate arrays: `phaseHalos` and `phaseBlocks`, rendered in that order:

```tsx
const { phaseHalos, phaseBlocks } = useMemo(() => {
  const halos: React.ReactNode[] = [];
  const blocks: React.ReactNode[] = [];
  data.phases.forEach((phase, i) => {
    const x = minToX(phase.startMin, data.sleepOnsetMin, totalMin, svgW);
    const w = minToW(phase.durationMin, totalMin, svgW);
    const y = STAGE_Y[phase.stage];
    const h = STAGE_H[phase.stage];
    halos.push(
      <Rect
        key={`halo-${i}`}
        x={x - 2} y={y - 2} width={w + 4} height={h + 4}
        rx={6} ry={6}
        fill={STAGE_COLOR[phase.stage]}
        opacity={0.3}
        filter="url(#outer-glow)"
      />
    );
    blocks.push(
      <Rect
        key={`block-${i}`}
        x={x} y={y} width={w} height={h}
        rx={4} ry={4}
        fill={`url(#fill-${phase.stage})`}
        filter="url(#block-glow)"
        onPress={() => setActive(phase)}
      />
    );
  });
  return { phaseHalos: halos, phaseBlocks: blocks };
}, [data.phases, data.sleepOnsetMin, totalMin, svgW]);
```

---

## P3 — Audit

Run: `npx tsc --noEmit` + `npm run lint` + `npm run format`

### Invariant checklist

- [ ] No geometry constants changed (`STAGE_Y`, `STAGE_H`, `SVG_HEIGHT`, `CHART_H`)
- [ ] No props interface changed
- [ ] No mock data changed
- [ ] No screen layout changed
- [ ] `phaseHalos` rendered before `phaseBlocks` in SVG
- [ ] All `onPress` handlers are on `phaseBlocks` layer only (not halos)
- [ ] Filter IDs are unique: `block-glow`, `outer-glow`, `wick-glow`, `boundary-grad`, `fill-{stage}`, `wick-{a}-{b}`
- [ ] `STAGE_HIGHLIGHT` map covers all 5 stages including `rem`
- [ ] `BLOCK_GRADIENTS` array covers all 5 stages
- [ ] Tooltip still renders correctly (position logic unchanged)
- [ ] `isPaidPlan=false` overlay still renders (unchanged)
- [ ] `isLoading=true` skeleton still renders (unchanged)
- [ ] `React.memo` wrapper preserved
- [ ] All 4 `useMemo` calls preserved (`cycleBoundaries`, `wicks`, `{ phaseHalos, phaseBlocks }`, `axisLabels`)
- [ ] `typecheck` zero errors
- [ ] `lint` zero warnings

`context.md` update: not required — no structural or convention changes.

---

## Scope Guard

**Do NOT touch anything else.** This task is one file, visual layer only.

Out-of-scope observations go in residual risks section of P3 summary.
