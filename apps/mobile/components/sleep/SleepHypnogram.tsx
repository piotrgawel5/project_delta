import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import Svg, { Defs, Line, LinearGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

const CHART_HEIGHT = 160;
const AXIS_HEIGHT = 32;
const BAR_GAP = 1.5;
const MIN_BAR_WIDTH = 2;
const CORNER_RADIUS = 3;

const STAGE_HEIGHT_RATIO: Record<string, number> = {
  awake: 0.1,
  light: 0.4,
  rem: 0.72,
  deep: 1.0,
};

const STAGE_GRADIENT: Record<string, { top: string; bottom: string }> = {
  deep: { top: '#8B5CF6', bottom: '#4C1D95' },
  light: { top: '#3B82F6', bottom: '#1E3A8A' },
  rem: { top: '#06B6D4', bottom: '#0E4C61' },
  awake: { top: '#F97316', bottom: '#7C2D12' },
};

const CARD_BG = '#0F0F0F';
const AXIS_LINE_COLOR = '#2D2D2D';
const CYCLE_LINE_COLOR = 'rgba(255,255,255,0.15)';
const CYCLE_LINE_DASH = [3, 5];
const TIME_LABEL_COLOR = '#6B7280';
const SELECTED_RING = 'rgba(255,255,255,0.35)';
const SKELETON_BARS: { wFrac: number; hFrac: number; cycleGapAfter?: boolean }[] = [
  { wFrac: 0.05, hFrac: 0.1 },
  { wFrac: 0.04, hFrac: 0.42 },
  { wFrac: 0.07, hFrac: 0.42 },
  { wFrac: 0.06, hFrac: 1.0 },
  { wFrac: 0.08, hFrac: 1.0 },
  { wFrac: 0.07, hFrac: 1.0 },
  { wFrac: 0.06, hFrac: 0.72 },
  { wFrac: 0.05, hFrac: 0.42 },
  { wFrac: 0.04, hFrac: 0.1 },
  { wFrac: 0.03, hFrac: 0.1, cycleGapAfter: true },
  { wFrac: 0.05, hFrac: 0.42 },
  { wFrac: 0.06, hFrac: 0.42 },
  { wFrac: 0.07, hFrac: 0.72 },
  { wFrac: 0.08, hFrac: 1.0 },
  { wFrac: 0.07, hFrac: 0.72 },
  { wFrac: 0.09, hFrac: 0.72 },
  { wFrac: 0.06, hFrac: 0.42 },
  { wFrac: 0.04, hFrac: 0.1, cycleGapAfter: true },
  { wFrac: 0.06, hFrac: 0.42 },
  { wFrac: 0.08, hFrac: 0.72 },
  { wFrac: 0.1, hFrac: 0.72 },
  { wFrac: 0.09, hFrac: 0.72 },
  { wFrac: 0.07, hFrac: 0.42 },
  { wFrac: 0.04, hFrac: 0.1, cycleGapAfter: true },
  { wFrac: 0.07, hFrac: 0.72 },
  { wFrac: 0.09, hFrac: 0.72 },
  { wFrac: 0.08, hFrac: 0.72 },
  { wFrac: 0.05, hFrac: 0.1 },
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
  timeLabels: { x: number; label: string }[];
  totalDurationMinutes: number;
}

function computeGeometry(
  phases: SleepPhaseRow[],
  sessionStart: string,
  sessionEnd: string,
  chartWidth: number
): ChartGeometry {
  if (!sessionStart || !sessionEnd || phases.length === 0 || chartWidth === 0) {
    return { bars: [], cycleLines: [], timeLabels: [], totalDurationMinutes: 0 };
  }

  const sessionStartMs = new Date(sessionStart).getTime();
  const sessionEndMs = new Date(sessionEnd).getTime();
  if (Number.isNaN(sessionStartMs) || Number.isNaN(sessionEndMs)) {
    return { bars: [], cycleLines: [], timeLabels: [], totalDurationMinutes: 0 };
  }
  const totalMs = sessionEndMs - sessionStartMs;
  if (totalMs <= 0) {
    return { bars: [], cycleLines: [], timeLabels: [], totalDurationMinutes: 0 };
  }

  const totalMinutes = totalMs / 60_000;
  const msToX = (ms: number) => ((ms - sessionStartMs) / totalMs) * chartWidth;

  const bars: BarGeometry[] = phases.map((phase) => {
    const phaseStartMs = new Date(phase.start_time).getTime();
    const phaseEndMs = new Date(phase.end_time).getTime();
    const x = msToX(phaseStartMs);
    const rawW = msToX(phaseEndMs) - x - BAR_GAP;
    const width = Math.max(MIN_BAR_WIDTH, rawW);
    const height = (STAGE_HEIGHT_RATIO[phase.stage] ?? 0.15) * CHART_HEIGHT;

    return {
      x,
      y: CHART_HEIGHT - height,
      width,
      height,
      phase,
      gradientId: `grad_${phase.stage}`,
    };
  });

  const cycleLines: CycleLine[] = [];
  for (let i = 1; i < phases.length; i += 1) {
    if (phases[i].cycle_number !== phases[i - 1].cycle_number && phases[i].cycle_number > 0) {
      cycleLines.push({ x: bars[i].x - BAR_GAP / 2 });
    }
  }

  const timeLabels: { x: number; label: string }[] = [];
  const fmt = (ms: number) => {
    const d = new Date(ms);
    const h = d.getHours();
    const suffix = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}${suffix}`;
  };

  timeLabels.push({ x: 0, label: fmt(sessionStartMs) });

  const firstHourMs = Math.ceil(sessionStartMs / 3_600_000) * 3_600_000;
  for (let ms = firstHourMs; ms < sessionEndMs - 3_600_000 * 0.5; ms += 3_600_000) {
    const x = msToX(ms);
    if (x > chartWidth * 0.08 && x < chartWidth * 0.92) {
      timeLabels.push({ x, label: fmt(ms) });
    }
    if (timeLabels.length >= 5) break;
  }

  timeLabels.push({ x: chartWidth, label: fmt(sessionEndMs) });

  return { bars, cycleLines, timeLabels, totalDurationMinutes: totalMinutes };
}

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
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
        elevation: 8,
      }}
      pointerEvents="none"
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: color,
            marginRight: 5,
          }}
        />
        <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '600' }}>
          {STAGE_LABEL[bar.phase.stage]}
        </Text>
      </View>
      <Text style={{ color: '#9CA3AF', fontSize: 10 }}>
        {formatHM(bar.phase.start_time)} - {formatHM(bar.phase.end_time)}
      </Text>
      <Text style={{ color: '#6B7280', fontSize: 10, marginTop: 2 }}>{bar.phase.duration_minutes} min</Text>
    </View>
  );
}

function HypnogramSkeleton({ chartWidth }: { chartWidth: number }) {
  const shimmer = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.sin),
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 1400,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.sin),
        }),
      ])
    );
    const pulseAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.quad),
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.quad),
        }),
      ])
    );

    shimAnim.start();
    pulseAnim.start();
    return () => {
      shimAnim.stop();
      pulseAnim.stop();
    };
  }, [pulse, shimmer]);

  const barOpacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.07, 0.18],
  });
  const dotOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 1.0],
  });
  const effectiveChartWidth = Math.max(chartWidth, 1);
  const gapCount = SKELETON_BARS.filter((b) => b.cycleGapAfter).length;
  const totalFrac = SKELETON_BARS.reduce((sum, bar) => sum + bar.wFrac, 0);
  const scale = (effectiveChartWidth - gapCount * 12) / (totalFrac * effectiveChartWidth);

  return (
    <View style={{ width: effectiveChartWidth, height: CHART_HEIGHT + 32 }}>
      <Animated.View
        style={{
          opacity: barOpacity,
          flexDirection: 'row',
          alignItems: 'flex-end',
          height: CHART_HEIGHT,
          overflow: 'hidden',
        }}
      >
        {SKELETON_BARS.map((bar, idx) => {
          const barW = Math.max(3, bar.wFrac * effectiveChartWidth * scale);
          const barH = bar.hFrac * CHART_HEIGHT;
          return (
            <View
              key={`sk-${idx}`}
              style={{
                width: barW,
                height: barH,
                borderRadius: 3,
                backgroundColor: '#FFFFFF',
                marginRight: bar.cycleGapAfter ? 14 : 2,
              }}
            />
          );
        })}
      </Animated.View>
      <View style={{ height: 1, backgroundColor: '#1F2937', width: effectiveChartWidth }} />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-end',
          marginTop: 7,
          gap: 5,
          paddingRight: 2,
        }}
      >
        <Animated.View
          style={{
            opacity: dotOpacity,
            width: 5,
            height: 5,
            borderRadius: 2.5,
            backgroundColor: '#4B5563',
          }}
        />
        <Text style={{ color: '#4B5563', fontSize: 10, letterSpacing: 0.3 }}>
          Estimating sleep stages
        </Text>
      </View>
    </View>
  );
}

function EmptyPremiumChart({ chartWidth }: { chartWidth: number }) {
  return (
    <View style={{ height: CHART_HEIGHT + AXIS_HEIGHT }}>
      <Svg width={chartWidth} height={CHART_HEIGHT + AXIS_HEIGHT}>
        <Line x1={0} y1={CHART_HEIGHT} x2={chartWidth} y2={CHART_HEIGHT} stroke={AXIS_LINE_COLOR} strokeWidth={1} />
      </Svg>
      <PremiumLockOverlay />
    </View>
  );
}

function ChartContent({
  chartWidth,
  geometry,
  selectedBar,
  isPremium,
  maskStyle,
  handleTouchMove,
  clearSelection,
}: {
  chartWidth: number;
  geometry: ChartGeometry;
  selectedBar: BarGeometry | null;
  isPremium: boolean;
  maskStyle: any;
  handleTouchMove: (x: number) => void;
  clearSelection: () => void;
}) {
  const totalH = CHART_HEIGHT + AXIS_HEIGHT;

  return (
    <>
      <Svg width={chartWidth} height={totalH}>
        <Defs>
          {Object.entries(STAGE_GRADIENT).map(([stage, colors]) => (
            <LinearGradient key={stage} id={`grad_${stage}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.top} stopOpacity="1" />
              <Stop offset="1" stopColor={colors.bottom} stopOpacity="0.85" />
            </LinearGradient>
          ))}
        </Defs>

        {geometry.cycleLines.map((cl, i) => (
          <Line
            key={`cl-${i}`}
            x1={cl.x}
            y1={0}
            x2={cl.x}
            y2={CHART_HEIGHT}
            stroke={CYCLE_LINE_COLOR}
            strokeWidth={1}
            strokeDasharray={CYCLE_LINE_DASH.join(',')}
          />
        ))}

        {geometry.bars.map((bar) => (
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

        <Line x1={0} y1={CHART_HEIGHT} x2={chartWidth} y2={CHART_HEIGHT} stroke={AXIS_LINE_COLOR} strokeWidth={1} />

        {geometry.timeLabels.map((tl, i) => {
          const anchor = i === 0 ? 'start' : i === geometry.timeLabels.length - 1 ? 'end' : 'middle';
          return (
            <SvgText
              key={`tl-${i}`}
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

      <Reanimated.View
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

      {selectedBar && isPremium && <PhaseTooltip bar={selectedBar} chartWidth={chartWidth} />}
      {!isPremium && <PremiumLockOverlay />}
    </>
  );
}

function PremiumLockOverlay() {
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
      <BlurView intensity={30} tint="dark" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="lock-closed" size={16} color="#FFFFFF" />
        <Text style={{ color: '#FFFFFF', fontWeight: '600', marginTop: 6 }}>Upgrade to Pro</Text>
        <Text style={{ color: '#6B7280', marginTop: 2, fontSize: 12 }}>Unlock sleep timeline</Text>
      </View>
    </View>
  );
}

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
          <View
            style={{
              width: 7,
              height: 7,
              borderRadius: 2,
              backgroundColor: STAGE_GRADIENT[stage].top,
            }}
          />
          <Text style={{ color: '#9CA3AF', fontSize: 10 }}>{label}</Text>
        </View>
      ))}
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

  const geometry = useMemo(
    () => computeGeometry(phases, sessionStart, sessionEnd, chartWidth),
    [phases, sessionStart, sessionEnd, chartWidth]
  );

  const maskY = useSharedValue(CHART_HEIGHT + AXIS_HEIGHT);
  const maskStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: maskY.value }],
  }));

  useEffect(() => {
    if (phases.length > 0 && chartWidth > 0) {
      maskY.value = CHART_HEIGHT + AXIS_HEIGHT;
      maskY.value = withSpring(0, { damping: 22, stiffness: 80, mass: 0.8 });
    }
  }, [phases, chartWidth, maskY]);

  const [selectedBar, setSelectedBar] = useState<BarGeometry | null>(null);

  const handleTouchMove = useCallback(
    (x: number) => {
      if (!isPremium) return;
      const hit = geometry.bars.find((b) => x >= b.x && x <= b.x + b.width + BAR_GAP);
      setSelectedBar(hit ?? null);
    },
    [geometry.bars, isPremium]
  );

  const clearSelection = useCallback(() => setSelectedBar(null), []);
  const totalH = CHART_HEIGHT + AXIS_HEIGHT;
  const resolvedChartWidth = Math.max(chartWidth, 0);

  return (
    <View style={{ width: '100%' }} onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}>
      <StageLegend />

      <View style={{ height: totalH }}>
        {isLoading && <HypnogramSkeleton chartWidth={resolvedChartWidth} />}
        {!isLoading && (!phases || phases.length === 0) && !isPremium && (
          <EmptyPremiumChart chartWidth={resolvedChartWidth} />
        )}
        {!isLoading && (!phases || phases.length === 0) && isPremium && (
          <HypnogramSkeleton chartWidth={resolvedChartWidth} />
        )}
        {!isLoading && phases && phases.length > 0 && (
          <ChartContent
            chartWidth={resolvedChartWidth}
            geometry={geometry}
            selectedBar={selectedBar}
            isPremium={isPremium}
            maskStyle={maskStyle}
            handleTouchMove={handleTouchMove}
            clearSelection={clearSelection}
          />
        )}
      </View>
    </View>
  );
});
