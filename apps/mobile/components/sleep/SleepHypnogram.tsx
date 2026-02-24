import { BlurView } from 'expo-blur';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Dimensions, Text, TouchableWithoutFeedback, View } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Defs, Line, LinearGradient, Rect, Stop, Svg, Text as SvgText } from 'react-native-svg';
import type { SleepHypnogramData, SleepPhase, SleepStage } from '@project-delta/shared';

// --- Layout -----------------------------------------------------------------
const SVG_HEIGHT = 260;
const AXIS_H = 36; // reserved at bottom for time labels
const CHART_H = SVG_HEIGHT - AXIS_H; // 224 - the actual drawing area

// --- Stage vertical positions (y = top edge of rect, origin = top of SVG) --
// Visual order top->bottom: awake . core . light . deep
const STAGE_Y: Record<SleepStage, number> = {
  awake: 8, // thin awakening line near top
  core: 60, // upper-mid block
  light: 118, // mid block
  deep: 176, // bottom block
  rem: 60, // same row as core (REM shares upper-mid position)
};

const STAGE_H: Record<SleepStage, number> = {
  awake: 6, // intentionally thin - momentary arousals
  core: 50,
  light: 50,
  deep: 50,
  rem: 50,
};

// --- Colors -----------------------------------------------------------------
const STAGE_COLOR: Record<SleepStage, string> = {
  awake: '#f97316', // orange
  core: '#2dd4bf', // teal
  light: '#60a5fa', // periwinkle blue
  deep: '#9333ea', // vivid purple
  rem: '#2dd4bf', // teal (same as core)
};

// --- Gradient IDs for transition wicks --------------------------------------
// Pre-define all stage-pair gradients so SVG <Defs> is static
const STAGE_PAIRS: [SleepStage, SleepStage][] = [
  ['awake', 'core'],
  ['awake', 'light'],
  ['awake', 'deep'],
  ['core', 'light'],
  ['core', 'deep'],
  ['core', 'awake'],
  ['light', 'deep'],
  ['light', 'core'],
  ['light', 'awake'],
  ['deep', 'core'],
  ['deep', 'light'],
  ['deep', 'awake'],
  ['rem', 'light'],
  ['rem', 'deep'],
  ['rem', 'awake'],
];
function gradId(a: SleepStage, b: SleepStage) {
  return `wick-${a}-${b}`;
}

/** Convert absolute minute-from-midnight to SVG x coordinate */
function minToX(absoluteMin: number, onsetMin: number, totalMin: number, svgW: number): number {
  return ((absoluteMin - onsetMin) / totalMin) * svgW;
}

/** Convert a duration in minutes to SVG width - minimum 5px so short phases are visible */
function minToW(durationMin: number, totalMin: number, svgW: number): number {
  return Math.max(5, (durationMin / totalMin) * svgW);
}

