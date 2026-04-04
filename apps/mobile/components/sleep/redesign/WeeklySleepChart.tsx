import { useEffect, useMemo, useRef } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Path,
  Stop,
} from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { SLEEP_FONTS, SLEEP_LAYOUT, SLEEP_THEME } from '@constants';
import type { ChartPoint, WeeklySleepChartProps } from '../../../types/sleep-ui';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Evaluates a cubic bezier at parameter t. Runs as a UI-thread worklet. */
function cubicBezierPoint(t: number, p0: number, cp1v: number, cp2v: number, p1: number): number {
  'worklet';
  const mt = 1 - t;
  return mt * mt * mt * p0 + 3 * mt * mt * t * cp1v + 3 * mt * t * t * cp2v + t * t * t * p1;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MAX_MINUTES = 10 * 60;
const LABEL_WIDTH = 14;
const LABEL_ROW_HEIGHT = 12;
const SVG_HEIGHT = SLEEP_LAYOUT.chartHeight - LABEL_ROW_HEIGHT;
const PLOT_TOP = 10;
const PLOT_BOTTOM = 20;
const CURVE_TENSION = 0.48;
const MIN_TEMPLATE_RATIO = 0.12;
const MAX_TEMPLATE_RATIO = 0.86;
const TODAY_PILL_HALF_WIDTH = 38;
const TODAY_PILL_MIN_LEFT = 10;
const TODAY_PILL_HEIGHT = 30;
const BLEND_REAL_WEIGHT = 0.55;
const BLEND_PROFILE_WEIGHT = 0.45;
const SMOOTH_PREV_WEIGHT = 0.15;
const SMOOTH_SELF_WEIGHT = 0.7;
const SMOOTH_NEXT_WEIGHT = 0.15;
const WAVE_PROFILE = [0.42, 0.72, 0.39, 0.18, 0.52, 0.75, 0.58] as const;

type ChartRenderPoint = ChartPoint & { isMissing: boolean };

function clampRatio(value: number): number {
  return Math.max(MIN_TEMPLATE_RATIO, Math.min(MAX_TEMPLATE_RATIO, value));
}

function clampY(y: number, topY: number, bottomY: number): number {
  return Math.max(topY, Math.min(bottomY, y));
}

function resolveAnchorIndex(rawRatios: readonly (number | null)[]): number {
  for (let i = rawRatios.length - 1; i >= 0; i -= 1) {
    if (typeof rawRatios[i] === 'number') return i;
  }
  return rawRatios.length - 1;
}

function buildDisplayRatios(rawRatios: readonly (number | null)[]) {
  const anchorIndex = resolveAnchorIndex(rawRatios);
  const anchorRatio = (rawRatios[anchorIndex] as number) ?? WAVE_PROFILE[anchorIndex];
  const profileShift = anchorRatio - WAVE_PROFILE[anchorIndex];
  const anchoredProfile = WAVE_PROFILE.map((ratio) => clampRatio(ratio + profileShift));

  const blended = rawRatios.map((ratio, index) =>
    clampRatio(
      typeof ratio === 'number'
        ? ratio * BLEND_REAL_WEIGHT + anchoredProfile[index] * BLEND_PROFILE_WEIGHT
        : anchoredProfile[index]
    )
  );

  const smoothed = blended.map((ratio, index) => {
    const prev = blended[Math.max(0, index - 1)];
    const next = blended[Math.min(blended.length - 1, index + 1)];
    return clampRatio(
      prev * SMOOTH_PREV_WEIGHT + ratio * SMOOTH_SELF_WEIGHT + next * SMOOTH_NEXT_WEIGHT
    );
  });

  const missingMask = rawRatios.map((ratio) => typeof ratio !== 'number');
  return { ratios: smoothed, missingMask };
}

function buildSegmentPath(points: readonly ChartPoint[], index: number, tension = CURVE_TENSION): string {
  const previous = points[Math.max(0, index - 1)];
  const current = points[index];
  const next = points[index + 1];
  const afterNext = points[Math.min(points.length - 1, index + 2)];

  const cp1x = current.x + ((next.x - previous.x) * tension) / 2;
  const cp1y = current.y + ((next.y - previous.y) * tension) / 2;
  const cp2x = next.x - ((afterNext.x - current.x) * tension) / 2;
  const cp2y = next.y - ((afterNext.y - current.y) * tension) / 2;

  return `M ${current.x} ${current.y} C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${next.x} ${next.y}`;
}

function buildAreaPath(points: readonly ChartPoint[], bottomY: number): string {
  if (points.length < 2) return '';

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const segmentPath = buildSegmentPath(points, index, CURVE_TENSION);
    const curveCommand = segmentPath
      .replace(`M ${current.x} ${current.y} `, '')
      .replace(` ${next.x} ${next.y}`, ` ${next.x} ${next.y}`);
    path += ` ${curveCommand}`;
  }

  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  return `${path} L ${lastPoint.x} ${bottomY} L ${firstPoint.x} ${bottomY} Z`;
}

