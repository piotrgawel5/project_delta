# packages/docs/ui-sleep-hypnogram-forensic-analysis.md

> Purpose: a production-ready, agent-consumable forensic spec and implementation checklist to replicate the _Sleep Stages_ hypnogram (second screenshot) pixel-faithfully in `apps/mobile/components/sleep/SleepHypnogram.tsx`.
> Required by agents: read `packages/docs/context.md` before acting. Use this file as the primary spec for UI-forensics driven work.

---

## Title

**Sleep Hypnogram — Forensic Visual Decomposition & Implementation Rules**
Version: 0.1
Target: `apps/mobile/components/sleep/SleepHypnogram.tsx` (Expo React Native, react-native-svg)
Read-before-run: `packages/docs/context.md`

---

## Executive technical summary (short)

This document reverse-engineers the Apple-Health–style hypnogram presented in the reference image and prescribes deterministic rendering rules, color tokens, spacing system, and interaction/animation models suitable for `react-native-svg`. Do not use pre-built chart libraries. The design is a time-series of rounded rectangular stage segments mapped along a continuous time axis with discrete vertical banding for sleep stages. Key constraints: pixel fidelity for rounded caps and transitions, sub-second animations at 60fps, memory-safety for low-end Android, and accessible semantics for VoiceOver/TalkBack.

---

## How the agent must start

1. Read `packages/docs/context.md` fully — this file contains architectural constraints and relevant types.
2. Confirm `@project-delta/shared` contains `SleepPhase` types; use them.
3. Use only `react-native-svg` for rendering primitives; use `react-native-reanimated` only for animation drivers, not for core layout math.
4. Produce incremental artifacts by staged workflow (static MD → skeleton SVG → dynamic mapping → interactions → performance hardening).

---

## Full visual decomposition (atomic primitives)

1. **Background**: solid near-black canvas. Approx: `#0a0a0a` — not pure `#000` to preserve thin gridline contrast.
2. **Grid**: vertical dotted gridlines at regular time intervals (hour ticks). Dot pattern: thin dashed dots with alpha ~0.12 on dark background.
3. **Stage bands**: four stacked, vertical bands (from top to bottom): Awake (thin), REM, Core, Deep (thickest). Bands are logical containers; the bars occupy their band's vertical range.
4. **Segments**: rounded-rectangle vertical blocks anchored to a continuous baseline; each segment = contiguous time period in one stage.
5. **Rounded caps**: both top and bottom ends of each segment are rounded (caps), producing pill shapes when segments are short.
6. **Transitions**: stage transitions render as small connector segments — overlaps are avoided; a strict threshold edges-to-edge rule ensures no visible gaps unless there is real data hole.
7. **Colors**: stage-to-color mapping (high-fidelity approximations):
   - Awake: `#ff8a00` (orange)
   - REM: `#3bd6c9` (teal / mint)
   - Core (light sleep): `#4aa3ff` (cyan/blue)
   - Deep: `#6d2cf3` (purple)
   - Background ambient: `#0a0a0a`
   - Gridlines: `rgba(255,255,255,0.06)`

8. **Confidence markers**: tiny orange dots at segment tops when confidence low (visual cue). In reference image, orange small round markers are present at segment boundaries.
9. **Time axis**: condensed numeric labels under the chart using small caps, medium weight; label positions align with grid vertical lines.
10. **No shadows or glass**: strictly flat shapes, crisp anti-aliasing.

---

## Layout grid and spacing system

Use a derived spacing system (scale `s`) computed from container width `W` and container height `H`:

- `s_base = max(4, floor(W / 360 * 4))` — base spacing unit.
- Horizontal padding: `pad_h = s_base * 2`.
- Vertical padding: `pad_v = s_base * 2`.
- Chart inner area: `chartW = W - 2 * pad_h`; `chartH = H - headerHeight - pad_v`.
- Stage band heights (relative fractions of `chartH`):
  - Awake: `0.06 * chartH`
  - REM: `0.22 * chartH`
  - Core: `0.36 * chartH`
  - Deep: `0.36 * chartH`

