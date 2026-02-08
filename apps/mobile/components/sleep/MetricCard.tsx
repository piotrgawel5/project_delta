import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

type MetricStatus = 'up' | 'down' | 'neutral';

type TrendValue = number | null | undefined;

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
const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export type MetricCardProps = {
  label: string;
  value: string;
  unit?: string;
  status?: MetricStatus;
  subLabel?: string;
  accent?: string;
  trend?: TrendValue[];
  chartType?: 'bars' | 'dots';
  dotThreshold?: number;
  onPress?: () => void;
};

const padToSeven = (values: TrendValue[]) => {
  if (values.length >= 7) return values.slice(-7);
  return Array(7 - values.length).fill(null).concat(values);
};

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

export default function MetricCard({
  label,
  value,
  unit,
  status = 'neutral',
  subLabel,
  accent,
  trend,
  chartType = 'bars',
  dotThreshold = 0,
  onPress,
}: MetricCardProps) {
  const meta = STATUS_META[status];
  const accentColor = accent ?? meta.color;

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
            <View style={[styles.dot, { backgroundColor: accentColor }]} />
            <Text style={styles.label} numberOfLines={1}>
              {label}
            </Text>
          </View>
          <View style={styles.todayRow}>
            <Text style={styles.todayText}>Today</Text>
            <Ionicons name="chevron-forward" size={14} color={TEXT_TERTIARY} />
          </View>
        </View>

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

            <View style={styles.daysRow}>
              {DAYS.map((day, index) => (
                <Text key={`${label}-day-${index}`} style={styles.dayText}>
                  {day}
                </Text>
              ))}
            </View>
          </View>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  cardGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: CARD_RADIUS,
  },
  card: {
    width: '100%',
    borderRadius: CARD_RADIUS,
    paddingHorizontal: 18,
    paddingVertical: 14,
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
    minWidth: 140,
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
});
