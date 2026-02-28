# Codex Task — SleepHypnogram: Gradient Continuity Fix

> Skill: `$staged-delivery-workflow`. Single file: `SleepHypnogram.tsx`. Surgical — do not touch anything else.

---

## Exact Problem

The wick (connector) gradient currently uses `STAGE_MID[a] → STAGE_MID[b]`. The block fill gradient uses `STAGE_TOP → STAGE_MID → STAGE_BOT` top-to-bottom. This means:

- Bottom edge of upper block = `STAGE_BOT[curr]` (dark)
- Top of wick = `STAGE_MID[curr]` (medium) ← **color mismatch — visible seam**
- Bottom of wick = `STAGE_MID[next]` (medium) ← **color mismatch**
- Top edge of lower block = `STAGE_TOP[next]` (light)

Reference requires **zero visible seam**:

```
Upper block bottom edge color  →  must equal  →  wick top color
Lower block top edge color     →  must equal  →  wick bottom color
```

Correct wick gradient:
```
offset 0   stopColor = STAGE_BOT[curr.stage]   ← matches bottom of upper block
offset 1   stopColor = STAGE_TOP[next.stage]   ← matches top of lower block
```

---

## P1 — Baseline

```bash
npx tsc --noEmit && npm run lint
```

---

## P2 — Two Changes Only

### Change 1: Update wick gradient `<LinearGradient>` defs in `<Defs>`

Find the wick gradient block inside `<Defs>`. Currently it looks like:
```tsx
{STAGE_PAIRS.map(([a, b]) => (
  <LinearGradient key={wickId(a,b)} id={wickId(a,b)} x1="0" y1="0" x2="0" y2="1">
    <Stop offset="0" stopColor={STAGE_MID[a]} stopOpacity="0.9" />
    <Stop offset="1" stopColor={STAGE_MID[b]} stopOpacity="0.9" />
  </LinearGradient>
))}
```

Replace with:
```tsx
{STAGE_PAIRS.map(([a, b]) => (
  <LinearGradient key={wickId(a,b)} id={wickId(a,b)} x1="0" y1="0" x2="0" y2="1">
    <Stop offset="0"    stopColor={STAGE_BOT[a]} stopOpacity="1" />
    <Stop offset="0.4"  stopColor={STAGE_MID[a]} stopOpacity="0.95" />
    <Stop offset="0.6"  stopColor={STAGE_MID[b]} stopOpacity="0.95" />
    <Stop offset="1"    stopColor={STAGE_TOP[b]} stopOpacity="1" />
  </LinearGradient>
))}
```

4 stops instead of 2: the transition midpoint blends smoothly through both stage mid-colors before arriving at the top color of the destination block.

### Change 2: Glow wick opacity and color

The glow wick rect (the wider, transparent one) should use the mid-color of the current stage, not a gradient:

Find the glow wick `<Rect>` in the `wicks` useMemo:
```tsx
// BEFORE:
fill={`url(#${gid})`}
opacity={0.15}

// AFTER:
fill={STAGE_MID[curr.stage]}
opacity={0.12}
```

This prevents the glow halo from fighting with the sharp wick's gradient.

---

## P3 — Audit

```bash
npx tsc --noEmit && npm run lint && npm run format
```

- [ ] Wick gradient offset `0` uses `STAGE_BOT[a]` — matches bottom of upper block
- [ ] Wick gradient offset `1` uses `STAGE_TOP[b]` — matches top of lower block  
- [ ] 4 stops per wick gradient
- [ ] Glow wick uses solid `STAGE_MID[curr.stage]` fill, not gradient
- [ ] No other changes made
- [ ] Zero type errors, zero lint warnings

`context.md`: not required.
