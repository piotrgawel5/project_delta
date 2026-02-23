import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import Svg, { Defs, Line, LinearGradient, Rect, Stop } from 'react-native-svg';
import Reanimated, {
  Easing as ReanimatedEasing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const CHART_HEIGHT = 200;
const AXIS_HEIGHT = 24;
const BAR_GAP = 1.5;
const CYCLE_GAP = 8;
const BAR_MIN_WIDTH = 3;
const CORNER_RADIUS = 3;

const STAGE_DEPTH: Record<'awake' | 'light' | 'deep' | 'rem', number> = {
  awake: 0.1,
  light: 0.45,
  rem: 0.7,
  deep: 1.0,
};

const STAGE_GRADIENT: Record<'awake' | 'light' | 'deep' | 'rem', { top: string; bottom: string }> = {
  awake: { top: '#F97316', bottom: '#7C2D12' },
  light: { top: '#3B82F6', bottom: '#1E3A8A' },
  rem: { top: '#06B6D4', bottom: '#0E4C61' },
  deep: { top: '#8B5CF6', bottom: '#4C1D95' },
};

const CHART_BG = '#0F0F0F';
const AXIS_LINE = '#1F2937';
const CYCLE_LINE = '#4B5563';
const CYCLE_LINE_DASH = [3, 5];
const GRID_LINE_COLOR = 'rgba(156, 163, 175, 0.28)';
const MASK_BG = CHART_BG;
const TOOLTIP_BG = '#1F2937';
const TOOLTIP_BORDER = '#374151';
const LEGEND_TEXT = '#9CA3AF';
const AXIS_TEXT = '#6B7280';
const SELECTED_STROKE = 'rgba(255,255,255,0.4)';

const SKELETON_BARS: { wFrac: number; depth: number; cycleGapAfter?: boolean }[] = [
  { wFrac: 0.05, depth: 0.1 },
  { wFrac: 0.04, depth: 0.45 },
  { wFrac: 0.06, depth: 0.45 },
  { wFrac: 0.05, depth: 1 },
  { wFrac: 0.07, depth: 1 },
  { wFrac: 0.05, depth: 0.7, cycleGapAfter: true },
  { wFrac: 0.08, depth: 0.45 },
  { wFrac: 0.07, depth: 1 },
  { wFrac: 0.08, depth: 0.7, cycleGapAfter: true },
  { wFrac: 0.1, depth: 0.45 },
  { wFrac: 0.08, depth: 0.7 },
  { wFrac: 0.07, depth: 0.1 },
];

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
  sessionStart: string;
  sessionEnd: string;
  isPremium: boolean;
  isLoading?: boolean;
}

interface BarGeometry {
  x: number;
  width: number;
  height: number;
  phase: SleepPhaseRow;
}

interface TimeLabel {
  x: number;
  label: string;
  align: 'left' | 'center' | 'right';
}

interface ChartGeometry {
  bars: BarGeometry[];
  cycleLines: number[];
  hourLines: number[];
  timeLabels: TimeLabel[];
}

const STAGE_LABEL: Record<SleepPhaseRow['stage'], string> = {
  awake: 'Wake',
  light: 'Light',
  rem: 'REM',
  deep: 'Deep',
};

const formatClock = (iso: string, includeMinutesIfNeeded: boolean): string => {
  const date = new Date(iso);
  const h24 = date.getHours();
  const h12 = h24 % 12 || 12;
  const minutes = date.getMinutes();
  const meridiem = h24 >= 12 ? 'PM' : 'AM';
  if (includeMinutesIfNeeded && minutes !== 0) {
    return `${h12}:${String(minutes).padStart(2, '0')} ${meridiem}`;
  }
  return `${h12} ${meridiem}`;
};

const formatTooltipClock = (iso: string): string => {
  const date = new Date(iso);
  const h24 = date.getHours();
  const h12 = h24 % 12 || 12;
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const meridiem = h24 >= 12 ? 'PM' : 'AM';
  return `${h12}:${minutes} ${meridiem}`;
};

