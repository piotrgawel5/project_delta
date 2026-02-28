# Codex Task — SleepHypnogram: Connector Width Fix (Surgical, One Concern Only)

> Skill: `$staged-delivery-workflow`. Single file: `apps/mobile/components/sleep/SleepHypnogram.tsx`.
> This is a surgical change. Do not touch anything else.

---

## Pre-Flight

1. Open `SleepHypnogram.tsx`. Locate the `wicks` useMemo.
2. Print every `<Rect>` inside it so you can confirm what currently renders.
3. Validation: `npx tsc --noEmit` + `npm run lint`.

---

## Root Cause (one sentence)

The wick `<Rect>` elements have `width={2}` and `width={6}`. In the reference design connectors are ~14px wide — wide enough to visually bridge two adjacent blocks into a single connected unit, not a thin line between two pills.

---

## Visual Analysis of Reference vs Current

```
REFERENCE connector cross-section:
  ┌──────────────────┐   ← core block (teal), full rounded corners
  │                  │
  └────────┐  ┌──────┘   ← bottom of core block
           │  │           ← connector rect: ~14px wide, gradient fill
  ┌────────┘  └──────┐   ← top of light block
  │                  │
  └──────────────────┘   ← light block (blue), full rounded corners

CURRENT connector cross-section:
  ┌──────────────────┐
  │                  │
  └────────┐└────────┘   ← bottom of core block
           ██             ← 2px rect — looks like a scratch mark
  ┌────────┘┌────────┐   ← top of light block
  │                  │
  └──────────────────┘
```

---

## P0 — No type changes needed. Skip.

## P1 — Regression baseline

```bash
npx tsc --noEmit && npm run lint
```

Fix any pre-existing errors. Do not proceed if failing.

---

## P2 — The Only Change: Connector Dimensions

### In the `wicks` useMemo, change these values:

**Glow rect** (the wider, transparent one behind the sharp wick):
```tsx
// BEFORE:
x={xEdge - 3}
width={6}
opacity={0.20}

// AFTER:
x={xEdge - 7}
width={14}
opacity={0.15}
```

**Sharp wick rect** (the visible connector):
```tsx
// BEFORE:
x={xEdge - 1}
width={2}
opacity={0.90}

// AFTER:
x={xEdge - 5}
width={10}
opacity={0.85}
rx={3}
ry={3}
```

That is the entire change. `xEdge`, `yTop`, `yBot`, `wickH`, gradient IDs — everything else stays identical.

### Why these exact numbers

- `width={10}` on the sharp wick makes it visually "bridge" the gap between blocks
- `x={xEdge - 5}` centers it on the block boundary (half of 10)
- `rx={3}` gives the connector slight rounding so it doesn't look like a hard rectangle between the rounded blocks
- The glow rect at `width={14}` extends 2px beyond each edge of the sharp wick, creating the soft luminous halo without SVG filters
- `opacity={0.85}` on the sharp wick keeps it slightly transparent so the gradient reads clearly against the black background

### Awake connector (the tall orange spine)

The awake marker's vertical line connecting it downward to the core block should also use a rect, not a line, and be wider:

Find where the awake stage renders its connecting `<Line>` between the dot and the core block. Replace it with:

```tsx
// BEFORE (thin line):
<Line
  key={`aw-l-${i}`}
  x1={cx} x2={cx}
  y1={dotY + 4} y2={lineY2}
  stroke={STAGE_MID.awake}
  strokeWidth={1.5}
  opacity={0.8}
/>

// AFTER (rect — same gradient fix, same width logic):
<Rect
  key={`aw-r-${i}`}
  x={cx - 4}
  y={dotY + 4}
  width={8}
  height={lineY2 - (dotY + 4)}
  fill={`url(#f-awake)`}
  opacity={0.85}
  rx={2}
  ry={2}
/>
```

This makes the orange awake spine match the reference — a thick gradient bar descending from the dot.

---

## P3 — Audit

Run: `npx tsc --noEmit` + `npm run lint` + `npm run format`

Checklist:
- [ ] Sharp wick `<Rect>` has `width={10}` and `x={xEdge - 5}`
- [ ] Glow wick `<Rect>` has `width={14}` and `x={xEdge - 7}`
- [ ] Sharp wick has `rx={3} ry={3}`
- [ ] No `<Line stroke="url(...)">` anywhere in file — grep confirms zero
- [ ] No `<filter>` anywhere in file — grep confirms zero
- [ ] Awake vertical spine uses `<Rect>` not `<Line>`
- [ ] Geometry constants (`STAGE_Y`, `STAGE_H`, `SVG_HEIGHT`) unchanged
- [ ] Props interface unchanged
- [ ] `typecheck` zero errors, `lint` zero warnings

`context.md` update: not required.
