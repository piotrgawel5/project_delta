# Codex Task — SleepHypnogram: Figma Organic Connector Implementation

> Skill: `$staged-delivery-workflow`. Single file: `apps/mobile/components/sleep/SleepHypnogram.tsx`.
> Stack: Expo RN 54 · NativeWind v4 · react-native-svg · TypeScript strict.

---

## Pre-Flight

1. Open `SleepHypnogram.tsx`. Read it fully.
2. Confirm `react-native-svg` version in `apps/mobile/package.json` — print it.
3. Validation: `npx tsc --noEmit` + `npm run lint` from `apps/mobile/`.
4. One file changes. Nothing else.

---

## What Needs to Change

Currently blocks are `<Rect rx={r}>` — all four corners are equally rounded.
The Figma design uses **per-corner radius**: the corner(s) adjacent to the connector are set to `rx=0` (square), and a 3-piece connector assembly (spine rect + 2 quarter-circle fillers) bridges the gap.

This is the exact technique from the Figma SVGs provided:
- `Light.svg` path: bottom-right corner square (`V31` — no curve)
- `Awake.svg` path: top-left corner square (`M-1 -1` — no curve)
- `Rectangle_1`: 4px wide gradient spine
- `Vector_2` (`M4 0 V4 C4,2 2,0 0,0 H4 Z`): quarter-circle filler at top of spine
- `Vector_1`: symmetric quarter-circle filler at bottom of spine

---

## Constants to Add

```ts
// Corner radius for all blocks — controls both block rounding AND connector width
const CORNER_R = 8;
```

Add this near the other constants. Replace any existing hard-coded `rx={5}` or `rx={4}` values on blocks with `CORNER_R`.

---

## P0 — No type changes. Skip.

---

## P1 — Regression Baseline

```bash
npx tsc --noEmit && npm run lint
```

Fix any pre-existing errors. Do not proceed if failing.

---

## P2 — Implementation

### Step 1: `makeBlockPath` utility function

Add this pure function at the TOP of the file, outside the component, alongside the other geometry helpers:

```ts
/**
 * Generates an SVG path string for a rounded rect with per-corner radius control.
 * Pass sq.tr = true to make the top-right corner square (radius = 0), etc.
 * Uses quadratic bezier curves (Q) for rounded corners — compatible with react-native-svg.
 */
function makeBlockPath(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  sq?: { tl?: boolean; tr?: boolean; br?: boolean; bl?: boolean },
): string {
  const tl = sq?.tl ? 0 : r;
  const tr = sq?.tr ? 0 : r;
  const br = sq?.br ? 0 : r;
  const bl = sq?.bl ? 0 : r;

  return [
    `M ${x + tl} ${y}`,
    `H ${x + w - tr}`,
    tr > 0 ? `Q ${x + w} ${y} ${x + w} ${y + tr}` : `L ${x + w} ${y}`,
    `V ${y + h - br}`,
    br > 0 ? `Q ${x + w} ${y + h} ${x + w - br} ${y + h}` : `L ${x + w} ${y + h}`,
    `H ${x + bl}`,
    bl > 0 ? `Q ${x} ${y + h} ${x} ${y + h - bl}` : `L ${x} ${y + h}`,
    `V ${y + tl}`,
    tl > 0 ? `Q ${x} ${y} ${x + tl} ${y}` : `L ${x} ${y}`,
    'Z',
  ].join(' ');
}
```

---

### Step 2: Determine square corners per block

For each phase at index `i`, determine which corners face a connector:

```ts
/**
 * Returns which corners of a block should be square (radius = 0).
 * A corner is square when a connector passes through it.
 *
 * Connector direction rules:
 *   RIGHT exit (to next block):
 *     - next is BELOW (nextY > currY) → curr's bottomRight is square
 *     - next is ABOVE (nextY < currY) → curr's topRight is square
 *
 *   LEFT entry (from prev block):
 *     - prev was BELOW (prevY > currY) → curr's bottomLeft is square
 *     - prev was ABOVE (prevY < currY) → curr's topLeft is square
 */
function getSquareCorners(
  phase: SleepPhase,
  prev: SleepPhase | null,
  next: SleepPhase | null,
): { tl?: boolean; tr?: boolean; br?: boolean; bl?: boolean } {
  const sq: { tl?: boolean; tr?: boolean; br?: boolean; bl?: boolean } = {};

  const currY = STAGE_Y[phase.stage];

  if (next && next.stage !== 'awake' && phase.stage !== 'awake') {
    const nextY = STAGE_Y[next.stage];
    if (nextY > currY) sq.br = true;   // next is below → bottomRight square
    if (nextY < currY) sq.tr = true;   // next is above → topRight square
  }

  if (prev && prev.stage !== 'awake' && phase.stage !== 'awake') {
    const prevY = STAGE_Y[prev.stage];
    if (prevY > currY) sq.bl = true;   // prev was below → bottomLeft square
    if (prevY < currY) sq.tl = true;   // prev was above → topLeft square
  }

  return sq;
}
```

---

### Step 3: Connector gradient defs

In `<Defs>`, ensure wick gradient definitions exist for all stage pairs. The gradient goes from the BOTTOM color of the upper block to the TOP color of the lower block:

```tsx
{STAGE_PAIRS.map(([a, b]) => {
  // a is the stage with smaller STAGE_Y (higher on screen = comes first in gradient, at top)
  // b is the stage with larger STAGE_Y (lower on screen = comes last in gradient, at bottom)
  // Always define gradient with top stage as 'a' and bottom stage as 'b'
  return (
    <LinearGradient
      key={`wick-${a}-${b}`}
      id={`wick-${a}-${b}`}
      x1="0" y1="0" x2="0" y2="1"
    >
      {/* offset 0 = top of connector = matches BOTTOM color of upper block */}
      <Stop offset="0"   stopColor={STAGE_BOT[a]} stopOpacity="1" />
      <Stop offset="0.4" stopColor={STAGE_MID[a]} stopOpacity="1" />
      <Stop offset="0.6" stopColor={STAGE_MID[b]} stopOpacity="1" />
      {/* offset 1 = bottom of connector = matches TOP color of lower block */}
      <Stop offset="1"   stopColor={STAGE_TOP[b]} stopOpacity="1" />
    </LinearGradient>
  );
})}
```

Also add a helper to get the correct gradient ID regardless of which block is upper/lower:
```ts
function connectorGradId(stageA: SleepStage, stageB: SleepStage): string {
  // Always order by STAGE_Y so gradient goes top→bottom
  const [upper, lower] = STAGE_Y[stageA] <= STAGE_Y[stageB]
    ? [stageA, stageB]
    : [stageB, stageA];
  return `wick-${upper}-${lower}`;
}
```

Make sure `STAGE_PAIRS` covers all needed pairs for this to work.

---

### Step 4: Rewrite `phaseBlocks` and create `connectors` useMemo

Replace the current `phaseBlocks` useMemo AND the current `wicks` useMemo with three new useMemos:

#### 4a. `phaseBlocks` useMemo — use `<Path>` not `<Rect>`

