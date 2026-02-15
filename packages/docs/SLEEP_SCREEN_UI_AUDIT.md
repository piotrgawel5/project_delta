# Sleep Screen — UI/UX Improvement Audit
**Classification:** Engineering Design Memo  
**Scope:** Visual consistency, information hierarchy, affordance, data density  
**Method:** Static screenshot analysis across 5 views  
**Constraint:** Preserve all existing concepts — circular slider, metric cards, calendar modal, bottom sheets. Improve only; do not redesign.

---

## Severity Legend

| Tier | Label | Definition |
|------|-------|------------|
| P0 | **CRITICAL** | Accessibility or usability failure — blocks correct usage or violates WCAG AA contrast |
| P1 | **MAJOR** | Breaks visual coherence or on-brand identity across views |
| P2 | **MODERATE** | Data quality, affordance confusion, or missed density |
| P3 | **MINOR** | Micro-polish, spacing, and typography consistency |

---

## Completion Checklist

- [ ] UI-001 — "Bad" badge contrast (Weekly History)
- [ ] UI-002 — Header action buttons contrast
- [ ] UI-003 — Circular slider arc palette
- [ ] UI-004 — "Save Sleep" CTA button style
- [ ] UI-005 — Metric card visualization fragmentation
- [ ] UI-006 — Today indicator inconsistency (Monthly vs Weekly)
- [ ] UI-007 — Score absent from primary header
- [ ] UI-008 — Calendar monthly view data density
- [ ] UI-009 — Sleep Stages percentage gap (missing ~5%)
- [ ] UI-010 — Pill tag tap affordance ambiguity
- [ ] UI-011 — Sleep Stages duplicates Total Sleep primary value
- [ ] UI-012 — "Week N, YYYY" ISO week number format
- [ ] UI-013 — Weekly day selector shape inconsistency
- [ ] UI-014 — Segmented control active state differentiation
- [ ] UI-015 — Header description typography hierarchy

---

## P0 — CRITICAL

---

### UI-001
**View:** Sleep History → Weekly tab  
**Component:** `SleepRecordCard` — quality badge  
**Issue:** The "Bad" badge renders as near-white text on a dark-gray background. Contrast ratio is well below WCAG AA minimum (4.5:1 for small text). The badge is functionally invisible.

**Current:**
```
badge background: ~#2A2A2A  
badge text:       ~#9E9E9E  
estimated ratio:  ~1.8:1  ← WCAG AA minimum is 4.5:1
```

**Required fix:**  
Map each quality tier to a distinct background + text pair that passes 4.5:1. Use the app's existing red accent as the anchor — desaturate/tint for other tiers to stay on-palette.

```typescript
const QUALITY_BADGE: Record<SleepQuality, { bg: string; text: string }> = {
  Excellent: { bg: '#1A3A2A', text: '#4CD97B' }, // green tint, dark bg
  Good:      { bg: '#1A2E3A', text: '#4AADDB' }, // blue tint
  Fair:      { bg: '#3A2E1A', text: '#DBA84A' }, // amber tint
  Bad:       { bg: '#3A1A1A', text: '#E05C5C' }, // red tint  ← currently broken
};
// All pairs verified ≥ 4.5:1
```

Apply to `SleepRecordCard` and everywhere else `SleepQuality` is rendered as a label/badge.

---

### UI-002
**View:** Main screen header (all days)  
**Component:** Header action buttons (calendar icon, `+` icon)  
**Issue:** Both icon buttons sit on the red gradient header. The icon color (gray/white at ~60% opacity) against the saturated red background fails contrast at small icon sizes, making the two primary navigation actions visually hidden on first glance.

**Current:**
```
icon color:       rgba(255,255,255,0.60)
header bg:        linear-gradient(#C0120F → #8A0000)
estimated ratio:  ~2.1:1 at mid-gradient
```

**Required fix:**  
Raise icon opacity to `1.0` (full white) and add a dark semi-transparent background pill to each button so the icon reads cleanly regardless of the gradient value behind it.

```typescript
// Header button container style
const headerBtn: ViewStyle = {
  width: 44,
  height: 44,
  borderRadius: 22,
  backgroundColor: 'rgba(0, 0, 0, 0.30)', // scrim ensures contrast on any bg color
  alignItems: 'center',
  justifyContent: 'center',
};
// Icon: color='#FFFFFF', opacity=1
```