function computeGeometry(
  phases: SleepPhaseRow[],
  sessionStart: string,
  sessionEnd: string,
  chartWidth: number
): ChartGeometry {
  if (!sessionStart || !sessionEnd || !chartWidth || phases.length === 0) {
    return { bars: [], cycleLines: [], hourLines: [], timeLabels: [] };
  }

  const startMs = new Date(sessionStart).getTime();
  const endMs = new Date(sessionEnd).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return { bars: [], cycleLines: [], hourLines: [], timeLabels: [] };
  }

  const sorted = [...phases].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  const cycleBoundaryMs: number[] = [];
  for (let i = 1; i < sorted.length; i += 1) {
    const prevCycle = sorted[i - 1].cycle_number;
    const nextCycle = sorted[i].cycle_number;
    if (prevCycle >= 1 && nextCycle >= 1 && prevCycle !== nextCycle) {
      const boundaryMs = new Date(sorted[i].start_time).getTime();
      if (Number.isFinite(boundaryMs) && boundaryMs > startMs && boundaryMs < endMs) {
        cycleBoundaryMs.push(boundaryMs);
      }
    }
  }

  const totalGapWidth = cycleBoundaryMs.length * CYCLE_GAP;
  const usableWidth = Math.max(1, chartWidth - totalGapWidth);
  const totalMs = endMs - startMs;
  const baseScale = usableWidth / totalMs;

  const gapsBeforeMs = (ms: number) => {
    let count = 0;
    for (let i = 0; i < cycleBoundaryMs.length; i += 1) {
      if (cycleBoundaryMs[i] <= ms) count += 1;
      else break;
    }
    return count;
  };

  const timeToX = (ms: number) => {
    const elapsed = ms - startMs;
    return elapsed * baseScale + gapsBeforeMs(ms) * CYCLE_GAP;
  };

  const bars: BarGeometry[] = sorted
    .map((phase) => {
      const phaseStart = new Date(phase.start_time).getTime();
      const phaseEnd = new Date(phase.end_time).getTime();
      if (!Number.isFinite(phaseStart) || !Number.isFinite(phaseEnd) || phaseEnd <= phaseStart) {
        return null;
      }
      const x = Math.max(0, timeToX(phaseStart));
      const rawWidth = timeToX(phaseEnd) - x - BAR_GAP;
      const width = Math.max(BAR_MIN_WIDTH, rawWidth);
      const depthFraction = STAGE_DEPTH[phase.stage] ?? STAGE_DEPTH.awake;
      const height = depthFraction * CHART_HEIGHT;
      return { x, width, height, phase };
    })
    .filter((bar): bar is BarGeometry => bar !== null);

  const cycleLines = cycleBoundaryMs.map((ms) => timeToX(ms));

  const hourLines: number[] = [];
  const firstHourMs = Math.ceil(startMs / 3_600_000) * 3_600_000;
  for (let ms = firstHourMs; ms < endMs; ms += 3_600_000) {
    const x = timeToX(ms);
    if (x > 6 && x < chartWidth - 6) {
      hourLines.push(x);
    }
  }

  const edgeGuardMs = 15 * 60_000;
  const labelCandidates: TimeLabel[] = hourLines
    .map((x, idx) => {
      const ms = firstHourMs + idx * 3_600_000;
      return { x, label: formatClock(new Date(ms).toISOString(), false), align: 'center' as const };
    })
    .filter((_, idx) => {
      const ms = firstHourMs + idx * 3_600_000;
      return ms - startMs >= edgeGuardMs && endMs - ms >= edgeGuardMs;
    });

  const maxInnerLabels = 4;
  const stride = labelCandidates.length > maxInnerLabels ? Math.ceil(labelCandidates.length / maxInnerLabels) : 1;
  const innerLabels = labelCandidates.filter((_, idx) => idx % stride === 0).slice(0, maxInnerLabels);

  const timeLabels: TimeLabel[] = [
    { x: 0, label: formatClock(sessionStart, true), align: 'left' },
    ...innerLabels,
    { x: chartWidth, label: formatClock(sessionEnd, true), align: 'right' },
  ];

  return { bars, cycleLines, hourLines, timeLabels };
}

function StageLegend() {
  const order: SleepPhaseRow['stage'][] = ['awake', 'rem', 'light', 'deep'];

  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        marginBottom: 10,
        gap: 8,
      }}
    >
      {order.map((stage) => (
        <View key={stage} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: STAGE_GRADIENT[stage].top,
            }}
          />
          <Text style={{ color: LEGEND_TEXT, fontSize: 9 }}>{STAGE_LABEL[stage]}</Text>
        </View>
      ))}
    </View>
  );
}

function PhaseTooltip({
  bar,
  chartWidth,
}: {
  bar: BarGeometry;
  chartWidth: number;
}) {
  const tooltipWidth = 160;
  const tooltipHeight = 70;
  let left = bar.x + bar.width / 2 - tooltipWidth / 2;
  left = Math.max(0, Math.min(left, chartWidth - tooltipWidth));

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: -(tooltipHeight + 8),
        left,
        width: tooltipWidth,
        minHeight: tooltipHeight,
        backgroundColor: TOOLTIP_BG,
        borderWidth: 1,
        borderColor: TOOLTIP_BORDER,
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 8,
      }}
    >
      <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '600' }}>{STAGE_LABEL[bar.phase.stage]}</Text>
      <Text style={{ color: '#9CA3AF', fontSize: 10, marginTop: 2 }}>{bar.phase.duration_minutes} min</Text>
      <Text style={{ color: '#9CA3AF', fontSize: 10, marginTop: 2 }}>
        {formatTooltipClock(bar.phase.start_time)} - {formatTooltipClock(bar.phase.end_time)}
      </Text>
    </View>
  );
}