```tsx
const phaseBlocks = useMemo(() => {
  const nodes: React.ReactNode[] = [];

  data.phases.forEach((phase, i) => {
    const x = minToX(phase.startMin, data.sleepOnsetMin, totalMin, svgW);
    const w = minToW(phase.durationMin, totalMin, svgW);
    const y = STAGE_Y[phase.stage];
    const h = STAGE_H[phase.stage];

    if (phase.stage === 'awake') {
      // Awake: thin vertical accent line + dot cap
      const cx = x + w / 2;
      const dotY = STAGE_Y.core - 22;
      nodes.push(
        <Rect
          key={`awake-spine-${i}`}
          x={cx - 3}
          y={dotY + 6}
          width={6}
          height={STAGE_Y.core - (dotY + 6)}
          fill={`url(#f-awake)`}
          rx={2} ry={2}
          opacity={0.85}
        />,
        <Circle
          key={`awake-dot-${i}`}
          cx={cx}
          cy={dotY}
          r={4}
          fill={STAGE_MID.awake}
        />,
      );
      return;
    }

    const prev = i > 0 ? data.phases[i - 1] : null;
    const next = i < data.phases.length - 1 ? data.phases[i + 1] : null;
    const sq = getSquareCorners(phase, prev, next);

    nodes.push(
      <Path
        key={`block-${i}`}
        d={makeBlockPath(x, y, w, h, CORNER_R, sq)}
        fill={`url(#f-${phase.stage})`}
        onPress={() => setActive(phase)}
      />,
    );
  });

  return nodes;
}, [data.phases, data.sleepOnsetMin, totalMin, svgW]);
```

#### 4b. `connectors` useMemo — spine rect + two quarter-circle fillers

This replaces the old `wicks` useMemo entirely.

```tsx
const connectors = useMemo(() => {
  const nodes: React.ReactNode[] = [];
  const r = CORNER_R;

  for (let i = 0; i < data.phases.length - 1; i++) {
    const curr = data.phases[i];
    const next = data.phases[i + 1];

    // Skip awake stage connections — awake is rendered separately
    if (curr.stage === 'awake' || next.stage === 'awake') continue;

    // Transition x: right edge of curr block = left edge of next block
    const T = minToX(curr.startMin + curr.durationMin, data.sleepOnsetMin, totalMin, svgW);

    const currTop = STAGE_Y[curr.stage];
    const currBot = STAGE_Y[curr.stage] + STAGE_H[curr.stage];
    const nextTop = STAGE_Y[next.stage];
    const nextBot = STAGE_Y[next.stage] + STAGE_H[next.stage];

    // The vertical gap between the two blocks
    const gapTop = Math.min(currBot, nextTop);
    const gapBot = Math.max(currTop, nextBot); // wait — recalculate:

    // Correct gap calculation:
    // upperBlock = whichever has smaller STAGE_Y (higher on screen)
    // lowerBlock = whichever has larger STAGE_Y (lower on screen)
    const [upperStage, lowerStage] = STAGE_Y[curr.stage] <= STAGE_Y[next.stage]
      ? [curr.stage, next.stage]
      : [next.stage, curr.stage];

    const gapY1 = STAGE_Y[upperStage] + STAGE_H[upperStage]; // bottom of upper block
    const gapY2 = STAGE_Y[lowerStage];                        // top of lower block
    const gapH  = gapY2 - gapY1;

    if (gapH <= 0) continue; // blocks at same level or overlapping — no connector needed

    const gradId = connectorGradId(curr.stage, next.stage);

    // ── Connector spine ──────────────────────────────────────────────────
    // Centered on T, width = r, spans the gap vertically
    const spineX = T - r / 2;

    nodes.push(
      <Rect
        key={`spine-${i}`}
        x={spineX}
        y={gapY1}
        width={r}
        height={gapH}
        fill={`url(#${gradId})`}
      />,
    );

    // ── Filler 1 — top of connector (Vector_2 style) ────────────────────
    // Fills the concave outer notch at (T + r/2, gapY1).
    // Shape: convex quarter-circle in the top-right of an r×r box.
    // Path: from (r, 0) → down to (r, r) → cubic curve back to (0, 0) → right to (r, 0)
    // This fills the space between the upper block's bottom edge and the connector's right edge.
    // Fill color = STAGE_TOP of lower block (matches what you see entering the lower block)
    nodes.push(
      <Path
        key={`filler-top-${i}`}
        d={[
          `M ${T + r / 2} ${gapY1}`,
          `V ${gapY1 + r}`,
          `C ${T + r / 2} ${gapY1 + r / 2}  ${T} ${gapY1}  ${T - r / 2} ${gapY1}`,
          `H ${T + r / 2}`,
          `Z`,
        ].join(' ')}
        fill={STAGE_TOP[lowerStage]}
        opacity={0.4}
      />,
    );

    // ── Filler 2 — bottom of connector (Vector_1 style) ─────────────────
    // Fills the concave outer notch at (T + r/2, gapY2).
    // Shape: convex quarter-circle in the bottom-right of an r×r box.
    // Path: from (T-r/2, gapY2) → up to (T-r/2, gapY2-r) → curve back to (T+r/2, gapY2) → close
    nodes.push(
      <Path
        key={`filler-bot-${i}`}
        d={[
          `M ${T - r / 2} ${gapY2}`,
          `V ${gapY2 - r}`,
          `C ${T - r / 2} ${gapY2 - r / 2}  ${T} ${gapY2}  ${T + r / 2} ${gapY2}`,
          `H ${T - r / 2}`,
          `Z`,
        ].join(' ')}
        fill={STAGE_BOT[upperStage]}
        opacity={0.4}
      />,
    );
  }

  return nodes;
}, [data.phases, data.sleepOnsetMin, totalMin, svgW]);
```

---

### Step 5: Update SVG render order

Replace `{wicks}` with `{connectors}` in the SVG render order. Keep everything else the same:

```tsx
<Svg width={svgW} height={SVG_HEIGHT}>
  <Defs>...</Defs>
  {depthGuides}          {/* faintest, behind everything */}
  {cycleBoundaries}      {/* dashed vertical lines */}
  {connectors}           {/* spine rects + quarter-circle fillers */}
  {phaseBlocks}          {/* block paths on top */}
  {axisLabels}           {/* time labels always on top */}