- Inter-band spacing: `band_gap = s_base` (1 \* base unit) — consistent between bands.

Rationale: proportions emulate Apple Health — shallow stages are visually shorter, deep stages taller.

---

## Z-index layering

Render order (bottom -> top):

1. Background rectangle.
2. Vertical dotted gridlines.
3. Horizontal band separators (subtle).
4. Stage segments (deep/core/REM/awake).
5. Confidence markers / small highlight caps.
6. Tooltip overlays / selection handles.
7. Locked overlay (if gating) with semi-opaque plate and lock icon.
8. Accessibility overlays (invisible rects with labels).

---

## Color system (tokens)

Define theme tokens in `packages/constants/colors.ts` and reuse:

```ts
export const color = {
  bg: '#0a0a0a',
  grid: 'rgba(255,255,255,0.06)',
  awake: '#ff8a00',
  rem: '#3bd6c9',
  core: '#4aa3ff',
  deep: '#6d2cf3',
  label: 'rgba(255,255,255,0.88)',
  axis: 'rgba(255,255,255,0.32)',
  lockOverlay: 'rgba(10,10,10,0.6)',
};
```

Strict guidance: do not use library color tokens — these must be defined and referenced by name.

---

## Typography scale

- Axis labels: 11px, `600` weight, letter-spacing 0.2px.
- Header text (if required): 16px, `700`.
- Tooltip text: 13px, `600`.
- Use system font stack for iOS/Android; allow font fallback.

---

## SVG rendering strategy

1. Use `Svg` root with fixed `viewBox` that maps to `chartW x chartH`. Keep `preserveAspectRatio="none"` for responsive scaling.
2. Convert time to X coordinate using continuous mapping (see math below).
3. For each phase segment: draw `Rect` with `rx` equal to `segment_width * 0.2` OR clamp by `min(8, segment_width/4)` to keep caps round on narrow segments.
4. To render the rounded cap appearance consistent at both ends when segments are short, draw rounded `Rect` with `rx` and ensure `height` equals band height minus inner padding.
5. For thin awake segments: draw smaller width and offset vertically within its band for a "top-aligned" look.
6. Use `Mask` when animating reveal (reveal mask moves horizontally).

---

## Coordinate mapping math (explicit)

Inputs:

- `t0` = timeline start timestamp (ms)
- `t1` = timeline end timestamp (ms)
- `chartW` = inner chart width (px)

Mapping:

- `x(t) = pad_h + ((t - t0) / (t1 - t0)) * chartW`
- For segment spanning `[start, end]`:
  - `xStart = x(start)`
  - `xEnd = x(end)`
  - `segWidth = max(2, xEnd - xStart)` — clamp min width to 2px to avoid disappearing segments.

- Y mapping: for stage `S` map to band vertical center `yBandCenter(S)` using band fractions above.
- `rectX = xStart`
- `rectY = bandTop(S) + innerBandPadding`
- `rectHeight = bandHeight(S) - 2*innerBandPadding`
- `rx = Math.min(rectHeight/2, Math.max(4, rectWidth * 0.12))`

Important: use consistent pixel-rounding (floor to integer for xStart/xEnd) to avoid hairline gaps.

---

## Time-axis scaling rules

- Use continuous floating math; do not bin into fixed-width buckets.
- Grid interval selection:
  - If `t1 - t0 <= 6h` → grid every 30 minutes.
  - If `t1 - t0 <= 12h` → grid every 1 hour.
  - If `t1 - t0 > 12h` → grid every 2 hours.

- Render gridlines at exact `x(tick)` using dotted path with dasharray pattern (`[1,7]` scaled by devicePixelRatio).
- Label only major ticks (every 2 gridlines) to avoid clutter.

---

## Vertical stage band math

- Band top positions computed with cumulative sums:
  - `bandTop(awake) = 0`
  - `bandTop(rem) = bandTop(awake) + bandHeight(awake) + band_gap`
  - etc.