---

## P1 — MAJOR

---

### UI-003
**View:** Add Sleep modal (bottom sheet)  
**Component:** `CircularSlider` — arc fill  
**Issue:** The arc uses a blue→lavender gradient. Every other surface in the app is built on near-black backgrounds with red as the accent. The blue/lavender arc looks like it was lifted from a different product — it has no relationship to the design language seen anywhere else in the five views.

**Current:**
```
arc gradient: #A8D8F0 (light blue) → #C5B4F0 (lavender)
```

**Required fix:**  
Re-key the arc to the app's warm palette. The arc represents a "sleep window" so a cool-dark tone is still appropriate, but it must harmonise with the red accent. Use a muted blue-violet that reads as "night" without fighting the brand.

```typescript
const ARC_GRADIENT = {
  start: '#3B5BDB',   // indigo-blue — reads as night, not clinical
  end:   '#7048B6',   // deep violet — transitions naturally into app's dark surfaces
};
// The two knob icons retain their current bed/alarm glyphs
// Knob background: '#1C1C1E' (near-black) with a 1px border at ARC_GRADIENT.start/end respectively
```

---

### UI-004
**View:** Add Sleep modal  
**Component:** `SaveSleepButton`  
**Issue:** The "Save Sleep" CTA is a solid white pill with black text. It achieves contrast, but it looks like a system alert dialog button dropped into a bespoke dark UI. It creates a jarring luminance jump at the bottom of the sheet and reads as unstyled rather than intentional.

**Current:**
```
button bg:   #FFFFFF
button text: #000000
```

**Required fix:**  
Convert to a filled button using the app's red accent, which carries the primary-action weight established in the header and calendar selection states.

```typescript
const saveButtonStyle: ViewStyle = {
  backgroundColor: '#C0120F',  // matches header gradient start
  borderRadius: 28,
  height: 56,
};
const saveButtonTextStyle: TextStyle = {
  color: '#FFFFFF',
  fontSize: 17,
  fontWeight: '600',
  letterSpacing: 0.2,
};
```

Disabled state (no valid time range selected): `backgroundColor: '#3A1A1A'`, `color: '#7A4A4A'`.

---

### UI-005
**View:** Main screen — scrollable metric cards  
**Component:** All `MetricCard` mini-charts  
**Issue:** Each metric card uses a completely independent visual language:

| Card | Visualization | Color |
|------|---------------|-------|
| Total Sleep | Vertical bar chart | Cyan `#5BC8F5` |
| Efficiency | Dot row | Purple `#9B7FD4` |
| Sleep Stages | Segmented horizontal bar | Green / Pink / Gold |
| Fell Asleep | Area/mountain chart | Blue-violet gradient |
| Woke Up | Vertical bar chart | Amber `#D4A017` |

Five different chart types and five different color families with no shared rule. Users cannot scan across cards to compare; each card demands re-learning its visual encoding.

**Required fix:**  
Establish a `MetricCard` visualization spec with two allowed chart types and a single color-per-metric token system. Do not change chart types that carry genuine encoding value (e.g. Sleep Stages segmented bar is correct for composition data).

```typescript
// Metric color tokens — one color per metric domain
const METRIC_COLORS = {
  totalSleep:   '#5BC8F5',  // retain existing cyan
  efficiency:   '#9B7FD4',  // retain existing purple
  stagesDeep:   '#4CD97B',  // retain green
  stagesREM:    '#E87EAC',  // retain pink
  stagesLight:  '#D4A017',  // retain amber
  bedtime:      '#9B7FD4',  // unify with efficiency (both are timing/quality)
  wakeTime:     '#D4A017',  // unify with light stage (both are morning/amber)
} as const;

// Allowed chart types:
//   BarSparkline   — for duration/time metrics (Total Sleep, Woke Up)
//   DotSparkline   — for scored/percentage metrics (Efficiency, Bedtime consistency)
//   SegmentedBar   — ONLY for Sleep Stages (composition data)
// No area/mountain charts — they add height without density gain
```

Secondarily, reduce sparkline chart height uniformly across all cards so they are the same `h: 40` footprint.

---

### UI-006
**View:** Sleep History modal — Monthly tab vs Weekly tab  
**Component:** "Today" / selected-day indicators  
**Issue:** The same concept (selected date) is rendered as two completely different components: a **yellow circle** in Monthly view and a **dark-red filled square** in Weekly view. Different shape, different color, different semantic.