function buildEdgePoint(
  pointA: ChartPoint,
  pointB: ChartPoint,
  edgeX: number,
  topY: number,
  bottomY: number
): ChartRenderPoint {
  const denominator = pointB.x - pointA.x || 1;
  const slope = (pointB.y - pointA.y) / denominator;
  const y = clampY(pointA.y + slope * (edgeX - pointA.x), topY, bottomY);

  return {
    x: edgeX,
    y,
    hasData: false,
    isMissing: true,
  };
}

function formatMinutesLabel(minutes: number): string {
  const clamped = Math.max(0, Math.round(minutes));
  const hours = Math.floor(clamped / 60);
  const mins = clamped % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}

export default function WeeklySleepChart({ data, todayIndex }: WeeklySleepChartProps) {
  const paddingHorizontal = SLEEP_LAYOUT.screenPaddingH - 2;
  const chartWidth = SCREEN_WIDTH;
  const dayStartX = paddingHorizontal;
  const dayEndX = chartWidth - paddingHorizontal;
  const dayStepX = (dayEndX - dayStartX) / Math.max(1, DAY_LABELS.length - 1);
  const plotHeight = SVG_HEIGHT - PLOT_TOP - PLOT_BOTTOM;
  const bottomY = PLOT_TOP + plotHeight;

  const chart = useMemo(() => {
    const rawRatios = data.map((minutes) =>
      typeof minutes === 'number' ? Math.max(0, Math.min(MAX_MINUTES, minutes)) / MAX_MINUTES : null
    );
    const { ratios: displayRatios, missingMask } = buildDisplayRatios(rawRatios);

    const dayPoints: ChartRenderPoint[] = displayRatios.map((ratio, index) => ({
      x: dayStartX + index * dayStepX,
      y: bottomY - ratio * plotHeight,
      hasData: !missingMask[index],
      isMissing: missingMask[index],
    }));

    const leftEdgePoint = buildEdgePoint(dayPoints[0], dayPoints[1], 0, PLOT_TOP, bottomY);
    const rightEdgePoint = buildEdgePoint(
      dayPoints[DAY_LABELS.length - 1],
      dayPoints[DAY_LABELS.length - 2],
      chartWidth,
      PLOT_TOP,
      bottomY
    );

    const pathPoints: ChartRenderPoint[] = [leftEdgePoint, ...dayPoints, rightEdgePoint];

    const segments = pathPoints.slice(0, -1).map((_, segmentIndex) => {
      const path = buildSegmentPath(pathPoints, segmentIndex);

      let dashed = false;
      if (segmentIndex === 0) {
        dashed = dayPoints[0].isMissing;
      } else if (segmentIndex === pathPoints.length - 2) {
        dashed = dayPoints[DAY_LABELS.length - 1].isMissing;
      } else {
        const leftDay = dayPoints[segmentIndex - 1];
        const rightDay = dayPoints[segmentIndex];
        dashed = leftDay.isMissing || rightDay.isMissing;
      }

      return { path, dashed };
    });

    const todayMinutes =
      typeof data[todayIndex] === 'number'
        ? Math.max(0, Math.min(MAX_MINUTES, data[todayIndex] as number))
        : Math.round(displayRatios[todayIndex] * MAX_MINUTES);

    return {
      dayPoints,
      segments,
      areaPath: buildAreaPath(pathPoints, bottomY),
      todayPoint: dayPoints[todayIndex] ?? null,
      todayLabel: formatMinutesLabel(todayMinutes),
    };
  }, [bottomY, chartWidth, data, dayStartX, dayStepX, plotHeight, todayIndex]);

  // ── Animated dot / pill ──────────────────────────────────────────────────
  // SharedValues are initialised to the current day's position so the dot
  // appears correctly on the first frame without waiting for useEffect.
  const initPt = chart.dayPoints[todayIndex];
  const animProgress = useSharedValue(1);
  const dotFromX = useSharedValue(initPt?.x ?? 0);
  const dotFromY = useSharedValue(initPt?.y ?? 0);
  const dotToX   = useSharedValue(initPt?.x ?? 0);
  const dotToY   = useSharedValue(initPt?.y ?? 0);
  const cp1x = useSharedValue(initPt?.x ?? 0);
  const cp1y = useSharedValue(initPt?.y ?? 0);
  const cp2x = useSharedValue(initPt?.x ?? 0);
  const cp2y = useSharedValue(initPt?.y ?? 0);

  const prevTodayIndexRef = useRef(todayIndex);

  useEffect(() => {
    const prevIndex = prevTodayIndexRef.current;
    prevTodayIndexRef.current = todayIndex;

    const { dayPoints } = chart;
    const toPoint = dayPoints[todayIndex];
    if (!toPoint) return;

    if (prevIndex === todayIndex) {
      // Data changed without day change — snap dot to new position.
      dotFromX.value = toPoint.x; dotFromY.value = toPoint.y;
      dotToX.value   = toPoint.x; dotToY.value   = toPoint.y;
      cp1x.value = toPoint.x;     cp1y.value = toPoint.y;
      cp2x.value = toPoint.x;     cp2y.value = toPoint.y;
      animProgress.value = 1;
      return;
    }

    const fromPoint = dayPoints[prevIndex];
    if (!fromPoint) return;

    // Compute the cubic bezier for the segment between the two day points,
    // using the same Catmull-Rom-style formula as buildSegmentPath.
    const goingRight = todayIndex > prevIndex;
    const minIdx = Math.min(prevIndex, todayIndex);
    const maxIdx = Math.max(prevIndex, todayIndex);
    const pPrev  = dayPoints[Math.max(0, minIdx - 1)] ?? dayPoints[minIdx];
    const pFrom  = dayPoints[minIdx];
    const pTo    = dayPoints[maxIdx];
    const pAfter = dayPoints[Math.min(dayPoints.length - 1, maxIdx + 1)] ?? dayPoints[maxIdx];

    const fwdCp1x = pFrom.x + ((pTo.x - pPrev.x)  * CURVE_TENSION) / 2;
    const fwdCp1y = pFrom.y + ((pTo.y - pPrev.y)  * CURVE_TENSION) / 2;
    const fwdCp2x = pTo.x   - ((pAfter.x - pFrom.x) * CURVE_TENSION) / 2;
    const fwdCp2y = pTo.y   - ((pAfter.y - pFrom.y) * CURVE_TENSION) / 2;

    dotFromX.value = fromPoint.x;
    dotFromY.value = fromPoint.y;
    dotToX.value   = toPoint.x;
    dotToY.value   = toPoint.y;

    if (goingRight) {
      cp1x.value = fwdCp1x; cp1y.value = fwdCp1y;
      cp2x.value = fwdCp2x; cp2y.value = fwdCp2y;
    } else {
      // Reverse the bezier by swapping control points.
      cp1x.value = fwdCp2x; cp1y.value = fwdCp2y;
      cp2x.value = fwdCp1x; cp2y.value = fwdCp1y;
    }

    animProgress.value = 0;
    animProgress.value = withDelay(
      300,
      withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) })
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayIndex, chart]); // SharedValues are stable — intentionally omitted from deps

  const dotAnimatedProps = useAnimatedProps(() => ({
    cx: cubicBezierPoint(animProgress.value, dotFromX.value, cp1x.value, cp2x.value, dotToX.value),
    cy: cubicBezierPoint(animProgress.value, dotFromY.value, cp1y.value, cp2y.value, dotToY.value),
  }));

  const glowAnimatedProps = useAnimatedProps(() => ({
    cx: cubicBezierPoint(animProgress.value, dotFromX.value, cp1x.value, cp2x.value, dotToX.value),
    cy: cubicBezierPoint(animProgress.value, dotFromY.value, cp1y.value, cp2y.value, dotToY.value),
  }));

  const pillAnimStyle = useAnimatedStyle(() => {
    const x = cubicBezierPoint(animProgress.value, dotFromX.value, cp1x.value, cp2x.value, dotToX.value);
    const y = cubicBezierPoint(animProgress.value, dotFromY.value, cp1y.value, cp2y.value, dotToY.value);
    return {
      left: Math.max(TODAY_PILL_MIN_LEFT, Math.min(chartWidth - TODAY_PILL_HALF_WIDTH * 2 - TODAY_PILL_MIN_LEFT, x - TODAY_PILL_HALF_WIDTH)),
      top: Math.min(SVG_HEIGHT - TODAY_PILL_HEIGHT - 2, y + 20),
    };
  });
  // ── Sliding day-label highlight ──────────────────────────────────────
  const highlightX = useSharedValue(dayStartX + todayIndex * dayStepX - LABEL_WIDTH / 2);

  useEffect(() => {
    highlightX.value = withTiming(dayStartX + todayIndex * dayStepX - LABEL_WIDTH / 2, {
      duration: 350,
      easing: Easing.out(Easing.cubic),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayIndex]); // dayStartX/dayStepX are derived from constants

  const highlightLabelStyle = useAnimatedStyle(() => ({
    left: highlightX.value,
  }));
  // ─────────────────────────────────────────────────────────────────────────


  return (
    <View style={styles.container}>
      <View style={styles.svgWrap}>
        <Svg width={chartWidth} height={SVG_HEIGHT}>
          <Defs>
            <SvgLinearGradient id="sleepAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor={SLEEP_THEME.chartLine} stopOpacity={0.24} />
              <Stop offset="40%" stopColor={SLEEP_THEME.chartLine} stopOpacity={0.14} />
              <Stop offset="78%" stopColor={SLEEP_THEME.chartLine} stopOpacity={0.04} />
              <Stop offset="100%" stopColor="#000000" stopOpacity={0} />
            </SvgLinearGradient>
          </Defs>

          {chart.areaPath ? <Path d={chart.areaPath} fill="url(#sleepAreaGradient)" /> : null}

          {chart.segments.map((segment, index) => (
            <Path
              key={index}
              d={segment.path}
              stroke={SLEEP_THEME.chartLine}
              strokeOpacity={segment.dashed ? 0.62 : 1}
              strokeWidth={segment.dashed ? 2.8 : 3.8}
              fill="none"
              strokeDasharray={segment.dashed ? '5 7' : undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {chart.dayPoints.map((point, index) => (
            <Circle key={index} cx={point.x} cy={point.y} r={4.8} fill="#3F4148" />
          ))}
          <AnimatedCircle r={12} fill="rgba(255,255,255,0.22)" animatedProps={glowAnimatedProps} />
          <AnimatedCircle r={5.5} fill="#FFFFFF" animatedProps={dotAnimatedProps} />
        </Svg>

        <Animated.View style={[styles.todayPill, pillAnimStyle]}>
          <Text style={styles.todayPillText}>{chart.todayLabel}</Text>
        </Animated.View>
      </View>

      <View style={styles.labelsRow}>
        {DAY_LABELS.map((label, index) => {
          const dayPoint = chart.dayPoints[index];
          const left = (dayPoint?.x ?? 0) - LABEL_WIDTH / 2;
          return (
            <Text
              key={`${label}-${index}`}
              style={[styles.label, { left }, styles.labelDefault]}>
              {label}
            </Text>
          );
        })}
        <Animated.Text style={[styles.label, styles.labelSelected, highlightLabelStyle]}>
          {DAY_LABELS[todayIndex]}
        </Animated.Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: SLEEP_LAYOUT.chartHeight,
  },
  svgWrap: {
    height: SVG_HEIGHT,
    position: 'relative',
  },
  todayPill: {
    position: 'absolute',
    minWidth: TODAY_PILL_HALF_WIDTH * 2,
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  todayPillText: {
    color: SLEEP_THEME.textPrimary,
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
  },
  labelsRow: {
    height: LABEL_ROW_HEIGHT,
    position: 'relative',
  },
  label: {
    position: 'absolute',
    bottom: 0,
    width: LABEL_WIDTH,
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 14,
  },
  labelDefault: {
    color: 'rgba(255,255,255,0.42)',
    fontFamily: SLEEP_FONTS.medium,
  },
  labelSelected: {
    color: SLEEP_THEME.textPrimary,
    fontFamily: SLEEP_FONTS.semiBold,
  },
});
