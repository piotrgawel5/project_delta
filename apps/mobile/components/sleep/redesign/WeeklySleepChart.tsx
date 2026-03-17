import { useMemo } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient as SvgLinearGradient, Path, Stop } from 'react-native-svg';
import { SLEEP_FONTS, SLEEP_LAYOUT, SLEEP_THEME } from '@constants';
import { buildSmoothPath } from '@lib/sleepChartUtils';
import type { ChartPoint, WeeklySleepChartProps } from '../../../types/sleep-ui';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MAX_MINUTES = 10 * 60;
const LABEL_ROW_HEIGHT = 24;
const SVG_HEIGHT = SLEEP_LAYOUT.chartHeight - LABEL_ROW_HEIGHT;
const PLOT_TOP = 16;
const PLOT_BOTTOM = 14;
const FALLBACK_TEMPLATE = [0.42, 0.72, 0.39, 0.18, 0.52, 0.75, 0.58] as const;
const MIN_TEMPLATE_RATIO = 0.12;
const MAX_TEMPLATE_RATIO = 0.86;

function clampRatio(value: number): number {
  return Math.max(MIN_TEMPLATE_RATIO, Math.min(MAX_TEMPLATE_RATIO, value));
}

function buildFallbackRatios(
  ratios: readonly (number | null)[],
  todayIndex: number
): number[] {
  const anchorIndex =
    typeof ratios[todayIndex] === 'number'
      ? todayIndex
      : ratios.findIndex((ratio) => typeof ratio === 'number');

  const anchorTemplate = FALLBACK_TEMPLATE[Math.max(0, anchorIndex)];
  const anchorActual =
    anchorIndex >= 0 && typeof ratios[anchorIndex] === 'number'
      ? ratios[anchorIndex]
      : FALLBACK_TEMPLATE[todayIndex];
  const delta = anchorActual - anchorTemplate;

  return FALLBACK_TEMPLATE.map((ratio) => clampRatio(ratio + delta));
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
}: WeeklySleepChartProps) {
  const paddingHorizontal = SLEEP_LAYOUT.screenPaddingH - 2;
  const chartWidth = SCREEN_WIDTH;
  const plotWidth = chartWidth - paddingHorizontal * 2;
  const stepX = plotWidth / Math.max(1, DAY_LABELS.length - 1);
  const plotHeight = SVG_HEIGHT - PLOT_TOP - PLOT_BOTTOM;
  const bottomY = PLOT_TOP + plotHeight;

  const chart = useMemo(() => {
    const ratios = data.map((minutes) =>
      typeof minutes === 'number' ? Math.max(0, Math.min(MAX_MINUTES, minutes)) / MAX_MINUTES : null
    );
    const fallbackRatios = buildFallbackRatios(ratios, todayIndex);

    const points: ChartPoint[] = data.map((minutes, index) => {
      const clampedMinutes =
        typeof minutes === 'number' ? Math.max(0, Math.min(MAX_MINUTES, minutes)) : null;
      const ratio = typeof ratios[index] === 'number' ? ratios[index] : fallbackRatios[index];
      const y = bottomY - ratio * plotHeight;

      return {
        x: paddingHorizontal + index * stepX,
        y,
        hasData: clampedMinutes !== null,
      };
    });

    const solidPoints = points.slice(0, todayIndex + 1);
    const dashedPoints = points.slice(Math.max(0, todayIndex), DAY_LABELS.length);

    return {
      points,
      mainPath:
        solidPoints.length > 1
          ? buildSmoothPath(solidPoints.map(({ x, y }) => ({ x, y })), 0.35)
          : '',
      dashedPath:
        dashedPoints.length > 1
          ? buildSmoothPath(dashedPoints.map(({ x, y }) => ({ x, y })), 0.35)
          : '',
      areaPath: buildAreaPath(points, bottomY),
    };
  }, [bottomY, data, paddingHorizontal, plotHeight, stepX, todayIndex]);

  return (
    <View style={styles.container}>
      <View style={styles.svgWrap}>
        <Svg width={chartWidth} height={SVG_HEIGHT}>
          <Defs>
            <SvgLinearGradient id="sleepAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.15} />
              <Stop offset="42%" stopColor="#FFFFFF" stopOpacity={0.06} />
              <Stop offset="100%" stopColor="#000000" stopOpacity={0} />
            </SvgLinearGradient>
          </Defs>

          {chart.areaPath ? <Path d={chart.areaPath} fill="url(#sleepAreaGradient)" /> : null}

          {chart.mainPath ? (
            <Path
              d={chart.mainPath}
              stroke={SLEEP_THEME.chartLine}
              strokeWidth={5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}

          {chart.dashedPath ? (
            <Path
              d={chart.dashedPath}
              stroke={SLEEP_THEME.chartLine}
              strokeOpacity={0.54}
              strokeWidth={5}
              fill="none"
              strokeDasharray="5 5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}

          {chart.points.map((point, index) => {
            const isSelected = index === todayIndex;
            const radius = isSelected ? 6.5 : 4.8;
            const glowRadius = isSelected ? 10 : 0;
            const fill = isSelected ? '#FFFFFF' : '#3F4148';

            return (
              <G key={index}>
                {isSelected ? (
                  <Circle cx={point.x} cy={point.y} r={glowRadius} fill="rgba(255,255,255,0.18)" />
                ) : null}
                <Circle cx={point.x} cy={point.y} r={radius} fill={fill} />
              </G>
            );
          })}
        </Svg>
      </View>

      <View style={styles.labelsRow}>
        {DAY_LABELS.map((label, index) => {
          const isSelected = index === todayIndex;

          return (
            <Text
              key={`${label}-${index}`}
              style={[styles.label, isSelected ? styles.labelSelected : styles.labelDefault]}>
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
  labelsRow: {
    height: LABEL_ROW_HEIGHT,
    paddingHorizontal: SLEEP_LAYOUT.screenPaddingH - 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  label: {
    width: 14,
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 14,
  },
  labelDefault: {
    color: 'rgba(255,255,255,0.36)',
    fontFamily: SLEEP_FONTS.medium,
  },
  labelSelected: {
    color: SLEEP_THEME.textPrimary,
    fontFamily: SLEEP_FONTS.semiBold,
  },
});