/** Format absolute minutes-from-midnight as HH:MM */
function fmtMin(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** Format absolute minutes-from-midnight as "H AM/PM" for axis labels */
function fmtAxisHour(m: number): string {
  const h = Math.floor(m / 60) % 24;
  return h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;
}

interface SleepHypnogramProps {
  data: SleepHypnogramData;
  isPaidPlan: boolean;
  isLoading?: boolean;
  /** Defaults to full screen width. Pass explicit value if inside a constrained container. */
  width?: number;
}

const SleepHypnogram = React.memo(function SleepHypnogram({
  data,
  isPaidPlan,
  isLoading = false,
  width: widthProp,
}: SleepHypnogramProps) {
  // --- Dimensions -----------------------------------------------------------
  // CRITICAL: svgW must be resolved at render time. Never use 0 as default.
  const screenW = Dimensions.get('window').width;
  const svgW = widthProp ?? screenW;
  const totalMin = data.wakeMin - data.sleepOnsetMin; // e.g. 490 minutes

  // --- Tooltip state --------------------------------------------------------
  const [active, setActive] = useState<SleepPhase | null>(null);

  // --- Internal lifecycle guard --------------------------------------------
  const mountedRef = useRef(false);
  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // --- Skeleton animation ---------------------------------------------------
  const skeletonOpacity = useSharedValue(0.4);
  React.useEffect(() => {
    if (isLoading) {
      skeletonOpacity.value = withRepeat(withTiming(0.8, { duration: 800 }), -1, true);
    } else {
      skeletonOpacity.value = 1;
    }
  }, [isLoading, skeletonOpacity]);
  const skeletonStyle = useAnimatedStyle(() => ({ opacity: skeletonOpacity.value }));

  // --- Memoised: cycle boundary lines --------------------------------------
  const cycleBoundaries = useMemo(() => {
    const lines: React.ReactNode[] = [];
    data.phases.forEach((phase, i) => {
      if (i === 0) return;
      if (phase.cycleNumber !== data.phases[i - 1].cycleNumber) {
        const x = minToX(phase.startMin, data.sleepOnsetMin, totalMin, svgW);
        lines.push(
          <Line
            key={`cb-${i}`}
            x1={x}
            x2={x}
            y1={0}
            y2={CHART_H}
            stroke="#1f2937"
            strokeWidth={1}
            strokeDasharray="3,5"
          />
        );
      }
    });
    return lines;
  }, [data.phases, data.sleepOnsetMin, totalMin, svgW]);

  // --- Memoised: connector wicks between consecutive blocks -----------------
  // A wick is a vertical line connecting the BOTTOM EDGE of the previous block
  // to the TOP EDGE of the next block. It must NOT span the full chart height.
  const wicks = useMemo(() => {
    const lines: React.ReactNode[] = [];
    for (let i = 0; i < data.phases.length - 1; i += 1) {
      const curr = data.phases[i];
      const next = data.phases[i + 1];
      // x is the meeting point: end of current block = start of next block
      const x = minToX(curr.startMin + curr.durationMin, data.sleepOnsetMin, totalMin, svgW);
      // y1 = bottom of current block
      const y1 = STAGE_Y[curr.stage] + STAGE_H[curr.stage];
      // y2 = top of next block
      const y2 = STAGE_Y[next.stage];
      // Only draw wick if there's actually a vertical gap between the blocks
      if (Math.abs(y2 - y1) < 2) continue;
      lines.push(
        <Line
          key={`wick-${i}`}
          x1={x}
          x2={x}
          y1={Math.min(y1, y2)}
          y2={Math.max(y1, y2)}
          stroke={`url(#${gradId(curr.stage, next.stage)})`}
          strokeWidth={1.5}
        />
      );
    }
    return lines;
  }, [data.phases, data.sleepOnsetMin, totalMin, svgW]);

  // --- Memoised: phase rect blocks -----------------------------------------
  const phaseRects = useMemo(() => {
    return data.phases.map((phase, i) => {
      const x = minToX(phase.startMin, data.sleepOnsetMin, totalMin, svgW);
      const w = minToW(phase.durationMin, totalMin, svgW);
      const y = STAGE_Y[phase.stage];
      const h = STAGE_H[phase.stage];
      return (
        <Rect
          key={`phase-${i}`}
          x={x}
          y={y}
          width={w}
          height={h}
          rx={4}
          ry={4}
          fill={STAGE_COLOR[phase.stage]}
          onPress={() => setActive(phase)}
        />
      );
    });
  }, [data.phases, data.sleepOnsetMin, totalMin, svgW]);

  // --- Memoised: time axis labels ------------------------------------------
  const axisLabels = useMemo(() => {
    const labels: React.ReactNode[] = [];
    // Find first whole hour at or after sleepOnsetMin
    const firstHour = Math.ceil(data.sleepOnsetMin / 60) * 60;
    for (let m = firstHour; m <= data.wakeMin; m += 60) {
      const x = minToX(m, data.sleepOnsetMin, totalMin, svgW);
      labels.push(
        <SvgText
          key={`axis-${m}`}
          x={x}
          y={CHART_H + 22}
          fill="#4b5563"
          fontSize={11}
          fontWeight="500"
          textAnchor="middle">
          {fmtAxisHour(m)}
        </SvgText>
      );
    }
    return labels;
  }, [data.sleepOnsetMin, data.wakeMin, totalMin, svgW]);

  // --- Tooltip position (clamped to screen edges) ---------------------------
  const TOOLTIP_W = 156;
  const TOOLTIP_H = 76;
  const tooltipPos = useMemo(() => {
    if (!active) return { left: 0, top: 0 };
    const centerX = minToX(
      active.startMin + active.durationMin / 2,
      data.sleepOnsetMin,
      totalMin,
      svgW
    );
    const rawLeft = centerX - TOOLTIP_W / 2;
    const left = Math.max(8, Math.min(rawLeft, svgW - TOOLTIP_W - 8));
    const blockTop = STAGE_Y[active.stage];
    const rawTop = blockTop - TOOLTIP_H - 10;
    const top = Math.max(8, rawTop);
    return { left, top };
  }, [active, data.sleepOnsetMin, totalMin, svgW]);

  // --- Skeleton rects -------------------------------------------------------
  const SKELETON_RECTS = [
    { x: svgW * 0.05, y: STAGE_Y.deep, w: svgW * 0.18, h: STAGE_H.deep },
    { x: svgW * 0.1, y: STAGE_Y.light, w: svgW * 0.12, h: STAGE_H.light },
    { x: svgW * 0.28, y: STAGE_Y.deep, w: svgW * 0.2, h: STAGE_H.deep },
    { x: svgW * 0.3, y: STAGE_Y.core, w: svgW * 0.14, h: STAGE_H.core },
    { x: svgW * 0.55, y: STAGE_Y.light, w: svgW * 0.22, h: STAGE_H.light },
    { x: svgW * 0.72, y: STAGE_Y.core, w: svgW * 0.16, h: STAGE_H.core },
  ];

  const clearActive = useCallback(() => {
    if (!mountedRef.current) {
      return;
    }
    setActive(null);
  }, []);

  // --- Render ---------------------------------------------------------------
  if (isLoading) {
    return (
      <Animated.View style={[{ width: svgW, height: SVG_HEIGHT }, skeletonStyle]}>
        <Svg width={svgW} height={SVG_HEIGHT}>
          {SKELETON_RECTS.map((r, i) => (
            <Rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} rx={4} ry={4} fill="#1f2937" />
          ))}
        </Svg>
      </Animated.View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={clearActive}>
      <View style={{ width: svgW, height: SVG_HEIGHT }}>
        {/* Main SVG chart */}
        <Svg width={svgW} height={SVG_HEIGHT}>
          {/* 1. Gradient defs for wicks */}
          <Defs>
            {STAGE_PAIRS.map(([a, b]) => (
              <LinearGradient key={gradId(a, b)} id={gradId(a, b)} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={STAGE_COLOR[a]} stopOpacity="1" />
                <Stop offset="1" stopColor={STAGE_COLOR[b]} stopOpacity="1" />
              </LinearGradient>
            ))}
          </Defs>

          {/* 2. Cycle boundary dashed lines (behind everything) */}
          {cycleBoundaries}

          {/* 3. Connector wicks (behind blocks) */}
          {wicks}

          {/* 4. Phase blocks (on top) */}
          {phaseRects}

          {/* 5. Time axis labels */}
          {axisLabels}
        </Svg>

        {/* Tooltip - absolutely positioned RN View over SVG */}
        {active && (
          <Animated.View
            entering={FadeIn.duration(150)}
            style={{
              position: 'absolute',
              left: tooltipPos.left,
              top: tooltipPos.top,
              width: TOOLTIP_W,
              pointerEvents: 'none',
            }}
            className="rounded-2xl border border-white/10 bg-[#111827] p-3 shadow-2xl">
            <Text className="text-sm font-semibold" style={{ color: STAGE_COLOR[active.stage] }}>
              {active.stage.charAt(0).toUpperCase() + active.stage.slice(1)}
            </Text>
            <Text className="mt-0.5 text-xs text-gray-400">
              {fmtMin(active.startMin)} - {fmtMin(active.startMin + active.durationMin)}
            </Text>
            <Text className="mt-1 text-xs text-gray-500">
              {active.durationMin}m . {active.confidence}
            </Text>
          </Animated.View>
        )}

        {/* Premium lock overlay */}
        {!isPaidPlan && (
          <View
            style={{ position: 'absolute', top: 0, left: 0, width: svgW, height: SVG_HEIGHT }}
            className="items-center justify-center">
            {/* Use expo-blur BlurView if available, otherwise dark overlay */}
            <BlurView
              intensity={18}
              tint="dark"
              style={{ position: 'absolute', top: 0, left: 0, width: svgW, height: SVG_HEIGHT }}
            />
            <Text className="mb-2 text-2xl text-white">🔒</Text>
            <Text className="px-8 text-center text-xs text-white">
              Upgrade to view sleep stages
            </Text>
          </View>
        )}
      </View>
    </TouchableWithoutFeedback>
  );
});

export default SleepHypnogram;