function HypnogramSkeleton({ chartWidth }: { chartWidth: number }) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.sin),
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.sin),
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [shimmer]);

  const opacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.12, 0.3],
  });

  const width = Math.max(1, chartWidth);
  const gapCount = SKELETON_BARS.filter((b) => b.cycleGapAfter).length;
  const totalFrac = SKELETON_BARS.reduce((sum, b) => sum + b.wFrac, 0);
  const scale = (width - gapCount * CYCLE_GAP) / (totalFrac * width);

  return (
    <View style={{ width, height: CHART_HEIGHT + AXIS_HEIGHT }}>
      <Animated.View style={{ opacity, flexDirection: 'row', height: CHART_HEIGHT, alignItems: 'flex-start' }}>
        {SKELETON_BARS.map((bar, idx) => {
          const w = Math.max(BAR_MIN_WIDTH, bar.wFrac * width * scale);
          const h = bar.depth * CHART_HEIGHT;
          return (
            <View
              key={`s-${idx}`}
              style={{
                width: w,
                height: h,
                marginRight: bar.cycleGapAfter ? CYCLE_GAP : BAR_GAP,
                borderRadius: CORNER_RADIUS,
                backgroundColor: '#1F2937',
              }}
            />
          );
        })}
      </Animated.View>
      <View style={{ height: 1, backgroundColor: AXIS_LINE }} />
    </View>
  );
}

function PremiumLockOverlay() {
  return (
    <View style={{ position: 'absolute', inset: 0 }} pointerEvents="none">
      <BlurView intensity={25} tint="dark" style={{ position: 'absolute', inset: 0 }} />
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Ionicons name="lock-closed" size={16} color="#FFFFFF" />
        <Text style={{ color: '#FFFFFF', marginTop: 6, fontWeight: '600' }}>Upgrade to Pro</Text>
        <Text style={{ color: AXIS_TEXT, marginTop: 2, fontSize: 12 }}>Unlock sleep stages</Text>
      </View>
    </View>
  );
}