- Inner band padding: `innerBandPadding = Math.max(2, floor(bandHeight * 0.08))`.

---

## Rendering gaps and missing data

- Source may contain explicit holes (start==end or gap between consecutive segments). Render gaps as empty space — do not draw thin placeholder lines unless confidence is low; then show a dashed thin broken segment with alpha 0.06.
- When there is noisy sampling, merge same-stage segments closer than `mergingThresholdMs = 15 * 1000` (15s). For anything larger, show gap.

---

## Stage transitions rules

- When stage A ends and B starts at the same timestamp, render segments edge-to-edge — no overlap.
- When timestamps differ by <= `transitionOverlapMs = 3000` (3s) due to sensor jitter, expand both segments by `transitionOverlapMs/2` to visually close the gap.
- For abrupt transitions that are short (< 10s), collapse them into a single thin rounded segment with the dominant stage color using confidence weighting.

---

## Rounded segment caps and small-segment handling

- If `segWidth < (rectHeight / 2)`, the element becomes a pill — use `rx = rectHeight/2` and center horizontally.
- Prevent caps clipping at chart edges by applying `clipPath` with 1px inset.

---

## Cycle grouping logic (optional)

- Cycles are groups of REM → Core → Deep patterns. Compute `cycleNumber` from API if present. Render a faint vertical dashed separator at cycle boundaries and expose in tooltip.

---

## Confidence overlays

- If segments include `confidence: low|med|high`:
  - `high` — full solid color.
  - `med` — color at 0.86 alpha.
  - `low` — color at 0.6 alpha with a tiny dotted top stripe.

- Render a small confidence marker circle on the top edge of segments with `r = 3px` for low confidence.

---

## Tooltip and hitbox system

- Tooltip semantics:
  - On tap/long-press: open tooltip anchored above segment center.
  - Tooltip shows: Stage name, start time, end time, duration, confidence.

- Hitbox:
  - Use invisible enlarged `Rect` for pointer targets: expand `segRect` by 8px horizontally and 6px vertically.
  - Use `onPressIn` and `onPressOut` for quick feedback; show tooltip on `onPress`.

- Keyboard navigation:
  - Allow left/right arrow to move selection between nearest segment boundaries.

---

## Gesture mapping

- Single-finger horizontal pan: scrub time — show vertical scrubbing line mapped to `x(t)`.
- Tap on a segment: select.
- Long-press: open action sheet for editing the segment (if user is premium).
- Two-finger pinch: zoom (if allowed) — constraint: zoom not required for mobile; implement only for web/desktop.

---

## Skeleton loading state

- Skeleton shape: same band layout with rounded rect placeholders using linear shimmer mask moving left→right.
- Placeholder color: `rgba(255,255,255,0.03)` for blocks with `mask` using `react-native-reanimated` for 900ms loop.
- While loading: disable gestures and interactions.

---

## Locked overlay (premium gating)

- Overlay: semi-opaque plate covering hypnogram with centered lock icon and label "Premium".
- Overlay color: `rgba(10,10,10,0.72)`; text color `#FFFFFF`.
- Interaction: overlay must be keyboard-focusable and explain plan gating for accessibility.

---

## Empty state

- No timeline returned → render empty band with centered message "No timeline yet" and small plus CTA to add manual entry.
- Do not render grid in empty state.

---

## Performance considerations (60fps constraints)

1. Limit number of SVG primitives:
   - Merge adjacent same-color segments into single `Path` where possible.
   - Avoid a `Rect` per 100ms sample; use contiguous ranges from API.

2. Use layers caching:
   - Precompute static gridlines into a cached `Svg` layer that does not re-render on data update.

3. Avoid re-rendering entire Svg on small state changes:
   - Use `React.memo` and `useCallback` for renderer functions.