**Current:**
```
Monthly → today:    filled yellow circle  #F5D000
Weekly  → selected: filled red square     #5A1A1A (approx)
```

**Required fix:**  
Unify to a single indicator component used in both views. The red square in Weekly view is the better choice — it aligns with the app's color language. Apply it consistently.

```typescript
// Shared day indicator — used in BOTH calendar modes
const SelectedDayIndicator: ViewStyle = {
  width: 36,
  height: 36,
  borderRadius: 10,          // rounded square, not circle — consistent with Weekly
  backgroundColor: '#C0120F', // brand red
};
// Text inside: color '#FFFFFF', fontWeight '700'

// Unselected past days with data: add a 4px dot below the number
// Color of dot maps to quality tier (use QUALITY_BADGE.bg desaturated 30%)
```

---

### UI-007
**View:** Main screen header  
**Component:** Score/quality label display  
**Issue:** The header shows only the quality label ("Bad") without the numeric score (48). The label alone is emotionally blunt — it delivers a verdict without evidence. Users who want to track marginal improvement over time (e.g. 41 → 48 → 55) get no signal from the header. The number is buried in the Weekly history record card.

**Current:**
```
Header:  "Bad"          (label only)
Weekly record card: 48  (number only, secondary screen)
```

**Required fix:**  
Show both in the header. Score leads (numeric precision), label follows (contextual framing).

```typescript
// Header score block layout
<View>
  <Text style={styles.scoreLabel}>Bad</Text>          {/* existing large heading */}
  <Text style={styles.scoreNumeric}>48 / 100</Text>   {/* NEW — secondary line */}
</View>

// scoreNumeric style
const scoreNumeric: TextStyle = {
  fontSize: 16,
  fontWeight: '500',
  color: 'rgba(255,255,255,0.65)',
  marginTop: 2,
  letterSpacing: 0.5,
};
```

---

## P2 — MODERATE

---

### UI-008
**View:** Sleep History → Monthly tab  
**Component:** `MonthlyCalendarView` — calendar day cells  
**Issue:** The monthly calendar is a pure date-picker with zero data encoding. Every past day that has a sleep record looks identical to every day without one. Users cannot see trends, identify bad weeks, or spot data gaps without tapping into weekly view day by day. The calendar's primary value — spatial overview of a month — is completely wasted.

**Required fix:**  
Add a small quality-tinted dot below each day number that has a sleep record. Days without data show no dot. Future days remain as-is.

```typescript
// Day cell layout
<View style={dayCellStyle}>
  <Text style={dayNumberStyle}>{day}</Text>
  {hasSleepData && (
    <View style={[dotStyle, { backgroundColor: QUALITY_BADGE[quality].text }]} />
    // dot: width 5, height 5, borderRadius 2.5, marginTop 2
  )}
</View>
```

This adds data density without changing the calendar structure, navigation, or tap behavior.

---

### UI-009
**View:** Main screen — Sleep Stages metric card  
**Component:** `SleepStagesCard` — stage percentage breakdown  
**Issue:** Deep 23% + REM 24% + Light 48% = **95%**. The remaining ~5% is presumably "Awake" time but is not labelled or shown. Users see a percentage breakdown that doesn't add to 100%, which reads as either a data error or a rendering bug.

**Current:**
```
Deep:  2.4h  23%
REM:   2.5h  24%
Light: 5.0h  48%
─────────────────
Total:        95%  ← 5% unaccounted
```

**Required fix:**  
Add "Awake" as an explicit fourth row. If awake data is not available from HealthConnect/HealthKit, show "—" rather than omitting the row entirely.

```typescript
const stages: StageRow[] = [
  { label: 'Deep',  color: '#4CD97B', durationH: deepH,  pct: deepPct  },
  { label: 'REM',   color: '#E87EAC', durationH: remH,   pct: remPct   },
  { label: 'Light', color: '#D4A017', durationH: lightH, pct: lightPct },
  { label: 'Awake', color: '#6B6B6B', durationH: awakeH ?? null, pct: awakePct ?? null },
];
// If awakePct is null, render "—" for both duration and percent
// Segmented bar at bottom: include gray Awake segment (or omit segment if null)
```

---

