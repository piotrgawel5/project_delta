Read packages/docs/context.md in full. Pay attention to:

- UI standards section (optical corner radii rule, NativeWind/Tailwind styling)
- The chart library in use: victory-native (for reference only — do NOT use it here)
- react-native-reanimated is available
- react-native-svg is available via Expo SDK (import from 'react-native-svg')
- NativeWind for className styling on View/Text, but SVG elements use inline props only

Create apps/mobile/components/sleep/SleepHypnogram.tsx.

This component renders an Apple Health-style sleep hypnogram: vertical bars coloured
by sleep stage, bottom-aligned, width proportional to phase duration, height
proportional to stage depth. One Animated.View mask animates the reveal. Touch
selects a phase and shows a floating tooltip. Free users see a blurred+locked overlay.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DESIGN CONSTANTS (define at top of file, outside the component)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const CHART_HEIGHT = 160; // px — the drawable area for bars
const AXIS_HEIGHT = 24; // px — time label row below chart
const BAR_GAP = 1.5; // px — horizontal gap between adjacent phase bars
const MIN_BAR_WIDTH = 2; // px — clamp to avoid invisible slivers
const CORNER_RADIUS = 3; // rx/ry on bar tops

// Stage height as fraction of CHART_HEIGHT (bars are bottom-aligned, grow upward)
const STAGE_HEIGHT_RATIO: Record<string, number> = {
awake: 0.10,
light: 0.40,
rem: 0.72,
deep: 1.00,
};

// Gradient stop colours (top → bottom of each bar)
const STAGE_GRADIENT: Record<string, { top: string; bottom: string }> = {
deep: { top: '#8B5CF6', bottom: '#4C1D95' }, // violet
light: { top: '#3B82F6', bottom: '#1E3A8A' }, // blue
rem: { top: '#06B6D4', bottom: '#0E4C61' }, // cyan
awake: { top: '#F97316', bottom: '#7C2D12' }, // orange→red
};

const CARD_BG = '#0F0F0F'; // match the parent card background exactly
const AXIS_LINE_COLOR = '#2D2D2D';
const CYCLE_LINE_COLOR = 'rgba(255,255,255,0.15)';
const CYCLE_LINE_DASH = [3, 5]; // dashArray for cycle boundary lines
const TIME_LABEL_COLOR = '#6B7280';
const SELECTED_RING = 'rgba(255,255,255,0.35)'; // stroke on selected bar

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TYPE — SleepPhaseRow (mirrors API response, no import from shared needed)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface SleepPhaseRow {
id: string;
cycle_number: number;
stage: 'awake' | 'light' | 'deep' | 'rem';
start_time: string;
end_time: string;
duration_minutes: number;
confidence: 'high' | 'medium' | 'low';
}

