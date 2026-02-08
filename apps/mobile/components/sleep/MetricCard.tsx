import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle } from 'react-native-svg';

type MetricStatus = 'up' | 'down' | 'neutral';

type TrendValue = number | null | undefined;
type StageItem = { label: string; value: string; percent?: number; color: string };

const STATUS_META: Record<MetricStatus, { label: string; color: string }> = {
  up: { label: 'ABOVE', color: '#22C55E' },
  down: { label: 'BELOW', color: '#FF6B6B' },
  neutral: { label: 'AS USUAL', color: '#9AA0A6' },
};

const CARD_RADIUS = 24;
const CARD_BG = '#000000';
const CARD_STROKE = 'rgba(255,255,255,0.08)';
const TEXT_PRIMARY = '#F5F6F7';
const TEXT_SECONDARY = 'rgba(255,255,255,0.76)';
const TEXT_TERTIARY = 'rgba(255,255,255,0.5)';
const MINI_BAR_MAX = 32;
const MINI_BAR_MIN = 8;
const CHART_W = 140;
const CHART_H = 34;
const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export type MetricCardProps = {
  label: string;
  value: string;
  unit?: string;
  status?: MetricStatus;
  subLabel?: string;
  accent?: string;
  trend?: TrendValue[];
  chartType?: 'bars' | 'dots' | 'line' | 'ticks' | 'stages';
  dotThreshold?: number;
  stages?: StageItem[];
  icon?: keyof typeof Ionicons.glyphMap;
  showDays?: boolean;
  onPress?: () => void;
};

const padToSeven = (values: TrendValue[]) => {
  if (values.length >= 7) return values.slice(-7);
  return Array(7 - values.length).fill(null).concat(values);
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const withAlpha = (hex: string, alpha: string) => (hex.length === 7 ? `${hex}${alpha}` : hex);

const buildBarHeights = (data: TrendValue[]) => {
  const numeric = data.filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
  if (!numeric.length) return data.map(() => MINI_BAR_MIN);
  const min = Math.min(...numeric);
  const max = Math.max(...numeric);
  const range = max - min || 1;
  return data.map((value) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return MINI_BAR_MIN;
    const normalized = (value - min) / range;
    return MINI_BAR_MIN + normalized * (MINI_BAR_MAX - MINI_BAR_MIN);
  });
};

const buildSmoothPath = (points: { x: number; y: number }[]) => {
  if (points.length < 2) return '';
  const tension = 0.3;
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return path;
};

const buildLinePath = (data: TrendValue[]) => {
  const numeric = data.filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
  if (numeric.length < 2) return null;
  const min = Math.min(...numeric);
  const max = Math.max(...numeric);
  const range = max - min || 1;
  const points = data.map((value, index) => {
    const v = typeof value === 'number' && !Number.isNaN(value) ? value : min;
    const x = (index / (data.length - 1)) * CHART_W;
    const y = CHART_H - ((v - min) / range) * CHART_H;
    return { x, y };
  });
  const path = buildSmoothPath(points);
  return { path, end: points[points.length - 1] };
};

