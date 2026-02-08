import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Dimensions, ScrollView } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
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
  rows?: MetricDetailRow[];
  chartType?: ChartType;
  dotThreshold?: number;
  insights?: MetricInsight[];
  recommendations?: MetricRecommendation[];
}

const { width: SCREEN_W } = Dimensions.get('window');
const SHEET_RADIUS = 30;
const BG = '#000000';
const SURFACE = '#0B0B0D';
const TEXT_PRIMARY = '#F5F6F7';
const TEXT_SECONDARY = 'rgba(255,255,255,0.7)';
const TEXT_TERTIARY = 'rgba(255,255,255,0.5)';
const STROKE = 'rgba(255,255,255,0.08)';
const MINI_BAR_MAX = 42;
const MINI_BAR_MIN = 8;
const CHART_W = SCREEN_W - 80;
const CHART_H = 60;

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

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
  return { path, area, end: points[points.length - 1] };
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
  rows = [],
  chartType = 'line',
  dotThreshold = 0,
  insights = [],
  recommendations = [],
}: MetricDetailSheetProps) => {
  const insets = useSafeAreaInsets();
  const barHeights = useMemo(() => buildBarHeights(trend), [trend]);
  const linePath = useMemo(() => buildLinePath(trend), [trend]);
  const dotStates = useMemo(
    () =>
      trend.map((v) =>
        typeof v === 'number' && !Number.isNaN(v) ? v >= dotThreshold : false
      ),
    [trend, dotThreshold]
  );

  if (!isVisible) return null;
  const chartId = `metric-${title.replace(/\s+/g, '').toLowerCase()}`;

  const toneColor = (tone?: MetricInsight['tone']) => {
    if (tone === 'positive') return '#22C55E';
    if (tone === 'negative') return '#F87171';
    return TEXT_TERTIARY;
  };

  return (
    <Modal animationType="none" transparent visible={isVisible} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }]} />
      </Pressable>

      <View style={styles.sheetWrapper}>
        <View style={[styles.sheet, { paddingBottom: 28 + insets.bottom }]}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.headerTitle}>
              <View style={[styles.accentDot, { backgroundColor: accent }]} />
              <Text style={styles.title}>{title}</Text>
            </View>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={18} color={TEXT_TERTIARY} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}>
            <View style={styles.heroRow}>
              <View>
                <View style={styles.valueRow}>
                  <Text style={styles.valueText}>{value}</Text>
                  {unit ? <Text style={styles.unitText}>{unit}</Text> : null}
                </View>
                {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>7-Day View</Text>
              </View>
            </View>

            {analysis ? (
              <View style={styles.analysisCard}>
                <Text style={styles.sectionTitle}>Analysis</Text>
                <Text style={styles.analysisText}>{analysis}</Text>
              </View>
            ) : null}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Weekly Trend</Text>
              <View style={styles.chartCard}>
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
                        <Defs>
                          <LinearGradient id={`${chartId}-area`} x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0" stopColor={accent} stopOpacity="0.35" />
                            <Stop offset="1" stopColor={accent} stopOpacity="0" />
                          </LinearGradient>
                        </Defs>
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
                              opacity: chartType === 'ticks' ? 0.7 : 0.85,
                            },
                          ]}
                        />
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>

            {insights.length ? (
              <View style={styles.section}>
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
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Detailed Analysis</Text>
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
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recommendations</Text>
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
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  sheetWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    backgroundColor: BG,
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    borderWidth: 1,
    borderColor: STROKE,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    maxHeight: '92%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  accentDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  title: {
    color: TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: STROKE,
    backgroundColor: SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  valueText: {
    color: TEXT_PRIMARY,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  unitText: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    fontWeight: '600',
  },
  subtitle: {
    marginTop: 4,
    color: TEXT_TERTIARY,
    fontSize: 13,
    fontWeight: '600',
  },
  scrollContent: {
    paddingBottom: 10,
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: STROKE,
    backgroundColor: SURFACE,
  },
  badgeText: {
    color: TEXT_TERTIARY,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  chartCard: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: STROKE,
    alignItems: 'center',
    justifyContent: 'center',
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
    gap: 8,
  },
  dotItem: {
    width: 12,
    height: 12,
    borderRadius: 999,
    borderWidth: 1,
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
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: STROKE,
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
  insightGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  insightCard: {
    width: '48%',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: STROKE,
    backgroundColor: SURFACE,
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
  recommendations: {
    gap: 10,
  },
  recommendationCard: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: STROKE,
    backgroundColor: SURFACE,
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
  analysisCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: STROKE,
    backgroundColor: SURFACE,
    padding: 12,
    marginBottom: 16,
  },
  analysisText: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    lineHeight: 20,
  },
});
