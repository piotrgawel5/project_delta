import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Defs, LinearGradient as SvgGradient, Stop, Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

type MetricStatus = 'up' | 'down' | 'neutral';

type TrendValue = number | null | undefined;
type StageItem = { label: string; value: string; percent?: number | null; color: string };

const STATUS_META: Record<MetricStatus, { label: string; color: string }> = {
  up: { label: 'ABOVE', color: '#22C55E' },
  down: { label: 'BELOW', color: '#FF6B6B' },
  neutral: { label: 'AS USUAL', color: '#9AA0A6' },
};

const CARD_PADDING_X = 20;
const CARD_PADDING_Y = 20;
const CARD_INNER_RADIUS = 4;
const CARD_RADIUS = CARD_INNER_RADIUS + CARD_PADDING_Y;
const CARD_BG = '#1C1C1E';
const CARD_STROKE = 'rgba(255,255,255,0.08)';
const TEXT_PRIMARY = '#F5F6F7';
const TEXT_SECONDARY = 'rgba(235,235,245,0.6)';
const TEXT_TERTIARY = 'rgba(235,235,245,0.4)';
const SPARKLINE_HEIGHT = 40;
const MINI_BAR_MAX = SPARKLINE_HEIGHT;
const MINI_BAR_MIN = 8;
const MINI_BAR_WIDTH = 6;
const CHART_W = 144 - CARD_PADDING_X * 2;
const CHART_H = SPARKLINE_HEIGHT;
const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const ICON_BADGE_SIZE = 22;
const ICON_BADGE_RADIUS = Math.round(ICON_BADGE_SIZE * 0.36);
const DOT_SIZE = 10;
const DOT_RADIUS = DOT_SIZE / 2;
const STAGE_DOT_SIZE = 8;
const STAGE_DOT_RADIUS = STAGE_DOT_SIZE / 2;
const STAGE_BAR_HEIGHT = 12;
const STAGE_BAR_RADIUS = STAGE_BAR_HEIGHT / 2;
const METRIC_TAG_RADIUS = 6;
const METRIC_TAG_BG = 'rgba(255,255,255,0.08)';

export type MetricCardProps = {
  label: string;
  value: string;
  unit?: string;
  status?: MetricStatus;
  subLabel?: string;
  accent?: string;
  trend?: TrendValue[];
  chartType?: 'bars' | 'dots' | 'stages';
  dotThreshold?: number;
  stages?: StageItem[];
  icon?: keyof typeof Ionicons.glyphMap;
  showDays?: boolean;
  onPress?: () => void;
  dataDate?: Date | string | null;
  selectedDate?: Date | string | null;
};

type MetricTagProps = {
  label: string;
};

type MetricActionTagProps = {
  label: string;
  onPress: () => void;
};

const padToSeven = (values: TrendValue[]) => {
  if (values.length >= 7) return values.slice(-7);
  return Array(7 - values.length)
    .fill(null)
    .concat(values);
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const withAlpha = (hex: string, alpha: string) => (hex.length === 7 ? `${hex}${alpha}` : hex);

const toDateKey = (value?: Date | string | null) => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
};

/**
 * Generate a smooth cubic bezier path from points
 */
