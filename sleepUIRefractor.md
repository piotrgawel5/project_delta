# SLEEP SCREEN FULL REBUILD

## Project Delta — Codex 5.3 Implementation Plan

**Version:** 1.0 | **Date:** 2026-03-17 | **Author:** CDO / Design Engineering  
**Scope:** `apps/mobile` — Expo 54, React Native 0.81, TypeScript strict

---

## 0. MANDATORY PRE-FLIGHT

Before writing a single line of code, Codex **must** read in this order:

1. `packages/docs/context.md` — architecture, conventions, monorepo layout
2. `apps/mobile/tsconfig.json` — path aliases (`@lib/*`, `@store/*`, `@components/*`, `@constants`)
3. `apps/mobile/store/sleepStore.ts` — understand existing state shape (`recentHistory`, `monthlyData`, `fetchSleepData`, `fetchMonthHistory`, `fetchSleepDataRange`, `forceSaveManualSleep`)
4. `apps/mobile/lib/sleepColors.ts` — `getSleepScoreGrade()` return shape `{ score, grade, color }`
5. `apps/mobile/lib/sleepFormatters.ts` — `formatDuration`, `formatTimeParts`, `getSleepDescription`
6. `apps/mobile/lib/sleepDateUtils.ts` — `normalizeDate`, `dateKey`, `addDays`, `isSameDay`, `padToSeven`
7. `apps/mobile/constants/sleepConstants.ts` — deep sleep thresholds (`FLAGS.deepLowRatio`, `AGE_NORMS`)
8. `apps/mobile/app/(tabs)/_layout.tsx` — existing `MaterialTopTabs` + `CustomTabBar` structure to understand what gets replaced
9. `apps/mobile/app/(tabs)/sleep.tsx` — full current implementation being replaced

Declare your understanding of:

- Which files are created/modified/deleted
- Which stage each file is touched in
- The full validation command set (typecheck + lint)

**If any ambiguity about architectural decisions cannot be resolved from these files: STOP and surface it before proceeding.**

---

## 1. GOAL STATEMENT

Completely rebuild the sleep screen UI to match the Figma design spec below. The result must:

- Replace `app/(tabs)/sleep.tsx` entirely (full file rewrite, zero old code carried over)
- Replace the navbar in `app/(tabs)/_layout.tsx` (keep routing logic, replace visual component)
- Install and wire DM Sans font family
- Introduce `constants/theme.ts` as the single source of truth for all style tokens
- Create typed, isolated component files in `components/sleep/redesign/`
- Keep horizontal day-swipe navigation (FlatList pager) with haptic feedback
- Pull ALL data from the existing Zustand sleepStore — never hardcode sleep metrics
- Show animated loading skeletons before data resolves
- Show a complete empty-state screen when no data exists for the selected day
- Support animated hero gradient that changes color based on the day's sleep score grade

---

## 2. DESIGN SPECIFICATION

### 2.1 Hero Background Gradient

The hero uses a **layered** background. Implement with two SVG/gradient layers stacked:

**Layer 1 — Radial Base** (from Figma color picker):

```
Type: Radial gradient
Stop 0%:  #2D7A3A  opacity 100%
Stop 70%: #0A1A0E  opacity 100%
Stop 100%: #000000  opacity 100%
Center: top-center of hero
Radius: fills entire hero
```

**Layer 2 — Linear Overlay** (from Figma color picker):

```
Type: Linear gradient (vertical, top→bottom)
Stop 0%:  #4CAF6A  opacity 80%
Stop 61%: #000000  opacity 10%
BlendMode: Overlay (simulate with opacity 0.35 overlay View)
```

**Implementation note:** React Native does not support radial gradients in `expo-linear-gradient`. Use `react-native-svg` with `<Defs><RadialGradient>` embedded in an SVG that fills the hero `position: absolute`. Layer 2 is a separate `<LinearGradient>` from `expo-linear-gradient` stacked on top with `pointerEvents="none"`. Do NOT attempt CSS `mix-blend-mode` — use `opacity` approximation.

