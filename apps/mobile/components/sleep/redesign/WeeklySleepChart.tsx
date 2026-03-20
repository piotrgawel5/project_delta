import { useMemo } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient as SvgLinearGradient,
  Path,
  Stop,
} from 'react-native-svg';
import { SLEEP_FONTS, SLEEP_LAYOUT, SLEEP_THEME } from '@constants';
import type { ChartPoint, WeeklySleepChartProps } from '../../../types/sleep-ui';

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
const TODAY_PILL_MIN_GAP = 30;
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

function resolveAnchorRatio(rawRatios: readonly (number | null)[], todayIndex: number): number {
  const today = rawRatios[todayIndex];
  if (typeof today === 'number') return today;

  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < rawRatios.length; index += 1) {
    if (typeof rawRatios[index] !== 'number') continue;
    const distance = Math.abs(index - todayIndex);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }

  return bestIndex >= 0 ? (rawRatios[bestIndex] as number) : WAVE_PROFILE[todayIndex];
}

function buildDisplayRatios(rawRatios: readonly (number | null)[], todayIndex: number) {
  const anchorRatio = resolveAnchorRatio(rawRatios, todayIndex);
  const profileShift = anchorRatio - WAVE_PROFILE[todayIndex];
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
    const { ratios: displayRatios, missingMask } = buildDisplayRatios(rawRatios, todayIndex);

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

  const todayPillLeft =
    chart.todayPoint === null
      ? 0
      : Math.max(
          TODAY_PILL_MIN_LEFT,
          Math.min(
            chartWidth - TODAY_PILL_HALF_WIDTH * 2 - TODAY_PILL_MIN_LEFT,
            chart.todayPoint.x - TODAY_PILL_HALF_WIDTH
          )
        );

  const belowTop =
    chart.todayPoint === null ? 0 : chart.todayPoint.y + TODAY_PILL_MIN_GAP;
  const todayPillTop =
    chart.todayPoint === null
      ? 0
      : belowTop + TODAY_PILL_HEIGHT <= SVG_HEIGHT - 2
        ? belowTop
        : Math.max(2, chart.todayPoint.y - TODAY_PILL_MIN_GAP - TODAY_PILL_HEIGHT);

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

          {chart.dayPoints.map((point, index) => {
            const isSelected = index === todayIndex;
            const radius = isSelected ? 5.5 : 4.8;
            const glowRadius = isSelected ? 12 : 0;
            const fill = isSelected ? '#FFFFFF' : '#3F4148';

            return (
              <G key={index}>
                {isSelected ? (
                  <Circle cx={point.x} cy={point.y} r={glowRadius} fill="rgba(255,255,255,0.22)" />
                ) : null}
                <Circle cx={point.x} cy={point.y} r={radius} fill={fill} />
              </G>
            );
          })}
        </Svg>

        {chart.todayPoint ? (
          <View style={[styles.todayPill, { left: todayPillLeft, top: todayPillTop }]}>
            <Text style={styles.todayPillText}>{chart.todayLabel}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.labelsRow}>
        {DAY_LABELS.map((label, index) => {
          const isSelected = index === todayIndex;
          const dayPoint = chart.dayPoints[index];
          const left = (dayPoint?.x ?? 0) - LABEL_WIDTH / 2;

          return (
            <Text
              key={`${label}-${index}`}
              style={[
                styles.label,
                { left },
                isSelected ? styles.labelSelected : styles.labelDefault,
              ]}>
              {label}
            </Text>
          );
        })}
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