function generateSmoothPath(
  points: { x: number; y: number }[],
  width: number,
  height: number
): { linePath: string; areaPath: string } {
  if (points.length < 2) return { linePath: '', areaPath: '' };

  const tension = 0.3; // Controls curve smoothness
  let linePath = `M ${points[0].x} ${points[0].y}`;

const MetricTag = ({ label }: MetricTagProps) => (
  <View style={styles.metricTag}>
    <Text style={styles.metricTagText}>{label}</Text>
  </View>
);

const MetricActionTag = ({ label, onPress }: MetricActionTagProps) => (
  <Pressable
    accessibilityRole="button"
    onPress={onPress}
    style={({ pressed }) => [styles.metricTag, styles.metricActionTag, pressed && styles.tagPressed]}>
    <Text style={styles.metricTagText}>{label}</Text>
    <Text style={styles.metricActionChevron}>›</Text>
  </Pressable>
);

export default function MetricCard({
  label,
  value,
  unit,
  status = 'neutral',
  sparkline,
  onPress,
}: MetricCardProps) {
  const meta = STATUS_META[status];

  const trendData = useMemo(() => padToSeven(trend ?? []), [trend]);
  const barHeights = useMemo(() => buildBarHeights(trendData), [trendData]);
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
  const stageSegments = useMemo(
    () => (stages || []).filter((stage) => typeof stage.percent === 'number' && stage.percent > 0),
    [stages]
  );
  const statusTag = isInteractive && onPress ? (
    <MetricActionTag label={statusText} onPress={onPress} />
  ) : (
    <MetricTag label={statusText} />
  );
  const dateLabel = useMemo(
    () => getRelativeDateLabel(dataDate, selectedDate),
    [dataDate, selectedDate]
  );

  return (
    <View style={styles.wrapper}>
      <Pressable
        style={({ pressed }) => [
          styles.card,
          { width: CARD_WIDTH },
          pressed && { opacity: 0.92, transform: [{ scale: 0.997 }] },
        ]}
        android_ripple={{ color: 'rgba(255,255,255,0.04)', borderless: false }}
        onPress={onPress}>
        <LinearGradient
          colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.01)']}
          start={[0, 0]}
          end={[1, 1]}
          style={styles.baseGlow}
        />

        {isStageCard ? (
          <View style={styles.stageContent}>
            <View style={styles.stageTotals}>
              <View style={styles.valueRow}>
                <Text style={styles.valueText} selectable>
                  {value}
                </Text>
                {unit ? <Text style={styles.unitText}>{unit}</Text> : null}
              </View>
              {statusTag}
            </View>

            <View style={styles.stageRows}>
              {(stages || []).map((stage) => (
                <View key={stage.label} style={styles.stageRow}>
                  <View style={[styles.stageDot, { backgroundColor: stage.color }]} />
                  <Text style={styles.stageLabel}>{stage.label}</Text>
                  <Text style={styles.stageValue}>{stage.value}</Text>
                  <Text style={styles.stagePercent}>
                    {typeof stage.percent === 'number' ? `${stage.percent}%` : '—'}
                  </Text>
                </View>
              ))}
            </View>

            {stageSegments.length ? (
              <View style={styles.stageBar}>
                {stageSegments.map((stage) => (
                  <View
                    key={`${stage.label}-seg`}
                    style={[
                      styles.stageSegment,
                      {
                        backgroundColor: stage.color,
                        flex: stage.percent as number,
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
              {statusTag}
            </View>
          )}
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
              ) : (
                <View style={styles.barsRow}>
                  {barHeights.map((height, index) => (
                    <View key={`${label}-bar-${index}`} style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            height: clamp(height, MINI_BAR_MIN, MINI_BAR_MAX),
                            backgroundColor: accentColor,
                            opacity: 0.85,
                          },
                        ]}
                      />
                    </View>
                  ))}
                </View>
              )}

        {/* Sparkline or placeholder */}
        <View style={sparklinePaths ? styles.rowBottomStacked : styles.rowBottom}>
          {sparklinePaths ? renderSparkline() : <Text style={styles.subText}>Last 7 days</Text>}
          <View style={[styles.weekBadge, sparklinePaths && styles.weekBadgeBelow]}>
            <Text style={styles.weekBadgeText}>Week view</Text>
          </View>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 12,
  },
  card: {
    borderRadius: CARD_RADIUS,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(14,14,16,0.7)',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    // soft elevation
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 12,
        shadowOffset: { height: 6, width: 0 },
      },
      android: {
        elevation: 4,
      },
    }),
  },
  baseGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: CARD_RADIUS,
  },
  topAccent: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 38,
    top: 0,
    borderTopLeftRadius: CARD_RADIUS,
    borderTopRightRadius: CARD_RADIUS,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  divider: {
    height: 2,
    borderRadius: 999,
    marginBottom: 10,
    alignSelf: 'stretch',
  },
  label: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    fontWeight: '600',
    maxWidth: CARD_WIDTH * 0.6,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  valueText: {
    color: 'white',
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  unitText: {
    color: TEXT_SECONDARY,
    fontSize: 19,
    fontWeight: '400',
    marginLeft: 4,
  },
  metricTag: {
    alignSelf: 'flex-start',
    borderRadius: METRIC_TAG_RADIUS,
    backgroundColor: METRIC_TAG_BG,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricActionTag: {
    gap: 6,
  },
  metricTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  metricActionChevron: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    lineHeight: 14,
  },
  tagPressed: {
    opacity: 0.6,
  },
  chartBlock: {
    minWidth: CHART_W,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10.5,
  },
  barTrack: {
    width: MINI_BAR_WIDTH,
    height: MINI_BAR_MAX,
    borderRadius: MINI_BAR_WIDTH / 2,
    backgroundColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: '100%',
    borderTopLeftRadius: MINI_BAR_WIDTH / 2,
    borderTopRightRadius: MINI_BAR_WIDTH / 2,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  weekBadge: {
    marginLeft: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  weekBadgeBelow: {
    marginLeft: 0,
    marginTop: 6,
  },
  weekBadgeText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  sparklineContainer: {
    flex: 1,
    marginTop: 4,
  },
  sparkline: {
    marginTop: 2,
  },
  subText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontWeight: '600',
  },
});