interface SleepHypnogramProps {
phases: SleepPhaseRow[];
sessionStart: string; // ISO — sleep_data.start_time
sessionEnd: string; // ISO — sleep_data.end_time
isPremium: boolean;
isLoading?: boolean;
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GEOMETRY COMPUTATION — pure function, called in useMemo
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface BarGeometry {
x: number;
y: number;
width: number;
height: number;
phase: SleepPhaseRow;
gradientId: string;
}

interface CycleLine {
x: number;
}

interface ChartGeometry {
bars: BarGeometry[];
cycleLines: CycleLine[];
timeLabels: Array<{ x: number; label: string }>;
totalDurationMinutes: number;
}

function computeGeometry(
phases: SleepPhaseRow[],
sessionStart: string,
sessionEnd: string,
chartWidth: number,
): ChartGeometry {
if (phases.length === 0 || chartWidth === 0) {
return { bars: [], cycleLines: [], timeLabels: [], totalDurationMinutes: 0 };
}

const sessionStartMs = new Date(sessionStart).getTime();
const sessionEndMs = new Date(sessionEnd).getTime();
const totalMs = sessionEndMs - sessionStartMs;
const totalMinutes = totalMs / 60_000;

const msToX = (ms: number) => ((ms - sessionStartMs) / totalMs) \* chartWidth;

// Bars
const bars: BarGeometry[] = phases.map((phase, i) => {
const phaseStartMs = new Date(phase.start*time).getTime();
const phaseEndMs = new Date(phase.end_time).getTime();
const x = msToX(phaseStartMs);
const rawW = msToX(phaseEndMs) - x - BAR_GAP;
const w = Math.max(MIN_BAR_WIDTH, rawW);
const h = (STAGE_HEIGHT_RATIO[phase.stage] ?? 0.15) \* CHART_HEIGHT;
return {
x,
y: CHART_HEIGHT - h,
width: w,
height: h,
phase,
gradientId: `grad*${phase.stage}`, // shared gradient per stage
};
});

// Cycle boundary lines — draw at the x position where cycle_number changes
const cycleLines: CycleLine[] = [];
for (let i = 1; i < phases.length; i++) {
if (phases[i].cycle_number !== phases[i - 1].cycle_number &&
phases[i].cycle_number > 0) {
cycleLines.push({ x: bars[i].x - BAR_GAP / 2 });
}
}

// Time labels — bedtime + each full hour + wakeup (max 6 labels)
const timeLabels: Array<{ x: number; label: string }> = [];
const fmt = (ms: number) => {
const d = new Date(ms);
const h = d.getHours();
const suffix = h >= 12 ? 'PM' : 'AM';
const h12 = h % 12 === 0 ? 12 : h % 12;
return `${h12}${suffix}`;
};

// Bedtime label
timeLabels.push({ x: 0, label: fmt(sessionStartMs) });

// Hourly marks — skip if too close to start/end label (within 8% of chart width)
const firstHourMs = Math.ceil(sessionStartMs / 3_600_000) _ 3_600_000;
for (let ms = firstHourMs; ms < sessionEndMs - 3_600_000 _ 0.5; ms += 3_600_000) {
const x = msToX(ms);
if (x > chartWidth _ 0.08 && x < chartWidth _ 0.92) {
timeLabels.push({ x, label: fmt(ms) });
}
if (timeLabels.length >= 5) break;
}

// Wakeup label
timeLabels.push({ x: chartWidth, label: fmt(sessionEndMs) });

return { bars, cycleLines, timeLabels, totalDurationMinutes: totalMinutes };
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOOLTIP SUB-COMPONENT — pure presentational, no hooks
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const STAGE_LABEL: Record<string, string> = {
awake: 'Awake',
light: 'Light Sleep',
deep: 'Deep Sleep',
rem: 'REM Sleep',
};

function formatHM(iso: string): string {
const d = new Date(iso);
const h = d.getHours() % 12 || 12;
const m = String(d.getMinutes()).padStart(2, '0');
const s = d.getHours() >= 12 ? 'PM' : 'AM';
return `${h}:${m} ${s}`;
}

interface TooltipProps {
bar: BarGeometry;
chartWidth: number;
}

// Tooltip floats above the selected bar, clamped to chart bounds
function PhaseTooltip({ bar, chartWidth }: TooltipProps) {
const TOOLTIP_W = 130;
const color = STAGE_GRADIENT[bar.phase.stage]?.top ?? '#FFF';
let left = bar.x + bar.width / 2 - TOOLTIP_W / 2;
left = Math.max(0, Math.min(left, chartWidth - TOOLTIP_W));

return (
<View
style={{
        position: 'absolute',
        top: Math.max(0, bar.y - 72),
        left,
        width: TOOLTIP_W,
        backgroundColor: '#1C1C1E',
        borderRadius: 10,
        padding: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        // Shadow for depth
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
        elevation: 8,
      }}
pointerEvents="none" >
{/_ Coloured stage dot + label _/}
<View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
<View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, marginRight: 5 }} />
<Text style={{ color: '#FFF', fontSize: 11, fontWeight: '600' }}>
{STAGE_LABEL[bar.phase.stage]}
</Text>
</View>
<Text style={{ color: '#9CA3AF', fontSize: 10 }}>
{formatHM(bar.phase.start_time)} – {formatHM(bar.phase.end_time)}
</Text>
<Text style={{ color: '#6B7280', fontSize: 10, marginTop: 2 }}>
{bar.phase.duration_minutes} min
</Text>
</View>
);
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LOADING SKELETON — shown while isLoading is true
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use a simple set of static rounded rectangles with opacity 0.15–0.25, no animation
needed (keep render cost zero). Heights should approximate a realistic night:
left third mostly tall (deep), right third slightly shorter (REM). Use 8 fake bars
of varying widths to give a plausible shape without data.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PREMIUM LOCK OVERLAY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

When isPremium is false, render the chart normally BUT:

1. Apply a blurView over the chart (use @react-native-community/blur if available,
   otherwise use a semi-transparent dark overlay — check existing imports in the
   project before adding a new dependency).
2. Centered on top: lock icon (use an existing icon set already in the project) + text "Upgrade to Pro" in white semibold + subtext "Unlock sleep timeline"
   in #6B7280.
   Do NOT show the tooltip interaction when !isPremium.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MAIN COMPONENT STRUCTURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const SleepHypnogram = React.memo(function SleepHypnogram({
phases,
sessionStart,
sessionEnd,
isPremium,
isLoading = false,
}: SleepHypnogramProps) {

const [chartWidth, setChartWidth] = useState(0);

// All geometry computed once, never in render
const geometry = useMemo(
() => computeGeometry(phases, sessionStart, sessionEnd, chartWidth),
[phases, sessionStart, sessionEnd, chartWidth],
);

// ── Reveal animation ──────────────────────────────────────────────────────
// Strategy: a solid View (same colour as card bg) sits absolutely over the
// chart and translates up by its own height, revealing bars from bottom to top.
// ONE animated element drives the whole reveal — zero per-bar animation overhead.
const maskY = useSharedValue(CHART_HEIGHT + AXIS_HEIGHT);
const maskStyle = useAnimatedStyle(() => ({
transform: [{ translateY: maskY.value }],
}));

useEffect(() => {
if (phases.length > 0 && chartWidth > 0) {
maskY.value = CHART_HEIGHT + AXIS_HEIGHT; // reset if data changes
maskY.value = withSpring(0, { damping: 22, stiffness: 80, mass: 0.8 });
}
}, [phases, chartWidth]);

// ── Touch handling ────────────────────────────────────────────────────────
const [selectedBar, setSelectedBar] = useState<BarGeometry | null>(null);

const handleTouchMove = useCallback((x: number) => {
if (!isPremium) return;
const hit = geometry.bars.find(
(b) => x >= b.x && x <= b.x + b.width + BAR_GAP,
);
setSelectedBar(hit ?? null);
}, [geometry.bars, isPremium]);

const clearSelection = useCallback(() => setSelectedBar(null), []);

// ── Render ────────────────────────────────────────────────────────────────
const totalH = CHART_HEIGHT + AXIS_HEIGHT;

return (
<View
style={{ width: '100%' }}
onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)} >
{/_ Stage legend row _/}
<StageLegend />

      {/* Chart area */}
      <View style={{ height: totalH }}>

        {isLoading ? (
          <HypnogramSkeleton chartWidth={chartWidth} />
        ) : (
          <>
            {/* ── SVG — completely static, never re-rendered after data loads ── */}
            <Svg width={chartWidth} height={totalH}>
              <Defs>
                {/* One LinearGradient per stage (4 total) */}
                {Object.entries(STAGE_GRADIENT).map(([stage, colors]) => (
                  <LinearGradient
                    key={stage}
                    id={`grad_${stage}`}
                    x1="0" y1="0" x2="0" y2="1"
                  >
                    <Stop offset="0"   stopColor={colors.top}    stopOpacity="1" />
                    <Stop offset="1"   stopColor={colors.bottom} stopOpacity="0.85" />
                  </LinearGradient>
                ))}
              </Defs>

              {/* Cycle boundary dashed lines */}
              {geometry.cycleLines.map((cl, i) => (
                <Line
                  key={i}
                  x1={cl.x} y1={0}
                  x2={cl.x} y2={CHART_HEIGHT}
                  stroke={CYCLE_LINE_COLOR}
                  strokeWidth={1}
                  strokeDasharray={CYCLE_LINE_DASH.join(',')}
                />
              ))}

              {/* Phase bars */}
              {geometry.bars.map((bar, i) => (
                <Rect
                  key={bar.phase.id}
                  x={bar.x}
                  y={bar.y}
                  width={bar.width}
                  height={bar.height}
                  rx={CORNER_RADIUS}
                  ry={CORNER_RADIUS}
                  fill={`url(#${bar.gradientId})`}
                  stroke={selectedBar?.phase.id === bar.phase.id ? SELECTED_RING : 'none'}
                  strokeWidth={selectedBar?.phase.id === bar.phase.id ? 1.5 : 0}
                />
              ))}

              {/* Axis baseline */}
              <Line
                x1={0} y1={CHART_HEIGHT}
                x2={chartWidth} y2={CHART_HEIGHT}
                stroke={AXIS_LINE_COLOR}
                strokeWidth={1}
              />

              {/* Time labels */}
              {geometry.timeLabels.map((tl, i) => {
                const anchor =
                  i === 0 ? 'start' :
                  i === geometry.timeLabels.length - 1 ? 'end' : 'middle';
                return (
                  <SvgText
                    key={i}
                    x={tl.x}
                    y={CHART_HEIGHT + AXIS_HEIGHT - 4}
                    fontSize={9}
                    fill={TIME_LABEL_COLOR}
                    textAnchor={anchor}
                  >
                    {tl.label}
                  </SvgText>
                );
              })}
            </Svg>

            {/* Reveal mask — translates up to expose the chart */}
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: totalH,
                  backgroundColor: CARD_BG,
                },
                maskStyle,
              ]}
              pointerEvents="none"
            />

