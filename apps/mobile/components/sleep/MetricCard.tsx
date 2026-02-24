import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import Svg, {
  Path,
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
} from 'react-native-svg';

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

const formatShortDate = (value: Date | string) => {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d);
};

const getRelativeDateLabel = (value?: Date | string | null, selected?: Date | string | null) => {
  const key = toDateKey(value);
  if (!key) return null;
  const selectedKey = toDateKey(selected);
  if (selectedKey && selectedKey === key) return null;
  const todayKey = toDateKey(new Date());
  if (todayKey === key) return 'Today';
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = toDateKey(yesterday);
  if (yesterdayKey === key) return 'Yesterday';
  return formatShortDate(value as Date | string);
};

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

const MetricTag = ({ label }: MetricTagProps) => (
  <View style={styles.metricTag}>
    <Text style={styles.metricTagText}>{label}</Text>
  </View>
);

const MetricActionTag = ({ label, onPress }: MetricActionTagProps) => (
  <Pressable
    accessibilityRole="button"
    onPress={onPress}
    style={({ pressed }) => [
      styles.metricTag,
      styles.metricActionTag,
      pressed && styles.tagPressed,
    ]}>
    <Text style={styles.metricTagText}>{label}</Text>
    <Text style={styles.metricActionChevron}>›</Text>
  </Pressable>
);

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
  dataDate,
  selectedDate,
}: MetricCardProps) {
  const meta = STATUS_META[status];
  const accentColor = accent ?? meta.color;
  const isInteractive = Boolean(onPress);

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
  const statusTag =
    isInteractive && onPress ? (
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
          pressed && isInteractive ? { transform: [{ scale: 0.995 }], opacity: 0.96 } : null,
        ]}
        android_ripple={
          isInteractive ? { color: 'rgba(255,255,255,0.04)', borderless: false } : undefined
        }
        disabled={!isInteractive}
        onPress={onPress}>
        <ExpoLinearGradient
          colors={['rgba(255,255,255,0.04)', 'transparent']}
          start={[0, 0]}
          end={[1, 1]}
          style={styles.cardGlow}
        />
        <View style={styles.rowTop}>
          <View style={styles.labelRow}>
            {icon ? (
              <View
                style={[styles.iconBadge, { backgroundColor: iconBg, borderColor: iconBorder }]}>
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
            {dateLabel ? <Text style={styles.todayText}>{dateLabel}</Text> : null}
            {isInteractive ? (
              <Ionicons name="chevron-forward" size={14} color={TEXT_TERTIARY} />
            ) : null}
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
    prev.showDays !== next.showDays ||
    prev.dataDate !== next.dataDate ||
    prev.selectedDate !== next.selectedDate
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
    paddingHorizontal: CARD_PADDING_X,
    paddingVertical: CARD_PADDING_Y,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_STROKE,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.16,
        shadowRadius: 10,
        shadowOffset: { height: 6, width: 0 },
      },
      android: {
        elevation: 2,
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
    width: ICON_BADGE_SIZE,
    height: ICON_BADGE_SIZE,
    borderRadius: ICON_BADGE_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_RADIUS,
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
    gap: 0,
  },
  valueText: {
    color: TEXT_PRIMARY,
    fontSize: 32,
    fontWeight: '600',
    letterSpacing: -0.6,
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
  dotItem: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_RADIUS,
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
    width: STAGE_DOT_SIZE,
    height: STAGE_DOT_SIZE,
    borderRadius: STAGE_DOT_RADIUS,
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
    height: STAGE_BAR_HEIGHT,
    borderRadius: STAGE_BAR_RADIUS,
    overflow: 'hidden',
    backgroundColor: CARD_BG,
    gap: 2,
  },
  stageSegment: {
    height: '100%',
    borderRadius: STAGE_BAR_RADIUS,
  },
});