4. For animations use native drivers (`react-native-reanimated`) to move a mask rather than rerendering all shapes.
5. Offload heavy math (scale, mapping) to a WebWorker equivalent (not available in RN) — instead run in JS but memoize with dependency keys.
6. GC pressure: reuse arrays, avoid generating new objects inside render loops.

---

## Memory constraints on Android low-end devices

- Limit peak number of objects allocated during render to < 2k per frame.
- Use typed arrays for coordinate calculations when looping large datasets.
- Avoid large temporary strings; prebuild `Path` strings only once.
- Set `preserveAspectRatio="xMidYMid slice"` only if needed; otherwise, accept integer pixel mapping.

---

## Accessibility considerations

- Each segment must expose:
  - `accessibilityLabel`: `"Stage: REM. Start 02:15. End 02:45. Duration 30 minutes. Confidence high."`
  - `accessibilityRole='button'` (if actionable) or `image` (if static).

- Provide an aggregate summary for the entire night via a hidden accessible button: "Sleep summary: 7h 12m, deep 1h 20m..."
- Ensure color tokens have sufficient contrast for text overlays; add non-color indicators (icons or patterns) for users with color blindness.

---

## Theme token abstraction strategy

- All colors should be tokenized in `packages/constants/colors.ts`.
- Use `ThemeProvider` to switch dark/light (for web) and ensure fallback tokens.
- Do not hardcode hex values in component code.

---

## Responsive behavior rules

- For narrow widths (< 360px): reduce `labelFontSize` by 1 and collapse minor ticks.
- For wide screens (> 900px): increase tick density and allow hover tooltips with mouse.
- On tablet/desktop, enable pinch-to-zoom; on mobile, disable pinch-to-zoom to avoid gesture conflicts.

---

## Integration contract (API)

- Use `GET /sleep/:userId/timeline/:date` to fetch `phases[]` with shape:

  ```ts
  type Phase = {
    stage: 'awake' | 'rem' | 'core' | 'deep';
    start_time: string; // ISO
    end_time: string; // ISO
    duration_min: number;
    cycle_number?: number;
    confidence?: 'low' | 'med' | 'high';
  };
  ```

- Failures:
  - `404` → treat as empty state.
  - `200` with empty array → empty state.

- Map server times to local timezone using `Date` or `luxon` with user's zone.

---

## Common implementation mistakes — and how to avoid them

1. **Rendering as stacked bar chart**
   - Mistake: using fixed-width buckets causes uniform-width bars and blue default palette.
   - Fix: use continuous X mapping (`x(t)`) and variable widths for duration.

2. **Using default chart library styles**
   - Mistake: victory-native / chart-kit inject default axes and blue palettes.
   - Fix: avoid chart libraries for hypnogram; use react-native-svg primitives.

3. **Incorrect y-scaling (equal band heights)**
   - Mistake: equal-height rows flatten visual depth cues.
   - Fix: follow band fractions above to reflect perceived depth.

4. **Clipping rounded caps**
   - Mistake: rx > half height or no clipPath causing antialias artifacts.
   - Fix: clamp `rx` to `rectHeight / 2` and use integer pixel alignment.

5. **Dropping sub-pixel rounding**
   - Mistake: coordinates with fractional pixels create hairline gaps.
   - Fix: round x/y to integers where rendering context cannot handle fractional pixels.

6. **Overdrawing too many SVG elements**
   - Mistake: creating a `Rect` per 100ms sample.
   - Fix: coalesce contiguous same-stage samples into one segment.

7. **Failure to memoize heavy calculations**
   - Mistake: re-calculating mapping for every render.
   - Fix: memoize mapping by `phases` + `chartW` + `t0/t1`.

8. **Wrong opacity values**
   - Mistake: using opaque colors for low-confidence segments making entire chart noisy.
   - Fix: set alpha per confidence bucket.

9. **Using CSS-like borderRadius in SVG incorrectly**
   - Mistake: assuming border radius works like CSS for thin shapes.
   - Fix: use `rx` on `rect` and fall back to `Path` arcs for complex shapes.

