import { useMemo } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn } from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient as SvgLinearGradient,
  Path,
  Stop,
} from 'react-native-svg';
import { SLEEP_FONTS, SLEEP_LAYOUT, SLEEP_THEME } from '@constants';
import { buildSmoothPath } from '@lib/sleepChartUtils';
import type { ChartPoint, WeeklySleepChartProps } from '../../../types/sleep-ui';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MAX_MINUTES = 10 * 60;
const LABEL_ROW_HEIGHT = 26;
const SVG_HEIGHT = SLEEP_LAYOUT.chartHeight - LABEL_ROW_HEIGHT;
const PLOT_TOP = 18;
const PLOT_BOTTOM = 22;
const TOOLTIP_WIDTH = 88;
const TOOLTIP_HEIGHT = 28;

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}h ${remainder}m`;
}

function buildAreaPath(points: readonly ChartPoint[], bottomY: number): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    const point = points[0];
    return `M ${point.x} ${bottomY} L ${point.x} ${point.y} L ${point.x} ${bottomY} Z`;
  }

  const linePath = buildSmoothPath(points.map(({ x, y }) => ({ x, y })));
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];

  return `${linePath} L ${lastPoint.x} ${bottomY} L ${firstPoint.x} ${bottomY} Z`;
}

export default function WeeklySleepChart({
  data,
  todayIndex,
  targetMinutes,
}: WeeklySleepChartProps) {
  const paddingHorizontal = SLEEP_LAYOUT.screenPaddingH;
  const chartWidth = SCREEN_WIDTH;
  const plotWidth = chartWidth - paddingHorizontal * 2;
  const stepX = plotWidth / Math.max(1, DAY_LABELS.length - 1);
  const plotHeight = SVG_HEIGHT - PLOT_TOP - PLOT_BOTTOM;
  const bottomY = PLOT_TOP + plotHeight;

  const chart = useMemo(() => {
    const points: ChartPoint[] = data.map((minutes, index) => {
      const clampedMinutes =
        typeof minutes === 'number' ? Math.max(0, Math.min(MAX_MINUTES, minutes)) : null;
      const ratio = clampedMinutes === null ? 0 : clampedMinutes / MAX_MINUTES;
      const y = bottomY - ratio * plotHeight;

      return {
        x: paddingHorizontal + index * stepX,
        y,
        hasData: clampedMinutes !== null,
      };
    });

    const realPoints = points.filter((point) => point.hasData);
    const firstPoint = realPoints[0];
    const lastPoint = realPoints[realPoints.length - 1];
    const placeholderY = PLOT_TOP + plotHeight * 0.68;

    return {
      points,
      realPoints,
      mainPath:
        realPoints.length > 1
          ? buildSmoothPath(realPoints.map(({ x, y }) => ({ x, y })))
          : '',
      leadInPath: firstPoint
        ? `M ${paddingHorizontal} ${firstPoint.y} L ${firstPoint.x} ${firstPoint.y}`
        : '',
      dashedPath: lastPoint
        ? `M ${lastPoint.x} ${lastPoint.y} L ${chartWidth - paddingHorizontal} ${lastPoint.y}`
        : `M ${paddingHorizontal} ${placeholderY} L ${chartWidth - paddingHorizontal} ${placeholderY}`,
      areaPath: buildAreaPath(realPoints, bottomY),
      todayPoint: points[todayIndex],
    };
  }, [bottomY, chartWidth, data, paddingHorizontal, plotHeight, stepX, todayIndex]);

  const tooltipVisible = !!chart.todayPoint?.hasData && typeof data[todayIndex] === 'number';
  const tooltipLabel = tooltipVisible ? formatMinutes(data[todayIndex] as number) : null;
  const tooltipLeft = chart.todayPoint
    ? Math.max(
        paddingHorizontal,
        Math.min(
          chart.todayPoint.x - TOOLTIP_WIDTH / 2,
          chartWidth - paddingHorizontal - TOOLTIP_WIDTH
        )
      )
    : paddingHorizontal;
  const tooltipTop = chart.todayPoint ? Math.max(0, chart.todayPoint.y - TOOLTIP_HEIGHT - 18) : 0;
  const targetY =
    typeof targetMinutes === 'number'
      ? bottomY - (Math.max(0, Math.min(MAX_MINUTES, targetMinutes)) / MAX_MINUTES) * plotHeight
      : null;

  return (
    <View style={styles.container}>
      <View style={styles.svgWrap}>
        <Svg width={chartWidth} height={SVG_HEIGHT}>
          <Defs>
            <SvgLinearGradient id="sleepAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor={SLEEP_THEME.heroOverlayStart} stopOpacity={0.8} />
              <Stop offset="100%" stopColor={SLEEP_THEME.heroOverlayEnd} stopOpacity={0.1} />
            </SvgLinearGradient>
          </Defs>

          {targetY !== null ? (
            <Line
              x1={paddingHorizontal}
              x2={chartWidth - paddingHorizontal}
              y1={targetY}
              y2={targetY}
              stroke={SLEEP_THEME.textSecondary}
              strokeDasharray="4 6"
              strokeOpacity={0.22}
            />
          ) : null}

          {chart.areaPath ? <Path d={chart.areaPath} fill="url(#sleepAreaGradient)" /> : null}

          {chart.leadInPath ? (
            <Path
              d={chart.leadInPath}
              stroke={SLEEP_THEME.chartLine}
              strokeOpacity={SLEEP_THEME.chartLineOpacityDimmed}
              strokeWidth={1.5}
              fill="none"
              strokeLinecap="round"
            />
          ) : null}

          {chart.mainPath ? (
            <Path
              d={chart.mainPath}
              stroke={SLEEP_THEME.chartLine}
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
            />
          ) : null}

          {chart.dashedPath ? (
            <Path
              d={chart.dashedPath}
              stroke={SLEEP_THEME.chartLine}
              strokeOpacity={SLEEP_THEME.chartLineOpacityDimmed}
              strokeWidth={1.5}
              fill="none"
              strokeDasharray="4 6"
              strokeLinecap="round"
            />
          ) : null}

          {chart.points.map((point, index) => {
            if (!point.hasData) return null;
            const isToday = index === todayIndex;

            return (
              <G key={index}>
                {isToday ? (
                  <Circle
                    cx={point.x}
                    cy={point.y}
                    r={SLEEP_LAYOUT.dotGlowSize / 2}
                    fill={SLEEP_THEME.chartGlowRing}
                  />
                ) : null}
                <Circle
                  cx={point.x}
                  cy={point.y}
                  r={SLEEP_LAYOUT.dotSize / 2}
                  fill={isToday ? SLEEP_THEME.chartDotToday : SLEEP_THEME.chartDotFill}
                />
              </G>
            );
          })}
        </Svg>

        {tooltipVisible && chart.todayPoint ? (
          <Animated.View
            entering={FadeIn.duration(200)}
            style={[
              styles.tooltip,
              {
                left: tooltipLeft,
                top: tooltipTop,
              },
            ]}>
            <LinearGradient
              colors={[SLEEP_THEME.chartTooltipBg, SLEEP_THEME.cardBg]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.tooltipFill}>
              <Text style={styles.tooltipText}>{tooltipLabel}</Text>
            </LinearGradient>
          </Animated.View>
        ) : null}
      </View>

      <View style={styles.labelsRow}>
        {DAY_LABELS.map((label, index) => {
          const isToday = index === todayIndex;
          const hasData = data[index] !== null;

          return (
            <Text
              key={`${label}-${index}`}
              style={[
                styles.label,
                isToday ? styles.labelToday : styles.labelDefault,
                !hasData && styles.labelMissing,
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
  },
  tooltip: {
    position: 'absolute',
    width: TOOLTIP_WIDTH,
    height: TOOLTIP_HEIGHT,
    borderRadius: 12,
    overflow: 'hidden',
  },
  tooltipFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  tooltipText: {
    color: SLEEP_THEME.textPrimary,
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 13,
  },
  labelsRow: {
    height: LABEL_ROW_HEIGHT,
    paddingHorizontal: SLEEP_LAYOUT.screenPaddingH - 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  label: {
    width: 16,
    textAlign: 'center',
    fontSize: 11,
  },
  labelDefault: {
    color: SLEEP_THEME.textMuted2,
    fontFamily: SLEEP_FONTS.medium,
  },
  labelToday: {
    color: SLEEP_THEME.textPrimary,
    fontFamily: SLEEP_FONTS.semiBold,
  },
  labelMissing: {
    opacity: 0.4,
  },
});