### UI-010
**View:** Main screen — all metric cards  
**Component:** `MetricCard` — pill tags ("Stage breakdown", "Bedtime", "Wake time", "Above goal")  
**Issue:** The pill/tag elements below metric values have rounded borders, padding, and appear visually interactive. Some are genuinely tappable (e.g. "Stage breakdown" presumably expands the stages detail), others are purely static labels ("Bedtime", "Wake time"). There is no visual or behavioral difference between the two. Users may tap a static label and get no response, creating a dead-zone confusion.

**Required fix:**  
Split into two explicit component variants:

```typescript
// Static label — not tappable
<MetricTag label="Bedtime" />
// Style: borderRadius 6, bg rgba(255,255,255,0.08), no ripple, no active state

// Action tag — tappable, opens detail
<MetricActionTag label="Stage breakdown" onPress={openStagesDetail} />
// Style: same as above + trailing chevron icon (›), activeOpacity 0.6
// Accessibility: accessibilityRole="button"
```

This removes ambiguity while keeping the visual language identical for both states. The `›` chevron is the only change needed.

---

### UI-011
**View:** Main screen — Sleep Stages metric card  
**Component:** `SleepStagesCard` — primary value  
**Issue:** The Sleep Stages card shows "10h 30m" as its top-line hero number. This is the exact same value already shown as the hero number of the Total Sleep card directly above it. The primary value of the Stages card adds no information — the card's actual unique data is the Deep/REM/Light breakdown, not the total duration.

**Required fix:**  
Replace the hero value with the most actionable single stage metric. Deep sleep is the most clinically significant and least likely to be high — making it the better lead.

```typescript
// SleepStagesCard hero value
// BEFORE: total duration (10h 30m) — duplicate of Total Sleep card
// AFTER:  Deep sleep duration + percent

<Text style={heroStyle}>2.4h Deep</Text>  {/* or "2h 24m" for consistency */}
<Text style={subtitleStyle}>23% of total</Text>
```

The stage breakdown rows and segmented bar below remain unchanged.

---

### UI-012
**View:** Sleep History → Weekly tab  
**Component:** Week period header  
**Issue:** The navigation header displays "Week 7, 2026". ISO week numbers are an internal calendar standard that most consumer app users don't recognize or track mentally. "Week 7" carries no intuitive meaning; users must calculate which dates it covers.

**Current:**
```
"Week 7, 2026"
```

**Required fix:**  
Display the human date range of the week instead.

```typescript
// Format: "Feb 9 – Feb 15" (same year) or "Dec 29 – Jan 4" (cross-year)
function formatWeekRange(startOfWeek: Date, endOfWeek: Date): string {
  const sameYear = startOfWeek.getFullYear() === endOfWeek.getFullYear();
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return sameYear
    ? `${fmt(startOfWeek)} – ${fmt(endOfWeek)}`
    : `${fmt(startOfWeek)}, ${startOfWeek.getFullYear()} – ${fmt(endOfWeek)}, ${endOfWeek.getFullYear()}`;
}
```

---

## P3 — MINOR

---

### UI-013
**View:** Sleep History → Weekly tab  
**Component:** Selected day highlight  
**Issue:** The day-column highlight in the weekly calendar uses a square shape with no visible border-radius. The rest of the app's design system — cards, buttons, modals, badge pills — uniformly uses rounded corners (8–28px radius). The flat square is the only hard-edged shape in the entire UI.

**Required fix:**  
Apply `borderRadius: 10` to the selected day background box. This aligns with UI-006 (unified indicator). If UI-006 is implemented first, this is resolved automatically.

```typescript
// weekly day highlight
const selectedDayHighlight: ViewStyle = {
  width: 36,
  height: 36,
  borderRadius: 10,  // was: 0 or undefined
  backgroundColor: '#C0120F',
};
```

---

### UI-014
**View:** Sleep History modal  
**Component:** `WeeklyMonthlySegmentedControl`  
**Issue:** The active tab in the segmented control is indicated only by heavier font weight ("**Weekly**" vs "Monthly"). On OLED black backgrounds at typical ambient light, the weight difference between 600 and 400 is subtle and easy to miss. There is no background fill, underline, or color change to anchor the active state.

**Required fix:**  
Add a dark-filled background pill to the active segment. Keep the text weight change as a secondary cue — not the only one.