            {/* Touch layer — sits above SVG, below tooltip */}
            {isPremium && (
              <View
                style={{ position: 'absolute', top: 0, left: 0, right: 0, height: CHART_HEIGHT }}
                onStartShouldSetResponder={() => true}
                onResponderGrant={(e) => handleTouchMove(e.nativeEvent.locationX)}
                onResponderMove={(e) => handleTouchMove(e.nativeEvent.locationX)}
                onResponderRelease={clearSelection}
                onResponderTerminate={clearSelection}
              />
            )}

            {/* Floating tooltip */}
            {selectedBar && isPremium && (
              <PhaseTooltip bar={selectedBar} chartWidth={chartWidth} />
            )}

            {/* Premium lock overlay — rendered last so it sits on top */}
            {!isPremium && <PremiumLockOverlay />}
          </>
        )}
      </View>
    </View>

);
});

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STAGE LEGEND sub-component
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Horizontal row, left-aligned, above the chart.
Four items: ● Deep ● REM ● Light ● Awake
Each item: 6×6 rounded square in stage colour + stage label in #9CA3AF, 10px.
Spacing: gap-3 between items.

function StageLegend() {
const items = [
{ stage: 'deep', label: 'Deep' },
{ stage: 'rem', label: 'REM' },
{ stage: 'light', label: 'Light' },
{ stage: 'awake', label: 'Awake' },
] as const;

return (
<View style={{ flexDirection: 'row', gap: 12, marginBottom: 10 }}>
{items.map(({ stage, label }) => (
<View key={stage} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
<View style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: STAGE_GRADIENT[stage].top }} />
<Text style={{ color: '#6B7280', fontSize: 10 }}>{label}</Text>
</View>
))}
</View>
);
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IMPORTS (at top of file)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import Svg, {
Defs,
G,
Line,
LinearGradient,
Rect,
Stop,
Text as SvgText,
} from 'react-native-svg';
import Animated, {
useAnimatedStyle,
useSharedValue,
withSpring,
} from 'react-native-reanimated';

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PERFORMANCE RULES — enforce these, do not skip
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- React.memo wraps the entire component (already in the structure above)
- computeGeometry() is a pure function outside the component — never defined inside render
- geometry is computed in useMemo with [phases, sessionStart, sessionEnd, chartWidth] deps
- The SVG element is completely static — no animated props on any SVG element
- The only animated element is the mask Animated.View (one useAnimatedStyle)
- PhaseTooltip has no state, no hooks — pure render function
- StageLegend has no props, no state — define it outside the main component
- handleTouchMove and clearSelection wrapped in useCallback

After creating the file:
Run: npx tsc --noEmit from the repo root. Fix all errors.
Do NOT integrate into any screen yet — that is H2.