export const SleepHypnogram = React.memo(function SleepHypnogram({
  phases,
  sessionStart,
  sessionEnd,
  isPremium,
  isLoading = false,
}: SleepHypnogramProps) {
  const [chartWidth, setChartWidth] = useState(0);
  const [selectedBar, setSelectedBar] = useState<BarGeometry | null>(null);

  const geometry = useMemo(
    () => computeGeometry(phases, sessionStart, sessionEnd, chartWidth),
    [phases, sessionStart, sessionEnd, chartWidth]
  );

  const maskY = useSharedValue(CHART_HEIGHT);
  const maskStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: maskY.value }],
  }));

  useEffect(() => {
    if (!phases.length || !chartWidth) {
      maskY.value = CHART_HEIGHT;
      return;
    }

    maskY.value = CHART_HEIGHT;
    maskY.value = withTiming(0, {
      duration: 1200,
      easing: ReanimatedEasing.out(ReanimatedEasing.cubic),
    });
  }, [phases, chartWidth, maskY]);

  const handleTouchMove = useCallback(
    (x: number) => {
      if (!isPremium) return;
      const hit = geometry.bars.find((bar) => x >= bar.x && x <= bar.x + bar.width);
      setSelectedBar(hit ?? null);
    },
    [geometry.bars, isPremium]
  );

  const clearSelection = useCallback(() => {
    setSelectedBar(null);
  }, []);

  const hasChart = phases.length > 0 && chartWidth > 0;

  return (
    <View
      style={{
        width: '100%',
        borderRadius: 26,
        backgroundColor: '#111827',
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 10,
      }}
      onLayout={(e) => setChartWidth(e.nativeEvent.layout.width - 32)}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ color: '#F9FAFB', fontSize: 48, fontWeight: '700', lineHeight: 52 }}>Sleep Stages</Text>
        <View
          style={{
            marginLeft: 12,
            width: 34,
            height: 34,
            borderRadius: 17,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255,255,255,0.7)',
          }}
        >
          <Ionicons name="information-circle" size={24} color="#111827" />
        </View>
      </View>

      <StageLegend />

      <View style={{ width: chartWidth, height: CHART_HEIGHT + AXIS_HEIGHT, alignSelf: 'center' }}>
        {isLoading ? <HypnogramSkeleton chartWidth={chartWidth} /> : null}

        {!isLoading && isPremium && !hasChart ? (
          <View style={{ height: CHART_HEIGHT + AXIS_HEIGHT, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: AXIS_TEXT, fontSize: 13 }}>Generating sleep timeline</Text>
          </View>
        ) : null}

        {!isLoading && !isPremium ? (
          <View style={{ height: CHART_HEIGHT + AXIS_HEIGHT }}>
            <Svg width={chartWidth} height={CHART_HEIGHT}>
              {Array.from({ length: 8 }).map((_, idx) => {
                const x = ((idx + 1) / 9) * chartWidth;
                return (
                  <Line
                    key={`lock-grid-${idx}`}
                    x1={x}
                    y1={0}
                    x2={x}
                    y2={CHART_HEIGHT}
                    stroke={GRID_LINE_COLOR}
                    strokeWidth={1}
                    strokeDasharray={CYCLE_LINE_DASH.join(' ')}
                  />
                );
              })}
              <Rect x={0} y={CHART_HEIGHT - 1} width={chartWidth} height={1} fill={AXIS_LINE} />
            </Svg>
            <PremiumLockOverlay />
          </View>
        ) : null}

        {!isLoading && isPremium && hasChart ? (
          <>
            <Svg width={chartWidth} height={CHART_HEIGHT}>
              <Defs>
                {(Object.keys(STAGE_GRADIENT) as (keyof typeof STAGE_GRADIENT)[]).map((stage) => (
                  <LinearGradient key={stage} id={`grad-${stage}`} x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={STAGE_GRADIENT[stage].top} stopOpacity="1" />
                    <Stop offset="1" stopColor={STAGE_GRADIENT[stage].bottom} stopOpacity="1" />
                  </LinearGradient>
                ))}
              </Defs>

              {geometry.hourLines.map((x, idx) => (
                <Line
                  key={`hour-${idx}`}
                  x1={x}
                  y1={0}
                  x2={x}
                  y2={CHART_HEIGHT}
                  stroke={GRID_LINE_COLOR}
                  strokeWidth={1}
                  strokeDasharray={CYCLE_LINE_DASH.join(' ')}
                />
              ))}

              {geometry.bars.map((bar) => (
                <Rect
                  key={bar.phase.id}
                  x={bar.x}
                  y={0}
                  width={bar.width}
                  height={bar.height}
                  rx={CORNER_RADIUS}
                  ry={CORNER_RADIUS}
                  fill={`url(#grad-${bar.phase.stage})`}
                  stroke={selectedBar?.phase.id === bar.phase.id ? SELECTED_STROKE : 'none'}
                  strokeWidth={selectedBar?.phase.id === bar.phase.id ? 1.5 : 0}
                />
              ))}

              {geometry.cycleLines.map((x, idx) => (
                <Line
                  key={`cycle-${idx}`}
                  x1={x}
                  y1={0}
                  x2={x}
                  y2={CHART_HEIGHT}
                  stroke={CYCLE_LINE}
                  strokeDasharray={CYCLE_LINE_DASH.join(' ')}
                  strokeWidth={1}
                />
              ))}

              <Rect x={0} y={CHART_HEIGHT - 1} width={chartWidth} height={1} fill={AXIS_LINE} />
            </Svg>

            <Reanimated.View
              style={[
                {
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: -CHART_HEIGHT,
                  height: CHART_HEIGHT,
                  backgroundColor: MASK_BG,
                },
                maskStyle,
              ]}
              pointerEvents="none"
            />

            <View
              style={{ position: 'absolute', left: 0, right: 0, top: 0, height: CHART_HEIGHT }}
              onStartShouldSetResponder={() => true}
              onResponderGrant={(e) => handleTouchMove(e.nativeEvent.locationX)}
              onResponderMove={(e) => handleTouchMove(e.nativeEvent.locationX)}
              onResponderRelease={clearSelection}
              onResponderTerminate={clearSelection}
            />

            {selectedBar ? <PhaseTooltip bar={selectedBar} chartWidth={chartWidth} /> : null}

            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: CHART_HEIGHT + 5,
                height: AXIS_HEIGHT - 5,
              }}
              pointerEvents="none"
            >
              {geometry.timeLabels.map((label, idx) => {
                const textAlign = label.align;
                const translateX = label.align === 'center' ? -16 : label.align === 'right' ? -32 : 0;
                return (
                  <Text
                    key={`label-${idx}`}
                    style={{
                      position: 'absolute',
                      left: label.x + translateX,
                      color: AXIS_TEXT,
                      fontSize: 10,
                      textAlign,
                      minWidth: label.align === 'center' ? 32 : 40,
                    }}
                  >
                    {label.label}
                  </Text>
                );
              })}
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
});