function MetricCard({
  label,
  value,
  unit,
  status = 'neutral',
  subLabel,
  accent,
  trend,
  chartType = 'bars',
  dotThreshold = 0,
  stages,
  icon,
  showDays = true,
  onPress,
}: MetricCardProps) {
  const meta = STATUS_META[status];
  const accentColor = accent ?? meta.color;

  const trendData = useMemo(() => padToSeven(trend ?? []), [trend]);
  const barHeights = useMemo(() => buildBarHeights(trendData), [trendData]);
  const linePath = useMemo(() => buildLinePath(trendData), [trendData]);
  const dotStates = useMemo(
    () =>
      trendData.map((value) =>
        typeof value === 'number' && !Number.isNaN(value) ? value >= dotThreshold : false
      ),
    [trendData, dotThreshold]
  );

  const statusText = subLabel ?? meta.label;
  const isStageCard = chartType === 'stages';
  const iconBg = icon ? withAlpha(accentColor, '22') : undefined;
  const iconBorder = icon ? withAlpha(accentColor, '3A') : undefined;

  return (
    <View style={styles.wrapper}>
      <Pressable
        style={({ pressed }) => [
          styles.card,
          pressed && { transform: [{ scale: 0.995 }], opacity: 0.96 },
        ]}
        android_ripple={{ color: 'rgba(255,255,255,0.04)', borderless: false }}
        onPress={onPress}>
        <LinearGradient
          colors={['rgba(255,255,255,0.04)', 'transparent']}
          start={[0, 0]}
          end={[1, 1]}
          style={styles.cardGlow}
        />
        <View style={styles.rowTop}>
          <View style={styles.labelRow}>
            {icon ? (
              <View
                style={[
                  styles.iconBadge,
                  { backgroundColor: iconBg, borderColor: iconBorder },
                ]}>
                <Ionicons name={icon} size={14} color={accentColor} />
              </View>
            ) : (
              <View style={[styles.dot, { backgroundColor: accentColor }]} />
            )}
            <Text style={styles.label} numberOfLines={1}>
              {label}
            </Text>
          </View>
          <View style={styles.todayRow}>
            <Text style={styles.todayText}>Today</Text>
            <Ionicons name="chevron-forward" size={14} color={TEXT_TERTIARY} />
          </View>
        </View>

        {isStageCard ? (
          <View style={styles.stageContent}>
            <View style={styles.stageTotals}>
              <View style={styles.valueRow}>
                <Text style={styles.valueText} selectable>
                  {value}
                </Text>
                {unit ? <Text style={styles.unitText}>{unit}</Text> : null}
              </View>
              <Text style={[styles.subText, { color: meta.color }]}>{statusText}</Text>
            </View>

            <View style={styles.stageRows}>
              {(stages || []).map((stage) => (
                <View key={stage.label} style={styles.stageRow}>
                  <View style={[styles.stageDot, { backgroundColor: stage.color }]} />
                  <Text style={styles.stageLabel}>{stage.label}</Text>
                  <Text style={styles.stageValue}>{stage.value}</Text>
                  {typeof stage.percent === 'number' ? (
                    <Text style={styles.stagePercent}>{stage.percent}%</Text>
                  ) : null}
                </View>
              ))}
            </View>

            {(stages || []).length ? (
              <View style={styles.stageBar}>
                {(stages || []).map((stage) => (
                  <View
                    key={`${stage.label}-seg`}
                    style={[
                      styles.stageSegment,
                      {
                        backgroundColor: stage.color,
                        flex: stage.percent ? stage.percent : 1,
                      },
                    ]}
                  />
                ))}
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.contentRow}>
            <View style={styles.valueBlock}>
              <View style={styles.valueRow}>
                <Text style={styles.valueText} selectable>
                  {value}
                </Text>
                {unit ? <Text style={styles.unitText}>{unit}</Text> : null}
              </View>
              <Text style={[styles.subText, { color: meta.color }]} numberOfLines={1}>
                {statusText}
              </Text>
            </View>

            <View style={styles.chartBlock}>
              {chartType === 'dots' ? (
                <View style={styles.dotsRow}>
                  {dotStates.map((filled, index) => (
                    <View
                      key={`${label}-dot-${index}`}
                      style={[
                        styles.dotItem,
                        {
                          borderColor: accentColor,
                          backgroundColor: filled ? accentColor : 'transparent',
                          opacity: filled ? 1 : 0.35,
                        },
                      ]}
                    />
                  ))}
                </View>
              ) : chartType === 'line' ? (
                <Svg width={CHART_W} height={CHART_H}>
                  {linePath ? (
                    <>
                      <Path
                        d={linePath.path}
                        stroke={accentColor}
                        strokeWidth={2}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <Circle
                        cx={linePath.end.x}
                        cy={linePath.end.y}
                        r={3}
                        fill={accentColor}
                      />
                    </>
                  ) : null}
                </Svg>
              ) : (
                <View style={chartType === 'ticks' ? styles.ticksRow : styles.barsRow}>
                  {barHeights.map((height, index) => (
                    <View
                      key={`${label}-bar-${index}`}
                      style={chartType === 'ticks' ? styles.tickTrack : styles.barTrack}>
                      <View
                        style={[
                          chartType === 'ticks' ? styles.tickFill : styles.barFill,
                          {
                            height: clamp(height, MINI_BAR_MIN, MINI_BAR_MAX),
                            backgroundColor: accentColor,
                            opacity: chartType === 'ticks' ? 0.7 : 0.85,
                          },
                        ]}
                      />
                    </View>
                  ))}
                </View>
              )}

              {showDays ? (
                <View style={styles.daysRow}>
                  {DAYS.map((day, index) => (
                    <Text key={`${label}-day-${index}`} style={styles.dayText}>
                      {day}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>
          </View>
        )}
      </Pressable>
    </View>
  );
}

const areTrendEqual = (a?: TrendValue[], b?: TrendValue[]) => {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

const areStagesEqual = (a?: StageItem[], b?: StageItem[]) => {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const sa = a[i];
    const sb = b[i];
    if (!sa || !sb) return false;
    if (
      sa.label !== sb.label ||
      sa.value !== sb.value ||
      sa.percent !== sb.percent ||
      sa.color !== sb.color
    ) {
      return false;
    }
  }
  return true;
};

const arePropsEqual = (prev: MetricCardProps, next: MetricCardProps) => {
  if (
    prev.label !== next.label ||
    prev.value !== next.value ||
    prev.unit !== next.unit ||
    prev.status !== next.status ||
    prev.subLabel !== next.subLabel ||
    prev.accent !== next.accent ||
    prev.chartType !== next.chartType ||
    prev.dotThreshold !== next.dotThreshold ||
    prev.icon !== next.icon ||
    prev.showDays !== next.showDays
  ) {
    return false;
  }

  if (!areTrendEqual(prev.trend, next.trend)) return false;
  if (!areStagesEqual(prev.stages, next.stages)) return false;

  return true;
};

export default React.memo(MetricCard, arePropsEqual);

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    alignSelf: 'stretch',
  },
  cardGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: CARD_RADIUS,
  },
  card: {
    width: '100%',
    borderRadius: CARD_RADIUS,
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_STROKE,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 10,
        shadowOffset: { height: 6, width: 0 },
      },
      android: {
        elevation: 3,
      },
    }),
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '70%',
  },
  iconBadge: {
    width: 22,
    height: 22,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  label: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    fontWeight: '600',
  },
  todayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  todayText: {
    color: TEXT_TERTIARY,
    fontSize: 12,
    fontWeight: '600',
  },
  contentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 16,
  },
  valueBlock: {
    flexShrink: 1,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  valueText: {
    color: TEXT_PRIMARY,
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  unitText: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    fontWeight: '600',
  },
  subText: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
  },
  chartBlock: {
    minWidth: CHART_W,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  barTrack: {
    width: 6,
    height: MINI_BAR_MAX,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: '100%',
    borderRadius: 999,
  },
  ticksRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  tickTrack: {
    width: 3,
    height: MINI_BAR_MAX,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  tickFill: {
    width: '100%',
    borderRadius: 999,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dotItem: {
    width: 10,
    height: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    gap: 6,
  },
  dayText: {
    color: TEXT_TERTIARY,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    textAlign: 'center',
    width: 10,
  },
  stageContent: {
    gap: 10,
  },
  stageTotals: {
    marginBottom: 2,
  },
  stageRows: {
    gap: 8,
  },
  stageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stageDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  stageLabel: {
    color: TEXT_SECONDARY,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  stageValue: {
    color: TEXT_PRIMARY,
    fontSize: 12,
    fontWeight: '700',
  },
  stagePercent: {
    color: TEXT_TERTIARY,
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 6,
  },
  stageBar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  stageSegment: {
    height: '100%',
  },
});