10. **Forgetting accessibility**
    - Mistake: chart as simple image; no labels.
    - Fix: provide accessible descriptions and navigable focus targets.

---

## Implementation checklist (actionable)

- [ ] Add tokens to `packages/constants/colors.ts`.
- [ ] Add `types.SleepPhase` import from `@project-delta/shared`.
- [ ] Create component `SleepHypnogram.tsx` skeleton that reads phases and draws static SVG.
- [ ] Implement `x(t)` mapping function unit-tested.
- [ ] Implement `coalescePhases` to merge contiguous phases.
- [ ] Implement grid rendering with dotted strokes.
- [ ] Implement rounded rect rendering per band with proper `rx`.
- [ ] Implement skeleton shimmer state.
- [ ] Implement tooltip & hitboxes.
- [ ] Add gating overlay using `isPaidPlan`.
- [ ] Add animation mask reveal using `react-native-reanimated`.
- [ ] Add `useMemo` and `React.memo` for heavy parts.
- [ ] Add unit tests for coordinate math and merging logic.
- [ ] Add visual QA checklist and screenshot tests (iOS + Android).

---

## Acceptance criteria (developer-facing)

- Visual parity: produced hypnogram matches reference within tolerances:
  - Colors within ΔE acceptable range (visual check).
  - Segment shapes (rounded caps) visually identical at 2x scale.
  - Gridline spacing matches time labels and major tick alignment.

- Performance:
  - Interaction (scrub, tap) responds within 60ms on mid-tier Android.
  - Frame rate stable at 60fps during mask animation.

- Accessibility:
  - Screen-reader reads summary and individual segments.

- Gating:
  - Non-premium users show overlay; premium users see interactive hypnogram.

- Tests:
  - Unit tests for coordinate mapping and sample coalescing.
  - Visual snapshot tests for representative nights (dense, sparse, missing data).

---

## Developer hints and implementation tactics

- Preprocess phases on the server when possible: server can provide `coalesced` ranges.
- Use `viewBox` scaling to render crisp shapes at different devicePixelRatio.
- For micro-optimizations, render small confidence markers as a single `Circle` array path if many.
- Use `clipPath` to avoid artifacts at edges.
- Keep a single `Defs` section in Svg for masks and gradients.
- When animating, do not animate `d` path changes; animate transform of a mask or group to leverage GPU compositing.

---

## Visual QA checklist (manual)

1. Confirm awake segments are visually thin and orange.
2. Confirm deep segments are visually tallest and purple.
3. Confirm roundcaps on short segments become pills.
4. Confirm gridlines align to time labels exactly.
5. Confirm no hairline gaps at band joins.
6. Tap a segment — tooltip must appear showing correct start/end.
7. Enable low-confidence view — alpha must change consistently.
8. Toggle premium gating — lock overlay must appear and intercept gestures.

---

## Example pseudocode (component skeleton)

> The agent will use this only as reference; do not implement behavior yet — implement after spec acceptance.

```ts
// pseudocode omitted — agent to implement after approval per staged workflow.
```

---

## Failure mode mitigation summary

- Use unit tests and snapshot tests.
- Merge primitive SVG elements to reduce render count.
- Clamp radii and pixel-round coordinates to avoid hairline gaps.
- Avoid chart libraries; use react-native-svg.

---

## Acceptance sign-off procedure

1. Implement Stage 1 (static skeleton).
2. Submit PR labelled `feat(sleep): hypnogram forensic skeleton`.
3. Attach iOS and Android screenshots; run visual diff.
4. After visual match and tests pass, proceed Stage 2.

---

## Appendices

- Appendix A: tick interval decision table (repeated, tabular)
- Appendix B: maximum allowed object allocations per render (2k)
- Appendix C: API contract example (JSON)
- Appendix D: sample phases array used for local tests (dense + sparse).

---

_(End of forensic document. The file above must be saved at `packages/docs/ui-sleep-hypnogram-forensic-analysis.md` in the repo.)_