</Svg>
```

Remove any remaining reference to `{wicks}` or the old `wicks` useMemo.

---

### Step 6: Cleanup

- Delete the old `wicks` useMemo entirely.
- Delete the old `STAGE_PAIRS` wick gradient defs if they used the wrong gradient direction (replace per Step 3 above).
- Remove any `phaseHalos` array if it still exists — we do not want outer halo rects.
- Ensure `phaseBlocks` renders `<Path>` only — no `<Rect>` for non-awake stages.

---

## P3 — Audit

Run: `npx tsc --noEmit` + `npm run lint` + `npm run format`

### Invariant checklist (grep these before declaring done)

```bash
# Must return ZERO results — no gradient stroke on Line:
grep -n '<Line.*stroke="url' SleepHypnogram.tsx

# Must return ZERO results — no SVG filters:
grep -n 'feGaussianBlur\|<filter\|filter="url' SleepHypnogram.tsx

# Must return results — blocks use Path not Rect:
grep -n '<Path.*makeBlockPath' SleepHypnogram.tsx

# Must return results — connectors useMemo exists:
grep -n 'connectors' SleepHypnogram.tsx

# Must return results — connector spine rect:
grep -n 'spine-' SleepHypnogram.tsx

# Must return results — filler paths:
grep -n 'filler-top\|filler-bot' SleepHypnogram.tsx
```

### Manual verification checklist

- [ ] `makeBlockPath` function is defined outside the component
- [ ] `getSquareCorners` function is defined outside the component
- [ ] `connectorGradId` function is defined outside the component
- [ ] Wick gradients use `STAGE_BOT[a]` at offset 0 and `STAGE_TOP[b]` at offset 1
- [ ] `connectors` useMemo replaces old `wicks` useMemo
- [ ] `phaseBlocks` renders `<Path>` for non-awake stages
- [ ] Awake stage still renders as `<Circle>` + `<Rect>` spine
- [ ] `shouldRasterizeIOS` + `renderToHardwareTextureAndroid` on SVG wrapper View
- [ ] Tooltip outside rasterized View
- [ ] `CORNER_R = 8` constant added
- [ ] `React.memo` wrapper preserved
- [ ] `typecheck` zero errors
- [ ] `lint` zero warnings

`context.md` update: not required — no structural or convention changes.