**Dynamic color shift by sleep grade:** The primary stop of the radial gradient (#2D7A3A) shifts to match `getSleepScoreGrade(score).color`. Create a `getHeroGradientStops(scoreColor: string)` function that blends the base green toward the grade color using a 60/40 split (60% grade color, 40% #2D7A3A). This keeps the green foundation while signalling grade visually. Animate between grades using `useSharedValue` + `withTiming(600ms)` on the color value when the selected day changes.

**Noise layer:** Omit in this implementation. Mark as `// TODO: add noise texture overlay for final polish`.

### 2.2 Typography System

Install: `npx expo install @expo-google-fonts/dm-sans`

Add to `app/_layout.tsx` alongside existing Inter/Poppins:

```typescript
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
// add to useFonts() call:
// 'DMSans-Regular': DMSans_400Regular,
// 'DMSans-Medium': DMSans_500Medium,
// 'DMSans-SemiBold': DMSans_600SemiBold,
// 'DMSans-Bold': DMSans_700Bold,
```

**Existing fonts (keep):** Inter-Regular, Inter-SemiBold, Poppins-Bold, Poppins-Black — these are used throughout other screens.

**New font usage (sleep screen only):**

| Role                             | Family          | Weight | Size | Color                               |
| -------------------------------- | --------------- | ------ | ---- | ----------------------------------- |
| Grade label ("Great")            | DMSans-Bold     | 700    | 72sp | #FFFFFF                             |
| Score ("86 / 100")               | DMSans-SemiBold | 600    | 22sp | #FFFFFF                             |
| Score separator (" / ")          | DMSans-Regular  | 400    | 18sp | rgba(255,255,255,0.6)               |
| Description text                 | DMSans-Regular  | 400    | 14sp | rgba(255,255,255,0.75)              |
| Badge pill text                  | DMSans-Medium   | 500    | 13sp | #FFFFFF                             |
| Date string                      | DMSans-Medium   | 500    | 14sp | rgba(255,255,255,0.7)               |
| Card title (all caps)            | DMSans-SemiBold | 600    | 11sp | #8E8E93, letterSpacing 0.5          |
| Card number value                | DMSans-Bold     | 700    | 36sp | #FFFFFF                             |
| Card unit suffix (AM/PM/h/m)     | DMSans-SemiBold | 600    | 18sp | rgba(255,255,255,0.8)               |
| Zone bar labels (Low/Fair/Great) | DMSans-Regular  | 400    | 11sp | #636366                             |
| "On Track" pill                  | DMSans-SemiBold | 600    | 12sp | #30D158                             |
| Chart day labels                 | DMSans-Medium   | 500    | 11sp | #636366 (inactive), #FFFFFF (today) |
| Tooltip value                    | DMSans-SemiBold | 600    | 13sp | #FFFFFF                             |
| Empty state headline             | DMSans-Bold     | 700    | 24sp | #FFFFFF                             |
| Empty state body                 | DMSans-Regular  | 400    | 15sp | rgba(255,255,255,0.5)               |
| "Add sleep data" button          | DMSans-SemiBold | 600    | 16sp | #000000                             |
| "Edit sleep data" link           | DMSans-Regular  | 400    | 13sp | rgba(255,255,255,0.4)               |

**Unit suffix sizing rule:** Unit suffix size = exactly 50% of number size, vertically baseline-aligned. Use `alignItems: 'flex-end'` on a Row containing number + unit.

### 2.3 Color Token System

All values live in `constants/theme.ts`. No hex literals anywhere in component files — import from `SLEEP_THEME`.

```typescript
// constants/theme.ts — SLEEP_THEME namespace

export const SLEEP_THEME = {
  // Background
  screenBg: '#000000',
  cardBg: '#1C1C1E',
  elevatedBg: '#2C2C2E',

  // Borders
  border: '#3A3A3C', // hairlines, dividers

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.75)',
  textMuted1: '#8E8E93', // card titles
  textMuted2: '#636366', // chart labels, captions
  textDisabled: 'rgba(255,255,255,0.4)',

  // Semantic
  success: '#30D158', // on-track pill, deep sleep OK
  warning: '#FF9F0A', // amber, wake dots
  danger: '#FF453A', // low deep sleep pill

  // Sleep stage brand colors
  colorDeep: '#BF5AF2',
  colorLight: '#32ADE6',
  colorREM: '#5E5CE6',
  colorAwake: '#FF9F0A',
  colorBedtime: '#5E5CE6', // bedtime dots

  // Hero gradient base
  heroGradientPrimary: '#2D7A3A',
  heroGradientMid: '#0A1A0E',
  heroGradientEnd: '#000000',

  // Hero overlay gradient
  heroOverlayStart: '#4CAF6A', // 80% opacity
  heroOverlayEnd: '#000000', // 10% opacity

  // Chart
  chartLine: '#FFFFFF',
  chartLineOpacityDimmed: 0.5,
  chartDotFill: '#3A3A3C',
  chartDotToday: '#FFFFFF',
  chartGlowRing: 'rgba(255,255,255,0.20)',
  chartTooltipBg: '#1C1C1E',

  // Zone bar
  zoneBarLow: '#FF453A',
  zoneBarFair: '#FF9F0A',
  zoneBarGreat: '#30D158',

  // Navbar
  navbarBg: 'rgba(18,18,18,0.40)',
  navbarBorder: 'rgba(255,255,255,0.08)',
  navbarBlurIntensity: 11.5,
  navbarActiveColor: '#FFFFFF',
  navbarInactiveOpacity: 0.45,

  // Pills / badges
  badgePillBg: '#1C1C1E', // hero badge + tooltip
  onTrackPillBg: '#2C2C2E',
  onTrackPillText: '#30D158',
  lowPillBg: 'rgba(255,69,58,0.15)',
  lowPillText: '#FF453A',

  // Empty / skeleton
  skeletonBase: 'rgba(255,255,255,0.06)',
  skeletonHighlight: 'rgba(255,255,255,0.12)',
  emptyStateDot: 'rgba(255,255,255,0.40)',
} as const;

export type SleepTheme = typeof SLEEP_THEME;
```

### 2.4 Layout & Spacing

```
SCREEN_PADDING_H = 16          // horizontal padding for all cards
HERO_HEIGHT = 420              // total hero section height (includes chart overlap zone)
HERO_TEXT_PADDING_TOP = 56     // from top of hero to date label (accounts for status bar)
HERO_TEXT_PADDING_H = 20
CHART_OVERLAP = 40             // px chart pulls into hero from below
CHART_HEIGHT = 130             // total chart SVG height
CARD_GAP = 12                  // gap between stacked cards
CARD_RADIUS_INNER = 16         // inner content radius
CARD_RADIUS_OUTER = 20         // card background radius
CARD_PADDING = 20              // internal card padding
NAVBAR_HEIGHT = 72             // floating pill height
NAVBAR_BOTTOM = 12             // distance from screen bottom edge (+ safe area)
NAVBAR_SIDE_MARGIN = 35        // left + right margin from edges
SCROLL_CONTENT_BOTTOM_PAD = NAVBAR_HEIGHT + NAVBAR_BOTTOM + 32   // = 116
DOT_SIZE = 8                   // inactive week dots
DOT_SIZE_TODAY = 12            // today's dot
DOT_GLOW_SIZE = 20             // today's glow ring outer diameter
DIVIDER_HEIGHT_RATIO = 0.65    // Card A vertical divider height relative to card
```

### 2.5 Component Specifications

#### A. HERO SECTION (`SleepHero.tsx`)

**Layout (top to bottom within hero container):**

1. Date row: `"2 Mar 2026"` | chevron right icon (visual only, non-interactive)
2. Grade label: `"Great"` (72sp DMSans-Bold)
3. Score row: `"86"` (22sp DMSans-SemiBold) + `" / "` (18sp dimmed) + `"100"` (22sp)
4. Description text (from `getSleepDescription(score, durationMinutes)`)
5. Badge pill: `"↑ 12% better than your weekly average"` | from `calculateWeeklyDelta()`
6. Chart component (negative margin overlap)

**Badge pill:** Background `#1C1C1E`, border radius 20, padding `6px 12px`. Show green up arrow `↑` if positive, red down arrow `↓` if negative. If `delta === null` (insufficient history <3 days), hide badge entirely. If delta is 0, hide badge.

**Props:**

```typescript
interface SleepHeroProps {
  selectedDate: Date;
  score: number | undefined; // undefined = no data
  grade: string; // from getSleepScoreGrade
  gradeColor: string; // for gradient shift
  durationMinutes: number | null;
  description: string;
  weeklyDelta: number | null; // percentage, e.g. 12 = 12% better
  isLoading: boolean;
}
```

**Gradient animation:** Use `useSharedValue` for the primary radial gradient stop color. When `gradeColor` prop changes (new day selected), animate with `withTiming(600)` from current to next color. Since SVG gradient colors can't be directly animated via Reanimated, use a cross-fade approach: render two SVG gradient layers, animate opacity between them using `overlayAOpacity` / `overlayBOpacity` pattern (see existing `useSleepGradient` in `lib/useSleepGradient.ts` — **reuse this hook**). Pass the `gradeColor` as the key into `getColorForKey`.

#### B. WEEKLY SLEEP CHART (`WeeklySleepChart.tsx`)

**Data:** Last 7 days ordered Mon→Sun. `data[i]` is `duration_minutes` for that day, or `null` if no data.

**SVG dimensions:** `width = SCREEN_WIDTH`, `height = CHART_HEIGHT (130px)`. Chart area starts at `paddingLeft = 16`, ends at `SCREEN_WIDTH - 16`. Y-axis: 0 minutes at bottom, `MAX_HOURS = 10 * 60` minutes at top (600min = 10h). Clamp values above 10h.

**4 SVG paths:**

1. **Main line** (days with real data, connected): white `#FFFFFF`, strokeWidth 2, strokeLinecap "round", smooth Catmull-Rom curve
2. **Lead-in ghost** (half-opacity line before the first data point): `rgba(255,255,255,0.5)`, strokeWidth 1.5, connects from left edge at same y as first data point
3. **Future dashed** (from last data point to right edge, days with no data): `rgba(255,255,255,0.5)`, strokeDasharray `[4, 6]`, strokeWidth 1.5
4. **Area fill shape**: closed path below main line, vertical LinearGradient fill, `#4CAF6A` at `opacity 0.8` → `#000000` at `opacity 0.1`, direction top→bottom

**Catmull-Rom smooth path:** Implement helper `buildSmoothPath(points: {x:number, y:number}[], tension=0.4): string`. Do NOT use a third-party path library — implement inline. The algorithm:

```
For each interior point i:
  cp1x = points[i].x + (points[i+1].x - points[i-1].x) * tension / 2
  cp1y = points[i].y + (points[i+1].y - points[i-1].y) * tension / 2
  cp2x = points[i+1].x - (points[i+2].x - points[i].x) * tension / 2
  cp2y = points[i+1].y - (points[i+2].y - points[i].y) * tension / 2
  path += `C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${points[i+1].x} ${points[i+1].y}`
```

**Data dots:**

- All days: 8px circle, fill `#3A3A3C`, stroke `none`
- Today's dot: 8px circle, fill `#FFFFFF`, + outer glow ring circle 20px, fill `rgba(255,255,255,0.20)`
- Null data points: no dot rendered

**Tooltip pill:** Position above today's dot. `"7h 30m"` format (`Math.floor(mins/60)h ${mins%60}m`). Background `#1C1C1E`, border-radius 12, padding `4px 10px`. Rendered as SVG `<ForeignObject>` or as an absolutely-positioned `<View>` overlaid on the SVG using the dot's `x` coordinate.

**X-axis labels:** Row below SVG. 7 labels: `['M','T','W','T','F','S','S']`. Today's label: DMSans-SemiBold white. Others: DMSans-Medium `#636366`. Missing-data days: `opacity 0.40`.

**Props:**

```typescript
interface WeeklySleepChartProps {
  data: (number | null)[]; // 7 values, Mon→Sun, duration_minutes or null
  todayIndex: number; // 0=Mon ... 6=Sun
  targetMinutes?: number; // optional goal line (show as subtle dashed horizontal)
}
```

**Chart positioning:** The chart sits inside a `View` with `marginTop: -CHART_OVERLAP` to pull it into the hero. Its background is `transparent`. The hero's bottom region is the chart zone.

#### C. BEDTIME/WAKE CARD — Card A (`SleepCardBedtime.tsx`)

**Layout:** Single card, split 50/50 horizontally with a vertical divider.

**Left panel:**

- Label: `"FELL ASLEEP"` (11sp DMSans-SemiBold, all-caps, `#8E8E93`, letterSpacing 0.5)
- Time: `"12:40"` (36sp DMSans-Bold, white) + `"AM"` (18sp DMSans-SemiBold, baseline-aligned)
- 7 dots: color `#5E5CE6` (indigo/bedtime)

**Right panel:**

- Label: `"WOKE UP"` (same style)
- Time: `"7:00"` + `"AM"` (same layout)
- 7 dots: color `#FF9F0A` (amber/wake)

**Vertical divider:** `width: 1`, height `65%` of card, color `#3A3A3C`, `alignSelf: 'center'`

**Dot row specification:**

- 7 dots per side, ordered Mon→Sun
- Each dot: circle, size 8px (inactive), 12px (today) with 4px outer ring at 30% opacity of dot color
- `null` data days: opacity `0.40`, same color
- Today's dot is always the current `todayIndex`
- Compute from `weekBedtimes: (number | null)[]` (7 values, minutes from midnight) and `weekWakeTimes`

**Time display when no data for selected day:** Show `"--:--"` in same style.

**Props:**

```typescript
interface SleepCardBedtimeProps {
  bedtime: { time: string; meridiem: string } | null; // from formatTimeParts()
  wakeTime: { time: string; meridiem: string } | null;
  weekBedtimes: (number | null)[]; // 7 values, minutes from midnight (adjusted for late nights)
  weekWakeTimes: (number | null)[];
  todayIndex: number;
}
```

#### D. DEEP SLEEP CARD — Card B (`SleepCardDeep.tsx`)

**Layout (top to bottom):**

1. Card title: `"DEEP SLEEP"` (same style as Card A title)
2. Duration: `"1h"` (36sp DMSans-Bold) + `" 24"` + `"m"` (18sp suffix) — white
3. Copy: human-centered text (see below)
4. Zone gradient bar + dot indicator
5. Zone labels row: Low / Fair / Great
6. Status pill (bottom right, floated)

**Copy variants (hardcoded by zone):**

- Great (≥20%): `"Your body spent good time in deep recovery tonight."`
- Fair (13–19%): `"You got some restorative sleep. Aim for more deep sleep."`
- Low (<13%): `"Deep sleep was below target tonight. Avoid screens before bed."`
- No data: `"No deep sleep data available for this night."`

**Zone thresholds:** Import from `constants/sleepConstants.ts` — `FLAGS.deepLowRatio` (0.15) and the `AGE_NORMS` ideal percent (0.20). Fallback hardcoded: `DEEP_FAIR_THRESHOLD = 0.13`, `DEEP_GREAT_THRESHOLD = 0.20`. These are percentages of total sleep duration.

**Zone bar:**

- Width: 100%, height: 8px, border-radius: 4px (fully rounded)
- Background: horizontal LinearGradient `#FF453A → #FF9F0A → #30D158`
- White dot indicator: 14px circle, white fill, positioned at `barWidth * deepPct / 1.0` clamped to `[7px, barWidth - 7px]`
- The dot shadow: `shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 3`

**Zone labels:** Row below bar: `"Low"` | `"Fair"` | `"Great"`, 11sp DMSans-Regular `#636366`, `justifyContent: 'space-between'`

**Status pill (bottom-right):**

- Great zone: `"On Track"` | bg `#2C2C2E` | text `#30D158`
- Fair zone: `"Improving"` | bg `rgba(255,159,10,0.15)` | text `#FF9F0A`
- Low zone: `"Low"` | bg `rgba(255,69,58,0.15)` | text `#FF453A`

**Props:**

```typescript
interface SleepCardDeepProps {
  deepMinutes: number | null;
  totalMinutes: number | null;
}
```

#### E. SLEEP STAGES CARD — Card C (`SleepStagesCard.tsx`)

**Scope for this implementation:** Render an empty card shell with the label `"SLEEP STAGES"` and a subtle content placeholder (shimmering skeleton lines). Leave `SleepHypnogram` completely unwired.

```typescript
// SleepStagesCard.tsx
// TODO(Card C): Wire to SleepHypnogram once Card C design is finalized.
// The existing SleepHypnogram component (components/sleep/SleepHypnogram.tsx) is premium-gated.
// Current task: render placeholder only.
```

The card should have card styling (`#1C1C1E` background, 20px radius) and peek 170px above the navbar when the user has not yet scrolled to it (natural scroll behavior — the card should be rendered in normal document flow, positioned so that when the user first sees the screen approximately 170px is visible above the navbar before scrolling).

#### F. EMPTY STATE (`SleepEmptyState.tsx`)

Rendered when `currentData.historyItem === null` and `!isLoading`.

**Visual:**

- Same hero structure (gray gradient instead of green): use `#2C2C2E → #1C1C1E → #000000` as the radial gradient (muted palette)
- All metric values show `"N/A"` with `opacity 0.4`
- Cards show skeleton/muted versions
- One centered CTA button at mid-screen

**CTA Button:**

- Text: `"Add Sleep Data"`
- Background: `#FFFFFF`
- Text color: `#000000`
- Border radius: 14px, height 56px, width 220px
- On press: open `AddSleepRecordModal` + haptic `ImpactFeedbackStyle.Medium`

**Grade display in empty state:** Shows `"--"` for grade, `"-- / 100"` for score.

**Props:**

```typescript
interface SleepEmptyStateProps {
  date: Date;
  onAddData: () => void;
}
```

#### G. EDIT LINK (`SleepEditLink.tsx`)

When data IS present, render at the very bottom of the scroll content, below all cards:

```
[ edit sleep data ]    ← underlined text, 13sp, rgba(255,255,255,0.4)
```

On press: open `AddSleepRecordModal` (which allows editing existing entry) + haptic `ImpactFeedbackStyle.Light`.

**Props:**

```typescript
interface SleepEditLinkProps {
  onPress: () => void;
}
```

#### H. SKELETON SCREENS (`SleepSkeletons.tsx`)

Shown while `isLoading === true` for the selected day.

Skeleton components use animated shimmer: `Animated.Value` looping `0 → 1 → 0` over 1200ms. The shimmer maps to `backgroundColor` interpolating between `skeletonBase` and `skeletonHighlight` from `SLEEP_THEME`.

Skeleton shapes to render:

- Hero skeleton: 2 gray lines (grade text height + score line height)
- Chart skeleton: a gentle wavy gray bar (simple rect with opacity)
- Card A skeleton: two gray time-shaped rectangles
- Card B skeleton: headline rect + bar rect
- Card C skeleton: empty card with label + 3 horizontal lines

### 2.6 Navbar Specification

Replace `CustomTabBar` in `app/(tabs)/_layout.tsx` with a new `FloatingTabBar` component (inline in `_layout.tsx` or extracted to `components/navigation/FloatingTabBar.tsx`).

**Visual spec:**

```
Width:            SCREEN_WIDTH - 70   (35px each side)
Height:           72px
Border radius:    36px
Bottom position:  12px + insets.bottom
Background:       rgba(18, 18, 18, 0.40)  (use BlurView on top)
Blur intensity:   11.5 (expo-blur, tint="dark")
Border:           1px rgba(255,255,255,0.08)
Shadow:           color #000, opacity 0.60, radius 32, offset (0, 8), elevation 20
```

**Tab layout:** 4 equal-width tabs (flex: 1 each).

**Active tab state:**

- Icon: color `#FFFFFF`, full opacity
- Label: shown, DMSans-SemiBold 11sp, `#FFFFFF`

**Inactive tab state:**

- Icon only: no label, opacity `0.45`

**Active indicator:** A subtle pill `View` centered behind the icon + label:

- Width: 80px, height: 56px, border-radius: 28px
- Background: `rgba(255,255,255,0.08)` (NOT green — generic for all tabs)

**Tab entries:**

| Tab       | Inactive icon                                 | Active icon  | Label     |
| --------- | --------------------------------------------- | ------------ | --------- |
| Nutrition | `food-apple-outline` (MaterialCommunityIcons) | `food-apple` | Nutrition |
| Workout   | `dumbbell`                                    | `dumbbell`   | Workout   |
| Sleep     | Custom SVG moon (existing `SleepTabIcon`)     | Same + star  | Sleep     |
| Account   | `account-outline`                             | `account`    | Account   |

**Keep the existing `SleepTabIcon` component** with its animated moon + star SVG — it's already well-implemented.

**Tab press animation:** spring scale `0.92` on press-in, back to `1.0` on press-out. Use Reanimated `useSharedValue` + `withSpring`.

**Swipe between tabs:** Keep `swipeEnabled: false` (users swipe days within the sleep tab, not between tabs).

---

## 3. ARCHITECTURE DECISIONS

| Decision                | Choice                                                  | Rationale                                                                                                  |
| ----------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Chart library           | `react-native-svg` (already installed)                  | Full path control needed for Catmull-Rom; Victory Native XL has unnecessary overhead for this custom shape |
| Hero radial gradient    | `react-native-svg` `<RadialGradient>`                   | `expo-linear-gradient` has no radial support                                                               |
| Hero animation          | Reuse `useSleepGradient` from `lib/useSleepGradient.ts` | Already handles cross-fade between color states; no duplication                                            |
| Day swipe               | Keep existing `FlatList` pager with `pagingEnabled`     | Proven performance, smooth gesture integration                                                             |
| State management        | Reuse existing `useSleepStore` selectors                | Store is well-written; derive new computed values via `useMemo` in components — do NOT add to store        |
| Font installation       | Add DM Sans alongside Inter/Poppins in `_layout.tsx`    | Other screens use Inter/Poppins — do not break them                                                        |
| Design tokens           | `constants/theme.ts` namespace `SLEEP_THEME`            | Collocated with existing `constants/sleepConstants.ts`                                                     |
| Hero scroll behavior    | Hero `position: absolute`, cards scroll over it         | Creates natural layering without complex layout math                                                       |
| Frosted glass at scroll | `expo-blur` `BlurView` at top edge of scroll container  | Smooth visual transition as cards pass over hero                                                           |
| Haptics                 | `expo-haptics` `ImpactFeedbackStyle`                    | Already in package.json                                                                                    |
| Skeletons               | Animated `Animated.Value` interpolation                 | No new library needed                                                                                      |
| Types                   | `types/sleep-ui.ts` (new file)                          | Centralized, imported by all new components                                                                |
| Weekly delta            | `lib/sleepWeeklyInsights.ts` (new file)                 | Pure function, testable, isolated                                                                          |
| Edit/Add modal          | Reuse existing `AddSleepRecordModal`                    | Working implementation, keep unchanged                                                                     |
| Sleep Calendar          | Reuse existing `SleepCalendar`                          | Keep unchanged; date selection in hero is non-interactive in this build                                    |
| Skeleton timing         | 1200ms shimmer loop                                     | Smooth, non-distracting                                                                                    |
| Nav indicator color     | Generic `rgba(255,255,255,0.08)`                        | Not per-tab colored (previous green indicator removed)                                                     |

---

## 4. FILE MANIFEST

### 4.1 Files to CREATE

```
apps/mobile/
├── constants/
│   └── theme.ts                                       # All SLEEP_THEME tokens (P0)
│
├── types/
│   └── sleep-ui.ts                                    # All new component prop interfaces (P0)
│
├── lib/
│   └── sleepWeeklyInsights.ts                         # calculateWeeklyDelta(), deriveWeekSeries() (P1)
│
└── components/sleep/redesign/
    ├── SleepHero.tsx                                  # Hero section (P2)
    ├── WeeklySleepChart.tsx                           # 7-day area chart (P2)
    ├── SleepCardBedtime.tsx                           # Card A (P2)
    ├── SleepCardDeep.tsx                              # Card B (P2)
    ├── SleepStagesCard.tsx                            # Card C placeholder (P2)
    ├── SleepEmptyState.tsx                            # No-data screen (P2)
    ├── SleepEditLink.tsx                              # Edit data text link (P2)
    └── SleepSkeletons.tsx                             # Loading skeleton overlays (P2)
```

### 4.2 Files to MODIFY

```
apps/mobile/
├── app/_layout.tsx                                    # Add DM Sans to useFonts() (P0)
├── app/(tabs)/_layout.tsx                             # Replace CustomTabBar with FloatingTabBar (P3)
└── app/(tabs)/sleep.tsx                               # FULL REWRITE — new screen assembly (P4)
```

### 4.3 Files to DELETE

After the rebuild compiles and all acceptance criteria pass, delete these files:

```
apps/mobile/components/sleep/dashboard/SleepHeader.tsx           # Replaced by SleepHero
apps/mobile/components/sleep/dashboard/SleepMetricsBento.tsx     # Replaced by new cards
apps/mobile/components/sleep/dashboard/WeeklyBarChart.tsx        # Replaced by WeeklySleepChart
apps/mobile/components/sleep/dashboard/DailyHypnogramCard.tsx    # Replaced by SleepStagesCard (placeholder)
apps/mobile/components/sleep/FluidSleepChart.tsx                 # Unused simulated chart
```

**Keep (do NOT delete):**

```
apps/mobile/components/sleep/SleepHypnogram.tsx        # Will be wired in Card C later
apps/mobile/components/sleep/SleepCalendar.tsx         # Reused
apps/mobile/components/sleep/AddSleepRecordModal.tsx   # Reused
apps/mobile/components/sleep/dashboard/SleepMetricsList.tsx  # May be used elsewhere
apps/mobile/components/sleep/MetricCard.tsx             # May be used elsewhere
apps/mobile/components/navigation/TabBar.tsx            # Dormant but harmless
```

---

## 5. TYPE SYSTEM (P0)

**File:** `apps/mobile/types/sleep-ui.ts`

```typescript
import type { SleepScoreType } from '@lib/sleepColors';

// ── Hero ──────────────────────────────────────────────────────────────────────

export interface SleepHeroProps {
  selectedDate: Date;
  score: number | undefined;
  grade: string;
  gradeColor: string;
  durationMinutes: number | null;
  description: string;
  weeklyDelta: number | null; // positive = better, negative = worse, null = no data
  isLoading: boolean;
}

export interface HeroGradientStops {
  primary: string; // top of radial gradient
  mid: string; // 70% stop
  end: string; // 100% = black
}

// ── Chart ─────────────────────────────────────────────────────────────────────

export interface WeeklySleepChartProps {
  data: (number | null)[]; // 7 values (Mon→Sun), duration_minutes
  todayIndex: number; // 0=Mon, 6=Sun
  targetMinutes?: number; // optional goal line
}

export interface ChartPoint {
  x: number;
  y: number;
  hasData: boolean;
}

// ── Card A ────────────────────────────────────────────────────────────────────

export interface TimeParts {
  time: string; // e.g. "12:40"
  meridiem: string; // "AM" or "PM"
}

export interface SleepCardBedtimeProps {
  bedtime: TimeParts | null;
  wakeTime: TimeParts | null;
  weekBedtimes: (number | null)[]; // 7 values: minutes from midnight (late-night adjusted)
  weekWakeTimes: (number | null)[];
  todayIndex: number;
}

// ── Card B ────────────────────────────────────────────────────────────────────

export interface SleepCardDeepProps {
  deepMinutes: number | null;
  totalMinutes: number | null;
}

export type DeepSleepZone = 'great' | 'fair' | 'low' | 'nodata';

// ── Empty State ───────────────────────────────────────────────────────────────

export interface SleepEmptyStateProps {
  date: Date;
  onAddData: () => void;
}

// ── Edit Link ─────────────────────────────────────────────────────────────────

export interface SleepEditLinkProps {
  onPress: () => void;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

export interface SleepSkeletonProps {
  visible: boolean;
}

// ── Weekly Insights ───────────────────────────────────────────────────────────

export interface WeekSeriesData {
  durations: (number | null)[]; // 7 values Mon→Sun
  bedtimes: (number | null)[]; // minutes from midnight (adjusted for late night)
  wakeTimes: (number | null)[]; // minutes from midnight
  scores: (number | null)[];
  todayIndex: number;
}
```

---

## 6. DESIGN TOKEN SYSTEM (P0)

**File:** `apps/mobile/constants/theme.ts`

See full token definition in Section 2.3. Additionally export:

```typescript
// Spacing constants used across redesigned sleep components
export const SLEEP_LAYOUT = {
  screenPaddingH: 16,
  heroHeight: 420,
  heroTextPaddingTop: 56,
  heroTextPaddingH: 20,
  chartOverlap: 40,
  chartHeight: 130,
  cardGap: 12,
  cardRadiusInner: 16,
  cardRadiusOuter: 20,
  cardPadding: 20,
  navbarHeight: 72,
  navbarBottom: 12,
  navbarSideMargin: 35,
  scrollBottomPad: 116, // navbarHeight + navbarBottom + 32
  dotSize: 8,
  dotSizeToday: 12,
  dotGlowSize: 20,
} as const;

// Font family names (must match keys passed to useFonts in _layout.tsx)
export const SLEEP_FONTS = {
  regular: 'DMSans-Regular',
  medium: 'DMSans-Medium',
  semiBold: 'DMSans-SemiBold',
  bold: 'DMSans-Bold',
} as const;
```

---

## 7. UTILITY LIBRARY (P1)

**File:** `apps/mobile/lib/sleepWeeklyInsights.ts`

```typescript
/**
 * calculateWeeklyDelta
 * Compares today's sleep score against the rolling 7-day average (excluding today).
 * Returns the percentage difference, or null if fewer than 3 prior days have data.
 *
 * @param todayScore - the score for the selected day
 * @param weekScores - array of 7 score values (Mon→Sun), null if no data
 * @param todayIndex - index of today in weekScores (0=Mon, 6=Sun)
 * @returns percentage delta (e.g. 12 = 12% better) or null
 */
export function calculateWeeklyDelta(
  todayScore: number | undefined,
  weekScores: (number | null)[],
  todayIndex: number,
): number | null {
  if (todayScore === undefined || todayScore === null) return null;
  const priorScores = weekScores.filter(
    (s, i) => i !== todayIndex && s !== null,
  ) as number[];
  if (priorScores.length < 3) return null;
  const avg = priorScores.reduce((a, b) => a + b, 0) / priorScores.length;
  if (avg === 0) return null;
  return Math.round(((todayScore - avg) / avg) * 100);
}

/**
 * deriveWeekSeries
 * Extracts 7-day ordered arrays from recentHistory for the current month/week.
 * Always returns 7 values Mon→Sun for the week containing selectedDate.
 * Missing days are null.
 */
export function deriveWeekSeries(
  recentHistory: any[],
  monthlyData: Record<string, any[]>,
  selectedDate: Date,
): WeekSeriesData {
  // ... implementation: find Mon of selected week, build 7-slot arrays,
  //     look up each date in recentHistory + monthlyData,
  //     return { durations, bedtimes, wakeTimes, scores, todayIndex }
}

/**
 * toBedtimeMinutes
 * Converts an ISO time string to minutes-from-midnight, adjusted so that
 * late-night times (before 12:00) are treated as > 24*60 for consistent ordering.
 * (e.g. 00:30 → 1470, 23:00 → 1380)
 */
export function toBedtimeMinutes(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  let mins = d.getHours() * 60 + d.getMinutes();
  if (mins < 12 * 60) mins += 24 * 60;
  return mins;
}

/**
 * toWakeMinutes
 * Converts an ISO time string to minutes-from-midnight (no adjustment needed for wake).
 */
export function toWakeMinutes(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}
```

**Also implement:** `getHeroGradientStops(gradeColor: string): HeroGradientStops` — blends `gradeColor` with `SLEEP_THEME.heroGradientPrimary` at 60/40 to produce animated primary stop.

---

## 8. STAGED EXECUTION

### P0 — FOUNDATIONS

**Goal:** Zero logic. Zero UI. Everything compiles.

**Tasks:**

1. `npx expo install @expo-google-fonts/dm-sans` — add dependency
2. Create `constants/theme.ts` — full `SLEEP_THEME` + `SLEEP_LAYOUT` + `SLEEP_FONTS`
3. Create `types/sleep-ui.ts` — all interfaces (Section 5)
4. Add DM Sans imports to `app/_layout.tsx` inside `useFonts()` call
5. Create empty barrel files for each new component with correct imports and `export default function ComponentName() { return null; }`
6. Create empty `lib/sleepWeeklyInsights.ts` with function stubs returning `null`

**Exit criteria:**

- `npx expo export --platform android` (or `npx tsc --noEmit`) passes with 0 errors
- `npx eslint apps/mobile/constants/theme.ts apps/mobile/types/sleep-ui.ts --max-warnings 0`
- All new files exist at correct paths

---

### P1 — CORE LOGIC (NO UI)

**Goal:** Data, calculations, selectors. No visual output.

**Tasks:**

1. Implement `deriveWeekSeries()` in `lib/sleepWeeklyInsights.ts`
   - Must handle: weeks spanning month boundary, current month data + monthly cache data
   - Must produce exactly 7 values with `null` for gaps
   - Must correctly compute `todayIndex` as day-of-week (Mon=0, Sun=6)
2. Implement `calculateWeeklyDelta()` — see spec above
3. Implement `toBedtimeMinutes()` and `toWakeMinutes()`
4. Implement `getHeroGradientStops()` — color blend logic
5. Implement `buildSmoothPath()` Catmull-Rom helper in `lib/sleepChartUtils.ts` (new file)
   - Must handle edge cases: 1 point (just a dot), 2 points (straight line), ≥3 points (curve)
   - Must return valid SVG path string
6. Verify existing `getSleepScoreGrade()` usage is correct for new hero gradient logic

**Exit criteria:**

- TypeScript strict passes
- All new pure functions have at least one inline test comment showing expected input→output
- No `any` types in new lib files

---

### P2 — COMPONENTS

**Goal:** Individually correct components. Not assembled into screen yet.

Build in this order (each component must typecheck before starting the next):

**2a. `SleepSkeletons.tsx`** — Build first so loading states are ready

- Shimmer animation: `Animated.Value` from `react-native` (not Reanimated — `useNativeDriver: false` for color interpolation)
- Export: `HeroSkeleton`, `CardSkeleton`, `ChartSkeleton`, `FullScreenSkeleton`

**2b. `SleepEmptyState.tsx`** — Build before live data components

- Muted gray hero gradient (static, no animation)
- "Add Sleep Data" white button
- N/A text values

**2c. `WeeklySleepChart.tsx`**

- Import `buildSmoothPath` from `lib/sleepChartUtils.ts`
- All 4 paths (main, ghost, dashed, area fill)
- Data dots with today highlight
- Tooltip pill above today's dot
- X-axis labels row
- Must work with all-null data (shows only ghost/dashed lines)
- Must work with partial data (e.g. only 3 of 7 days)

**2d. `SleepHero.tsx`**

- SVG `<RadialGradient>` layer (position absolute, pointerEvents="none")
- `expo-linear-gradient` overlay layer
- Uses `useSleepGradient` hook for animated color transition
- Hero text content (date, grade, score, description)
- Badge pill (conditional render based on `weeklyDelta !== null`)
- Embeds `WeeklySleepChart` at bottom with `marginTop: -CHART_OVERLAP`
- Skeleton state when `isLoading === true`

**2e. `SleepCardBedtime.tsx`** (Card A)

- Split layout
- Dot rows with color + opacity logic
- Time display with suffix baseline alignment
- Skeleton state passthrough

**2f. `SleepCardDeep.tsx`** (Card B)

- Zone bar with dot indicator at correct position
- Status pill variant logic
- Copy selection by zone
- Skeleton state passthrough

**2g. `SleepStagesCard.tsx`** (Card C)

- Empty card shell with label
- Shimmer placeholder lines
- TODO comment for future wiring

**2h. `SleepEditLink.tsx`**

- Underlined text, no border box
- Haptic on press

**Exit criteria per component:**

- Renders without error when supplied with mock props matching the interface
- No TypeScript errors
- No `StyleSheet.create` calls referencing hardcoded hex values (all from `SLEEP_THEME`)
- `npx eslint components/sleep/redesign/ComponentName.tsx --max-warnings 0`

---

### P3 — NAVBAR REPLACEMENT

**Goal:** Replace `CustomTabBar` in `_layout.tsx`.

**Tasks:**

1. Create `FloatingTabBar` component inside `_layout.tsx` (or extracted to `components/navigation/FloatingTabBar.tsx` — prefer extracted for clarity)
2. Keep all routing logic (`MaterialTopTabs`, `swipeEnabled: false`, `animationEnabled: true`)
3. Keep `SleepTabIcon` with its existing moon + star animation exactly as-is
4. Implement spec from Section 2.6
5. Keep `initSleepStoreListeners` and `cleanupSleepStoreListeners` in `TabLayout`
6. Keep `checkHealthConnectStatus` + `fetchSleepData` prefetch logic in `TabLayout.useEffect`
7. Tab press animation: `useSharedValue(1)` → `withSpring(0.92)` → `withSpring(1)` per tab
8. Remove the old `activeIndicatorInner` with green background — replace with white 8% opacity

**Invariant:** The routing behavior must be identical to before (same 4 tabs, same order, same swipe-disabled).

**Exit criteria:**

- App navigates correctly between all 4 tabs
- Sleep tab shows animated moon icon
- Navbar floats above content with blur effect
- TypeScript passes

---

### P4 — SCREEN ASSEMBLY

**Goal:** Full `app/(tabs)/sleep.tsx` rewrite.

**Architecture of new sleep.tsx:**

```typescript
// app/(tabs)/sleep.tsx — structural overview (implement in full, not pseudocode)

export default function SleepScreen() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState(() => normalizeDate(new Date()));
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isCalendarVisible, setIsCalendarVisible] = useState(false);
  const scrollY = useSharedValue(0);
  const insets = useSafeAreaInsets();

  // ── Store ──────────────────────────────────────────────────────────────────
  const { recentHistory, monthlyData, fetchSleepData, fetchMonthHistory,
          fetchSleepDataRange, forceSaveManualSleep, checkHealthConnectStatus } = useSleepStore();
  const { user } = useAuthStore();

  // ── Pager (day swipe) ─────────────────────────────────────────────────────
  // Keep FlatList pager logic from current sleep.tsx:
  // - monthDates array computed from selectedDate (same logic)
  // - activeIndex, pagerRef, handlePagerEnd
  // - Navigation parent swipeEnabled toggle on scroll start/end

  // ── Derived data ──────────────────────────────────────────────────────────
  // currentData: find historyItem for selectedDate in recentHistory + monthlyData
  // weekData: call deriveWeekSeries() with recentHistory, monthlyData, selectedDate
  // weeklyDelta: call calculateWeeklyDelta()
  // gradeInfo: getSleepScoreGrade(score ?? 0)
  // bedtimeParts / wakeParts: formatTimeParts()
  // deepZone: compute from deep_sleep_minutes / duration_minutes

  // ── Scroll handler ────────────────────────────────────────────────────────
  // Animated.ScrollView onScroll → scrollY shared value

  // ── Hero lock behavior ────────────────────────────────────────────────────
  // Hero: position absolute at top
  // BlurView header strip: opacity animated 0→1 as scrollY crosses HERO_HEIGHT * 0.6
  // contentContainerStyle paddingTop = HERO_HEIGHT - CHART_OVERLAP (so cards start below hero)

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: SLEEP_THEME.screenBg }}>
      {/* Locked hero (position absolute) */}
      <SleepHero ... />

      {/* Frosted glass strip that appears when scrolled */}
      <AnimatedBlurHeader scrollY={scrollY} threshold={HERO_HEIGHT * 0.6} />

      {/* Day pager (horizontal FlatList) */}
      {/* This FlatList renders the "title section" — but in the NEW design,
          the hero is outside the pager. The pager now renders:
          - The selected day context (just the date string change triggers hero update)
          - The pager drives selectedDate state via onMomentumScrollEnd
          - The actual visible content is rendered in the ScrollView below */}
      <FlatList ref={pagerRef} ... />

      {/* Main scrollable content */}
      <Animated.ScrollView
        contentContainerStyle={{ paddingTop: HERO_HEIGHT - CHART_OVERLAP, paddingBottom: SLEEP_LAYOUT.scrollBottomPad }}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}>

        {isLoading ? (
          <FullScreenSkeleton />
        ) : !historyItem ? (
          <SleepEmptyState date={selectedDate} onAddData={() => setIsAddModalVisible(true)} />
        ) : (
          <>
            <SleepCardBedtime ... />
            <SleepCardDeep ... />
            <SleepStagesCard />
            <SleepEditLink onPress={() => setIsAddModalVisible(true)} />
          </>
        )}
      </Animated.ScrollView>

      {/* Modals */}
      <SleepCalendar ... />
      <AddSleepRecordModal ... />
    </View>
  );
}
```

**Key implementation details:**

**Pager adaptation:** In the new design, the FlatList pager does NOT render the hero content. Instead, `onMomentumScrollEnd` updates `selectedDate`, which flows into `SleepHero` as a prop. The pager itself should be rendered with `height: 0` and `overflow: hidden` — it exists purely as a gesture handler to change the date. **OR** (preferred): keep the pager rendering a full-width invisible `View` behind the hero, sized to `HERO_HEIGHT`. When the user swipes left/right on the hero area, the pager captures the gesture and updates the date. The hero uses Reanimated to animate the date change.

**Haptics on day swipe:** In `handlePagerEnd`, call `await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)`.

**Loading state:** `isLoading` is `true` when `sleepStore.loading === true` OR when `historyItem === undefined` (not yet fetched for this date, distinct from `null` = fetched but no data). Implement a ref to track "fetch initiated for this date" to avoid flash.

**Data prefetch on pager navigation:** Keep existing range-prefetch logic from `sleep.tsx`: when `activeIndex >= cacheRange.max - 1`, prefetch next range; when `activeIndex <= cacheRange.min + 1`, prefetch previous range.

**Exit criteria:**

- Full screen renders with real data from sleepStore
- Day swiping works, selectedDate updates, hero grade/color changes
- Loading skeleton appears before first data load
- Empty state appears for days with no data
- Cards A and B show correct data
- Card C shows placeholder
- Edit link appears at bottom when data present
- All modals still work (SleepCalendar, AddSleepRecordModal)
- TypeScript strict passes across all files

---

### P5 — POLISH (Haptics, Animations, Refinements)

**Goal:** Elevate feel. Fix rough edges.

**Haptics implementation (expo-haptics):**

| Trigger                           | Feedback                     |
| --------------------------------- | ---------------------------- |
| Day swipe (pager snap)            | `ImpactFeedbackStyle.Light`  |
| "Add Sleep Data" CTA press        | `ImpactFeedbackStyle.Medium` |
| "Edit sleep data" text link press | `ImpactFeedbackStyle.Light`  |
| Calendar day selection            | `ImpactFeedbackStyle.Light`  |
| Tab press in navbar               | `ImpactFeedbackStyle.Light`  |

**Animation checklist:**

- [ ] Hero gradient cross-fades smoothly (600ms) between days
- [ ] FlatList pager snaps to day with momentum (existing, verify still works)
- [ ] Cards slide up from below on initial mount (FadeInDown 400ms, staggered: Card A → 50ms → Card B → 50ms → Card C)
- [ ] Skeleton shimmer loops continuously while loading
- [ ] Empty state fades in (FadeIn 300ms) when data returns null
- [ ] Tooltip on chart: appears with `FadeIn 200ms` when chart mounts
- [ ] Tab bar active indicator slides horizontally (spring animation between tab positions)
- [ ] Zone bar dot indicator: on mount, animate from left edge to correct position (`withTiming(400ms, Easing.out(Easing.cubic))`)
- [ ] "Add Sleep Data" button: spring scale 0.96 on press

**Frosted glass scroll transition:**

```typescript
// AnimatedBlurHeader implementation
// A View with BlurView child, positioned at top of screen (under status bar to cards boundary)
// Opacity animated: 0 when scrollY < threshold, 1 when scrollY > threshold + 30px
// Use useAnimatedStyle with interpolate
```

**Exit criteria:**

- All haptics fire at correct moments
- No animation jank (test on physical device or Release build)
- No RCTBridge warnings about animation on wrong thread
- All animations use `useNativeDriver: true` where possible (layout animations excluded)

---

## 9. DATA WIRING GUIDE

### Source mapping

| UI element          | Source                                                     | Field                    | Transform                     |
| ------------------- | ---------------------------------------------------------- | ------------------------ | ----------------------------- |
| Hero grade text     | `getSleepScoreGrade(score)`                                | `.grade`                 | Direct                        |
| Hero gradient color | `getSleepScoreGrade(score)`                                | `.color`                 | `getHeroGradientStops(color)` |
| Score display       | `recentHistory.find(date)`                                 | `.sleep_score`           | `Math.round()`                |
| Score fallback      | `recentHistory.find(date)`                                 | `.score_breakdown.score` | `Math.round()`                |
| Description         | `getSleepDescription(score, durationMinutes)`              | —                        | Direct                        |
| Weekly delta        | `calculateWeeklyDelta(todayScore, weekScores, todayIndex)` | —                        | `lib/sleepWeeklyInsights.ts`  |
| Chart data          | `deriveWeekSeries().durations`                             | —                        | `lib/sleepWeeklyInsights.ts`  |
| Chart todayIndex    | `deriveWeekSeries().todayIndex`                            | —                        | `lib/sleepWeeklyInsights.ts`  |
| Bedtime display     | `historyItem.start_time`                                   | —                        | `formatTimeParts(start_time)` |
| Wake display        | `historyItem.end_time`                                     | —                        | `formatTimeParts(end_time)`   |
| Bedtime dot series  | `deriveWeekSeries().bedtimes`                              | —                        | `toBedtimeMinutes()` per item |
| Wake dot series     | `deriveWeekSeries().wakeTimes`                             | —                        | `toWakeMinutes()` per item    |
| Deep minutes        | `historyItem.deep_sleep_minutes`                           | —                        | Direct (null-safe)            |
| Total minutes       | `historyItem.duration_minutes`                             | —                        | Direct (null-safe)            |
| Deep zone %         | `deep_sleep_minutes / duration_minutes`                    | —                        | Component-internal            |

### `resolveSleepScore()` — reuse existing helper

The current `sleep.tsx` has a `resolveSleepScore(item)` function. **Reuse this pattern** (inline or extracted) in the new screen:

```typescript
const resolveSleepScore = (item: any): number | undefined => {
  if (!item) return undefined;
  if (typeof item?.score_breakdown?.score === 'number')
    return Math.round(item.score_breakdown.score);
  if (typeof item?.sleep_score === 'number')
    return Math.round(item.sleep_score);
  return undefined;
};
```

### `currentData` derivation — reuse existing pattern

```typescript
const currentData = useMemo(() => {
  const targetDateStr = dateKey(selectedDate);
  const hist = recentHistory || [];
  let displayItem = hist.find((item) => item.date === targetDateStr);
  if (!displayItem && monthlyData) {
    const monthKey = targetDateStr.substring(0, 7);
    const monthRecords = monthlyData[monthKey];
    if (monthRecords)
      displayItem = monthRecords.find((r) => r.date === targetDateStr);
  }
  return { historyItem: displayItem || null };
}, [selectedDate, recentHistory, monthlyData]);
```

---

## 10. ANIMATION REFERENCE

| Animation               | Library                  | Duration        | Easing                      | Notes                          |
| ----------------------- | ------------------------ | --------------- | --------------------------- | ------------------------------ |
| Hero gradient shift     | Reanimated `withTiming`  | 600ms           | `Easing.out(Easing.cubic)`  | Via `useSleepGradient`         |
| Day swipe momentum      | FlatList native          | System          | System spring               | Keep as-is                     |
| Card entrance (stagger) | Reanimated `FadeInDown`  | 400ms           | Default                     | 50ms between cards             |
| Skeleton shimmer        | RN `Animated.loop`       | 1200ms per loop | `Easing.inOut(Easing.ease)` | Background color               |
| Zone bar dot            | Reanimated `withTiming`  | 400ms           | `Easing.out(Easing.cubic)`  | On component mount             |
| Tab indicator slide     | Reanimated `withSpring`  | Auto            | damping 18, stiffness 120   | Between tab positions          |
| Tab press scale         | Reanimated `withSpring`  | Auto            | damping 15, stiffness 200   | 1.0 → 0.92 → 1.0               |
| Empty state appear      | Reanimated `FadeIn`      | 300ms           | Default                     | —                              |
| Frosted glass reveal    | Reanimated `interpolate` | —               | Driven by scrollY           | Threshold: `HERO_HEIGHT * 0.6` |
| Tooltip appear          | Reanimated `FadeIn`      | 200ms           | Default                     | On chart mount                 |
| Button press scale      | Reanimated `withSpring`  | Auto            | damping 15                  | Add Data CTA                   |

---

## 11. HAPTICS MAP

```typescript
import * as Haptics from 'expo-haptics';

// In handlePagerEnd (FlatList day swipe snap)
await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

// In SleepEmptyState "Add Sleep Data" button onPress
await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

// In SleepEditLink onPress
await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

// In SleepCalendar onDateSelect (pass through existing handler)
await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

// In FloatingTabBar tab onPress
await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
```

All haptic calls are fire-and-forget (`void Haptics.impactAsync(...)`). Do not `await` in render or gesture handlers — use `void` to avoid blocking.

---

## 12. ACCEPTANCE CRITERIA

### Functional

- [ ] Horizontal day swipe changes selectedDate, hero updates with correct grade/score/color
- [ ] Hero gradient animates (cross-fades) between different sleep grade colors
- [ ] Chart shows last 7 days of actual data from store, not hardcoded values
- [ ] Chart tooltip shows today's duration formatted as "Xh Ym"
- [ ] Card A shows correct bedtime and wake time from `start_time` / `end_time`
- [ ] Card A dot row: 7 dots, today's dot is larger + has glow ring, missing days at 40% opacity
- [ ] Card B shows correct deep sleep duration, correct zone, correct copy variant
- [ ] Card B zone bar dot is at correct percentage position
- [ ] Card C renders as placeholder only (no hypnogram wired)
- [ ] Empty state renders for days with no `historyItem`
- [ ] Empty state "Add Sleep Data" button opens `AddSleepRecordModal`
- [ ] "Edit sleep data" link appears at bottom only when data is present
- [ ] Skeleton screens shown while fetching
- [ ] Navbar: 4 tabs, active state (icon + label white), inactive (icon only, 45% opacity)
- [ ] Navbar floats with blur effect
- [ ] All haptics fire at documented triggers
- [ ] Weekly delta badge shows "↑ N% better" or "↓ N% worse" when data allows
- [ ] Badge hidden when fewer than 3 prior days have score data
- [ ] DM Sans font used across all new components

### TypeScript / Quality

- [ ] `npx tsc --noEmit` passes with 0 errors (strict mode)
- [ ] `npx eslint apps/mobile/components/sleep/redesign/** --max-warnings 0`
- [ ] `npx eslint apps/mobile/app/(tabs)/sleep.tsx --max-warnings 0`
- [ ] No `any` types in new files (except inherited `any` from store items, which must be explicitly cast)
- [ ] No hardcoded hex color strings in component files — all via `SLEEP_THEME`
- [ ] No hardcoded font strings in component files — all via `SLEEP_FONTS`

### Deleted Files

- [ ] `SleepHeader.tsx`, `SleepMetricsBento.tsx`, `WeeklyBarChart.tsx`, `DailyHypnogramCard.tsx`, `FluidSleepChart.tsx` are deleted

---

## 13. FORBIDDEN PATTERNS

These patterns are explicitly disallowed in the new codebase:

```typescript
// ❌ Hardcoded colors
backgroundColor: '#1C1C1E'                    // use SLEEP_THEME.cardBg

// ❌ Hardcoded font names
fontFamily: 'DMSans-Bold'                     // use SLEEP_FONTS.bold

// ❌ Hardcoded sleep thresholds
const isLow = deepPct < 0.13;                // import from SLEEP_THEME or sleepConstants

// ❌ Mocked/hardcoded data values
durationMinutes: 450                          // all data must come from sleepStore

// ❌ Inline styles with magic numbers
marginTop: -40                                // use SLEEP_LAYOUT.chartOverlap

// ❌ ts-ignore or ts-expect-error without comment
// @ts-ignore                                 // explain the reason if ever needed

// ❌ console.log left in production code     // remove all before P3 exit

// ❌ useEffect with missing dependencies     // fix deps array, no eslint-disable

// ❌ Blocking haptic calls
await Haptics.impactAsync(...)               // use void Haptics.impactAsync(...)

// ❌ Advancing a stage past a failing typecheck
// Typecheck must pass at every stage exit gate — no exceptions
```

---

## 14. CONTEXT.MD UPDATE REQUIREMENTS

After P5 completes, update `packages/docs/context.md` to record:

1. New path alias or import convention: none (reuses existing `@constants`, `@lib`, `@components`)
2. New module: `components/sleep/redesign/` — sleep screen redesigned components
3. New design token file: `constants/theme.ts` — `SLEEP_THEME`, `SLEEP_LAYOUT`, `SLEEP_FONTS`
4. New utility file: `lib/sleepWeeklyInsights.ts` — weekly delta and series derivation
5. New type file: `types/sleep-ui.ts` — sleep UI prop interfaces
6. Changed font: DM Sans added as `DMSans-Regular/Medium/SemiBold/Bold` alongside existing Inter/Poppins
7. Navbar: `FloatingTabBar` replaces old `CustomTabBar` in `_layout.tsx`
8. Note: `SleepHypnogram` wiring deferred to Card C follow-up implementation

---

## 15. RESIDUAL RISKS (Known Deferred Items)

| Item                             | Risk                                                                                      | Deferral reason                                                 |
| -------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Noise/grain texture on hero      | Low visual impact                                                                         | Requires texture asset or SVG filter; skip for v1               |
| Card C (`SleepHypnogram`) wiring | Design not finalized                                                                      | Separate implementation sprint                                  |
| iOS `expo-blur` parity           | BlurView intensity differs slightly on iOS vs Android                                     | Test on both; adjust `intensity` per platform                   |
| Catmull-Rom with 1–2 data points | Chart may look odd                                                                        | Handle edge cases in `buildSmoothPath()`                        |
| Week boundary month edge case    | `deriveWeekSeries` complex when week spans 2 months                                       | Write defensive code; add test comment showing boundary case    |
| `MaterialTopTabs` swipe conflict | Horizontal swipe within sleep tab (day pager) may conflict with tab swipe on some devices | `swipeEnabled: false` is already set; verify on physical device |
| DM Sans fallback                 | If font fails to load, UI falls back to system font                                       | `fontsLoaded` guard in `_layout.tsx` already handles this       |

---

_End of document. Version 1.0. Codex must not begin coding until all pre-flight items in Section 0 are confirmed read and understood._