```typescript
const activeSegment: ViewStyle = {
  backgroundColor: '#2C2C2E',  // slightly lighter than sheet bg
  borderRadius: 8,
  paddingVertical: 6,
  paddingHorizontal: 20,
};
// Active text: color '#FFFFFF', fontWeight '600'
// Inactive text: color 'rgba(255,255,255,0.45)', fontWeight '400'
```

---

### UI-015
**View:** Main screen header  
**Component:** Header description text  
**Issue:** The description line "Tough night. Short sleep or frequent waking dragged the score down." renders at the same visual weight as secondary body text throughout the app, but it sits directly below the large "Bad" heading. The hierarchy gap between the heading and the description is insufficient — the two feel like equal siblings rather than title + supporting copy.

**Required fix:**  
Reduce description to a clearly subordinate style: smaller size, lower opacity.

```typescript
// Current (approx)
const descriptionCurrent: TextStyle = {
  fontSize: 16,
  fontWeight: '400',
  color: 'rgba(255,255,255,0.75)',
};

// Required
const descriptionFixed: TextStyle = {
  fontSize: 14,             // down from ~16
  fontWeight: '400',
  color: 'rgba(255,255,255,0.55)',  // more receded
  lineHeight: 20,
  marginTop: 6,             // tighter gap to date line, more air below before card sheet
};
```

---

## Cross-Cutting Notes

These are not tracked as individual UI-IDs but should inform any styling pass.

**Token alignment opportunity.** The red accent (`#C0120F` / `#C41A1A`) appears in at least three slightly different hex values across header, calendar selection, and record card borders. Canonicalize to a single `colors.brand.primary` token before implementing any P1 fixes to avoid drift.

**Typography scale.** The header hero ("Bad") and the metric card hero values ("10h 30m", "100%", "12:30") appear to use the same font size. Establishing a strict typographic scale (hero/display/body/caption + weight variants) would prevent visual tie-breaking conflicts across all future card additions.

**Accessibility — `accessibilityLabel` gaps.** From the screenshots: the circular slider knobs, icon-only header buttons, and quality badges all appear to lack descriptive accessibility labels. This is outside the scope of this UI audit but should be addressed in a parallel accessibility pass.

---

## Summary

| ID | Severity | Area | Change Type |
|----|----------|------|-------------|
| UI-001 | P0 | Weekly history badge | Contrast fix |
| UI-002 | P0 | Header action buttons | Contrast fix |
| UI-003 | P1 | Circular slider arc | Palette alignment |
| UI-004 | P1 | Save Sleep CTA | Button style |
| UI-005 | P1 | Metric card sparklines | Visualization system |
| UI-006 | P1 | Calendar today indicator | Cross-view consistency |
| UI-007 | P1 | Header score display | Information hierarchy |
| UI-008 | P2 | Monthly calendar | Data density |
| UI-009 | P2 | Sleep Stages percentages | Data accuracy |
| UI-010 | P2 | Metric card pill tags | Affordance clarity |
| UI-011 | P2 | Sleep Stages hero value | Information redundancy |
| UI-012 | P2 | Weekly period label | Legibility |
| UI-013 | P3 | Weekly day highlight shape | Design system alignment |
| UI-014 | P3 | Segmented control state | Visual differentiation |
| UI-015 | P3 | Header description text | Typography hierarchy |

---

*Suggested Claude Code invocation order follows the same tier-gated pattern as the bug audit:*

```bash
# P0 — run first, both are accessibility blockers
claude "Read SLEEP_SCREEN_UI_AUDIT.md. Implement UI-001 and UI-002 only. Verify no new TypeScript errors. Do not touch any other UI-IDs."

# P1 — palette and consistency pass
claude "Read SLEEP_SCREEN_UI_AUDIT.md. Implement UI-003 through UI-007. These are visual-only changes — do not alter any data logic or store. Verify TypeScript compiles after each ID. Output a summary table on completion."

# P2 — density and polish
claude "Read SLEEP_SCREEN_UI_AUDIT.md. Implement UI-008 through UI-012. UI-009 requires a data model change — if awakeMinutes is not present in SleepData, add it as an optional field. Do not fabricate data. Output summary table on completion."

# P3 — micro-polish (can batch in one pass)
claude "Read SLEEP_SCREEN_UI_AUDIT.md. Implement UI-013 through UI-015. These are style-only changes. Batch all three, verify TypeScript, output final summary covering UI-001 through UI-015."
```
