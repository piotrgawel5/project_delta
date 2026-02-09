import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Dimensions, ScrollView } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Defs, LinearGradient as SvgLinearGradient, Stop, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type TrendValue = number | null | undefined;

type MetricDetailRow = {
  label: string;
  value: string;
};

type ChartType = 'bars' | 'dots' | 'line' | 'ticks';

export type MetricInsight = {
  title: string;
  value: string;
  caption?: string;
  tone?: 'positive' | 'neutral' | 'negative';
};

export type MetricRecommendation = {
  title: string;
  detail: string;
};

export type MetricRange = {
  label?: string;
  min?: number;
  max?: number;
  note?: string;
};

export type MetricSegment = {
  label: string;
  value: string;
  percent?: number;
  color: string;
};

interface MetricDetailSheetProps {
  isVisible: boolean;
  onClose: () => void;
  title: string;
  value: string;
  unit?: string;
  subtitle?: string;
  analysis?: string;
  accent: string;
  trend?: TrendValue[];
  trendLabels?: string[];
  rows?: MetricDetailRow[];
  chartType?: ChartType;
  dotThreshold?: number;
  insights?: MetricInsight[];
  recommendations?: MetricRecommendation[];
  range?: MetricRange;
  currentValue?: number;
  segments?: MetricSegment[];
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const SHEET_RADIUS = 32;
const CHART_W = SCREEN_W - 96;
const CHART_H = 150;
const MINI_BAR_MAX = 56;
const MINI_BAR_MIN = 10;
const SHEET_BG = '#111117';
const CARD_BG = '#16161D';
const CARD_ALT = '#1B1B22';
const BORDER = 'rgba(255,255,255,0.08)';
const TEXT_PRIMARY = '#F5F6FA';
const TEXT_SECONDARY = 'rgba(255,255,255,0.72)';
const TEXT_TERTIARY = 'rgba(255,255,255,0.48)';
const DEFAULT_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const withAlpha = (hex: string, alpha: string) => (hex.length === 7 ? `${hex}${alpha}` : hex);

const padToSeven = (values: TrendValue[]) => {
  if (values.length >= 7) return values.slice(-7);
  return Array(7 - values.length).fill(null).concat(values);
};

const padToSevenLabels = (values: string[]) => {
  if (values.length >= 7) return values.slice(-7);
  return Array(7 - values.length).fill('--').concat(values);
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

const buildSmoothPath = (points: { x: number; y: number }[]) => {
  if (points.length < 2) return '';
  const tension = 0.28;
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
  const area = `${path} L ${points[points.length - 1].x} ${CHART_H} L ${points[0].x} ${CHART_H} Z`;
  return { path, area, end: points[points.length - 1], min, max };
};

const getRangeBand = (range: MetricRange | undefined, minVal: number, maxVal: number) => {
  if (!range || range.min == null || range.max == null || maxVal === minVal) return null;
  const rangeSpan = maxVal - minVal || 1;
  const yMin = CHART_H - ((range.min - minVal) / rangeSpan) * CHART_H;
  const yMax = CHART_H - ((range.max - minVal) / rangeSpan) * CHART_H;
  const top = clamp(Math.min(yMin, yMax), 0, CHART_H);
  const bottom = clamp(Math.max(yMin, yMax), 0, CHART_H);
  const height = Math.max(2, bottom - top);
  return { top, height };
};

const getRangeStatus = (range: MetricRange | undefined, current: number | null) => {
  if (!range || current == null || range.min == null || range.max == null) return null;
  if (current < range.min) return { label: 'Below range', color: '#F87171' };
  if (current > range.max) return { label: 'Above range', color: '#FBBF24' };
  return { label: 'In range', color: '#22C55E' };
};

const formatRangeLabel = (range?: MetricRange) => {
  if (!range) return '';
  if (range.label) return range.label;
  if (range.min != null && range.max != null) return `${range.min} - ${range.max}`;
  return '';
};

export const MetricDetailSheet = ({
  isVisible,
  onClose,
  title,
  value,
  unit,
  subtitle,
  analysis,
  accent,
  trend = [],
  trendLabels,
  rows = [],
  chartType = 'line',
  dotThreshold = 0,
  insights = [],
  recommendations = [],
  range,
  currentValue,
  segments = [],
}: MetricDetailSheetProps) => {
  const insets = useSafeAreaInsets();
  const trendData = useMemo(() => padToSeven(trend), [trend]);
  const labels = useMemo(() => {
    if (trendLabels && trendLabels.length >= 7) return trendLabels.slice(-7);
    if (trendLabels && trendLabels.length) return padToSevenLabels(trendLabels);
    return DEFAULT_LABELS;
  }, [trendLabels]);
  const barHeights = useMemo(() => buildBarHeights(trendData), [trendData]);
  const linePath = useMemo(() => buildLinePath(trendData), [trendData]);
  const dotStates = useMemo(
    () =>
      trendData.map((v) => (typeof v === 'number' && !Number.isNaN(v) ? v >= dotThreshold : false)),
    [trendData, dotThreshold]
  );

  const latestValue = useMemo(() => {
    if (typeof currentValue === 'number' && !Number.isNaN(currentValue)) return currentValue;
    for (let i = trendData.length - 1; i >= 0; i -= 1) {
      const v = trendData[i];
      if (typeof v === 'number' && !Number.isNaN(v)) return v;
    }
    return null;
  }, [currentValue, trendData]);

  const rangeStatus = useMemo(() => getRangeStatus(range, latestValue), [range, latestValue]);
  const chartId = `metric-${title.replace(/\s+/g, '').toLowerCase()}`;

  if (!isVisible) return null;

  const numeric = trendData.filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
  const minVal = numeric.length ? Math.min(...numeric) : 0;
  const maxVal = numeric.length ? Math.max(...numeric) : 1;
  const rangeBand = getRangeBand(range, minVal, maxVal);

  const toneColor = (tone?: MetricInsight['tone']) => {
    if (tone === 'positive') return '#22C55E';
    if (tone === 'negative') return '#F87171';
    return TEXT_TERTIARY;
  };

  const rangeLabel = formatRangeLabel(range);

  return (
    <Modal animationType="fade" transparent visible={isVisible} onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <BlurView intensity={24} style={StyleSheet.absoluteFill} tint="dark" />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />
        </Pressable>

        <View style={[styles.sheetWrap, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <View style={styles.headerTitle}>
                <View style={[styles.accentDot, { backgroundColor: accent }]} />
                <Text style={styles.headerText}>{title}</Text>
              </View>
              <Pressable style={styles.closeButton} onPress={onClose}>
                <Ionicons name="close" size={18} color={TEXT_TERTIARY} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
              <View style={styles.heroCard}>
                <LinearGradient
                  colors={[withAlpha(accent, '22'), 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <Text style={styles.heroTitle}>{title}</Text>
                <View style={styles.heroValueRow}>
                  <Text style={styles.heroValue}>{value}</Text>
                  {unit ? <Text style={styles.heroUnit}>{unit}</Text> : null}
                </View>
                {subtitle ? <Text style={styles.heroSubtitle}>{subtitle}</Text> : null}
                <View style={styles.heroMetaRow}>
                  <View style={styles.metaPill}>
                    <Ionicons name="calendar-outline" size={12} color={TEXT_SECONDARY} />
                    <Text style={styles.metaPillText}>Last 7 days</Text>
                  </View>
                  {rangeStatus ? (
                    <View
                      style={[
                        styles.metaPill,
                        {
                          borderColor: withAlpha(rangeStatus.color, '55'),
                          backgroundColor: withAlpha(rangeStatus.color, '22'),
                        },
                      ]}>
                      <View style={[styles.metaDot, { backgroundColor: rangeStatus.color }]} />
                      <Text style={[styles.metaPillText, { color: rangeStatus.color }]}>
                        {rangeStatus.label}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>

              {range ? (
                <View style={styles.sectionCard}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Goal range</Text>
                    {rangeLabel ? <Text style={styles.sectionValue}>{rangeLabel}</Text> : null}
                  </View>
                  {range.note ? <Text style={styles.sectionNote}>{range.note}</Text> : null}
                  {range.min != null && range.max != null && latestValue != null ? (
                    <View style={styles.rangeTrack}>
                      <View style={styles.rangeBase} />
                      <View
                        style={[
                          styles.rangeDot,
                          {
                            left: `${clamp(
                              ((latestValue - range.min) / (range.max - range.min || 1)) * 100,
                              0,
                              100
                            )}%`,
                            backgroundColor: accent,
                            borderColor: withAlpha(accent, '55'),
                          },
                        ]}
                      />
                    </View>
                  ) : null}
                </View>
              ) : null}

              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Weekly trend</Text>
                  <Text style={styles.sectionHint}>7 samples</Text>
                </View>
                <View style={styles.chartFrame}>
                  <View style={styles.chartGrid}>
                    <View style={styles.gridLine} />
                    <View style={styles.gridLine} />
                    <View style={styles.gridLine} />
                  </View>
                  {rangeBand && chartType !== 'line' ? (
                    <View style={[styles.rangeBand, { top: rangeBand.top, height: rangeBand.height }]} />
                  ) : null}
                  <View style={styles.chartBody}>
                    {chartType === 'dots' ? (
                      <View style={styles.dotsRow}>
                        {dotStates.map((filled, index) => (
                          <View
                            key={`${title}-dot-${index}`}
                            style={[
                              styles.dotItem,
                              {
                                borderColor: accent,
                                backgroundColor: filled ? accent : 'transparent',
                                opacity: filled ? 1 : 0.3,
                              },
                            ]}
                          />
                        ))}
                      </View>
                    ) : chartType === 'line' ? (
                      <Svg width={CHART_W} height={CHART_H}>
                        {linePath ? (
                          <>
                            <Defs>
                              <SvgLinearGradient id={`${chartId}-area`} x1="0" y1="0" x2="0" y2="1">
                                <Stop offset="0" stopColor={accent} stopOpacity="0.35" />
                                <Stop offset="1" stopColor={accent} stopOpacity="0" />
                              </SvgLinearGradient>
                            </Defs>
                            {rangeBand ? (
                              <Rect
                                x={0}
                                y={rangeBand.top}
                                width={CHART_W}
                                height={rangeBand.height}
                                fill={withAlpha(accent, '12')}
                              />
                            ) : null}
                            <Path d={linePath.area} fill={`url(#${chartId}-area)`} />
                            <Path
                              d={linePath.path}
                              stroke={accent}
                              strokeWidth={2.5}
                              fill="none"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <Circle cx={linePath.end.x} cy={linePath.end.y} r={4} fill={accent} />
                          </>
                        ) : null}
                      </Svg>
                    ) : (
                      <View style={chartType === 'ticks' ? styles.ticksRow : styles.barsRow}>
                        {barHeights.map((height, index) => (
                          <View
                            key={`${title}-bar-${index}`}
                            style={chartType === 'ticks' ? styles.tickTrack : styles.barTrack}>
                            <View
                              style={[
                                chartType === 'ticks' ? styles.tickFill : styles.barFill,
                                {
                                  height: clamp(height, MINI_BAR_MIN, MINI_BAR_MAX),
                                  backgroundColor: accent,
                                  opacity: chartType === 'ticks' ? 0.7 : 0.9,
                                },
                              ]}
                            />
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.chartLabels}>
                  {labels.map((label, index) => (
                    <Text key={`${title}-label-${index}`} style={styles.chartLabelText}>
                      {label}
                    </Text>
                  ))}
                </View>
              </View>

              {segments.length ? (
                <View style={styles.sectionCard}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Stage mix</Text>
                    <Text style={styles.sectionHint}>Last night</Text>
                  </View>
                  <View style={styles.segmentBar}>
                    {segments.map((segment) => (
                      <View
                        key={`${segment.label}-seg`}
                        style={[
                          styles.segmentFill,
                          {
                            backgroundColor: segment.color,
                            flex: segment.percent != null ? segment.percent : 1,
                          },
                        ]}
                      />
                    ))}
                  </View>
                  <View style={styles.segmentList}>
                    {segments.map((segment) => (
                      <View key={segment.label} style={styles.segmentRow}>
                        <View style={[styles.segmentDot, { backgroundColor: segment.color }]} />
                        <Text style={styles.segmentLabel}>{segment.label}</Text>
                        <Text style={styles.segmentValue}>{segment.value}</Text>
                        {typeof segment.percent === 'number' ? (
                          <Text style={styles.segmentPercent}>{segment.percent}%</Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {analysis ? (
                <View style={styles.sectionCard}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Summary</Text>
                    <Text style={styles.sectionHint}>Overview</Text>
                  </View>
                  <Text style={styles.bodyText}>{analysis}</Text>
                </View>
              ) : null}

              {insights.length ? (
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Highlights</Text>
                  <View style={styles.insightGrid}>
                    {insights.map((insight, index) => (
                      <View key={`${insight.title}-${index}`} style={styles.insightCard}>
                        <Text style={styles.insightTitle}>{insight.title}</Text>
                        <Text style={styles.insightValue}>{insight.value}</Text>
                        {insight.caption ? (
                          <Text style={[styles.insightCaption, { color: toneColor(insight.tone) }]}>
                            {insight.caption}
                          </Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {rows.length ? (
                <View style={styles.sectionCard}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Weekly breakdown</Text>
                    <Text style={styles.sectionHint}>Daily values</Text>
                  </View>
                  <View style={styles.rows}>
                    {rows.map((row, index) => (
                      <View key={`${row.label}-${index}`} style={styles.rowItem}>
                        <Text style={styles.rowLabel}>{row.label}</Text>
                        <Text style={styles.rowValue}>{row.value}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {recommendations.length ? (
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Suggestions</Text>
                  <View style={styles.recommendations}>
                    {recommendations.map((rec, index) => (
                      <View key={`${rec.title}-${index}`} style={styles.recommendationCard}>
                        <Text style={styles.recommendationTitle}>{rec.title}</Text>
                        <Text style={styles.recommendationDetail}>{rec.detail}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  sheetWrap: {
    paddingHorizontal: 16,
  },
  sheet: {
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    backgroundColor: SHEET_BG,
    borderWidth: 1,
    borderColor: BORDER,
    maxHeight: SCREEN_H * 0.9,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -8 },
    elevation: 18,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginTop: 12,
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerText: {
    color: TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: '700',
  },
  accentDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: BORDER,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  heroCard: {
    borderRadius: 24,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 18,
    overflow: 'hidden',
    marginBottom: 12,
  },
  heroTitle: {
    color: TEXT_TERTIARY,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  heroValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  heroValue: {
    color: TEXT_PRIMARY,
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  heroUnit: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    fontWeight: '600',
  },
  heroSubtitle: {
    marginTop: 6,
    color: TEXT_SECONDARY,
    fontSize: 14,
    fontWeight: '600',
  },
  heroMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  metaPillText: {
    color: TEXT_SECONDARY,
    fontSize: 12,
    fontWeight: '600',
  },
  metaDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
  },
  sectionCard: {
    borderRadius: 22,
    backgroundColor: CARD_ALT,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: '700',
  },
  sectionHint: {
    color: TEXT_TERTIARY,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sectionValue: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    fontWeight: '700',
  },
  sectionNote: {
    color: TEXT_TERTIARY,
    fontSize: 12,
    marginBottom: 10,
  },
  rangeTrack: {
    position: 'relative',
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  rangeBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  rangeDot: {
    position: 'absolute',
    top: -4,
    width: 16,
    height: 16,
    borderRadius: 999,
    borderWidth: 1,
    transform: [{ translateX: -8 }],
  },
  chartFrame: {
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  chartGrid: {
    ...StyleSheet.absoluteFillObject,
    paddingVertical: 18,
    justifyContent: 'space-between',
  },
  gridLine: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  rangeBand: {
    position: 'absolute',
    left: 12,
    right: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  chartBody: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: CHART_H,
    width: '100%',
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  barTrack: {
    width: 7,
    height: MINI_BAR_MAX,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
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
    gap: 8,
  },
  tickTrack: {
    width: 3,
    height: MINI_BAR_MAX,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
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
    gap: 10,
  },
  dotItem: {
    width: 12,
    height: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  chartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  chartLabelText: {
    color: TEXT_TERTIARY,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    width: 18,
  },
  segmentBar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: 12,
  },
  segmentFill: {
    height: '100%',
  },
  segmentList: {
    gap: 8,
  },
  segmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  segmentDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  segmentLabel: {
    color: TEXT_SECONDARY,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  segmentValue: {
    color: TEXT_PRIMARY,
    fontSize: 12,
    fontWeight: '700',
  },
  segmentPercent: {
    color: TEXT_TERTIARY,
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 6,
  },
  bodyText: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    lineHeight: 20,
  },
  insightGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  insightCard: {
    width: '48%',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  insightTitle: {
    color: TEXT_TERTIARY,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  insightValue: {
    color: TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: '700',
  },
  insightCaption: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
  },
  rows: {
    gap: 10,
  },
  rowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: BORDER,
  },
  rowLabel: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    fontWeight: '600',
  },
  rowValue: {
    color: TEXT_PRIMARY,
    fontSize: 13,
    fontWeight: '700',
  },
  recommendations: {
    gap: 10,
    marginTop: 10,
  },
  recommendationCard: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  recommendationTitle: {
    color: TEXT_PRIMARY,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  recommendationDetail: {
    color: TEXT_SECONDARY,
    fontSize: 12,
    lineHeight: 18,
  },
});
