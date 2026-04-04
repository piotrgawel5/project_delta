import { useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { AGE_NORMS, SLEEP_FONTS, SLEEP_LAYOUT, SLEEP_THEME } from '@constants';
import { formatDuration } from '@lib/sleepFormatters';
import type { DeepSleepZone, SleepCardDeepProps } from '../../../types/sleep-ui';

const DEEP_FAIR_THRESHOLD = 0.13;
const DEEP_GREAT_THRESHOLD = AGE_NORMS['18-25'].deepPctIdeal / 100;
const DEEP_VISUAL_CAP = 0.35;
const INDICATOR_SIZE = 16;

function getZone(deepPct: number | null): DeepSleepZone {
  if (deepPct === null) return 'nodata';
  if (deepPct < DEEP_FAIR_THRESHOLD) return 'low';
  if (deepPct >= DEEP_GREAT_THRESHOLD) return 'great';
  return 'fair';
}

function getCopy(zone: DeepSleepZone): string {
  switch (zone) {
    case 'great':
      return 'Your body spent good time in deep recovery tonight.';
    case 'fair':
      return 'You got some restorative sleep. Aim for more deep sleep.';
    case 'low':
      return 'Deep sleep was below target tonight. Avoid screens before bed.';
    default:
      return 'No deep sleep data available for this night.';
  }
}

function getStatus(zone: DeepSleepZone) {
  switch (zone) {
    case 'great':
      return {
        label: 'On Track',
        backgroundColor: SLEEP_THEME.onTrackPillBg,
        textColor: SLEEP_THEME.onTrackPillText,
      };
    case 'fair':
      return {
        label: 'Improving',
        backgroundColor: 'rgba(255,159,10,0.15)',
        textColor: SLEEP_THEME.warning,
      };
    case 'low':
      return {
        label: 'Low',
        backgroundColor: SLEEP_THEME.lowPillBg,
        textColor: SLEEP_THEME.lowPillText,
      };
    default:
      return {
        label: 'No Data',
        backgroundColor: 'rgba(255,255,255,0.10)',
        textColor: 'rgba(255,255,255,0.64)',
      };
    }
}

function mapDeepPctToBarRatio(deepPct: number): number {
  const clamped = Math.max(0, Math.min(DEEP_VISUAL_CAP, deepPct));
  if (clamped < DEEP_FAIR_THRESHOLD) {
    return (clamped / DEEP_FAIR_THRESHOLD) * (1 / 3);
  }
  if (clamped < DEEP_GREAT_THRESHOLD) {
    const fairSpan = DEEP_GREAT_THRESHOLD - DEEP_FAIR_THRESHOLD || 1;
    return 1 / 3 + ((clamped - DEEP_FAIR_THRESHOLD) / fairSpan) * (1 / 3);
  }
  const greatSpan = DEEP_VISUAL_CAP - DEEP_GREAT_THRESHOLD || 1;
  return 2 / 3 + ((clamped - DEEP_GREAT_THRESHOLD) / greatSpan) * (1 / 3);
}

function formatDeepValue(minutes: number | null) {
  if (minutes === null) {
    return { main: 'N/A', suffix: '' };
  }

  const { h, m } = formatDuration(minutes);
  if (h > 0 && m > 0) {
    return { main: `${h}h ${`${m}`.padStart(2, '0')}`, suffix: 'm' };
  }
  if (h > 0) {
    return { main: `${h}`, suffix: 'h' };
  }
  return { main: `${m}`, suffix: 'm' };
}

const AnimatedView = Animated.createAnimatedComponent(View);

export default function SleepCardDeep({ deepMinutes, totalMinutes }: SleepCardDeepProps) {
  const deepPct = totalMinutes && deepMinutes !== null ? deepMinutes / totalMinutes : null;
  const zone = getZone(deepPct);
  const status = getStatus(zone);
  const { main, suffix } = useMemo(() => formatDeepValue(deepMinutes), [deepMinutes]);
  const [barWidth, setBarWidth] = useState(0);
  const indicatorX = useSharedValue(0);

  const clampedIndicatorX = useMemo(() => {
    if (!barWidth || deepPct === null) return 0;
    const barRatio = mapDeepPctToBarRatio(deepPct);
    const raw = barWidth * barRatio;
    return Math.max(INDICATOR_SIZE / 2, Math.min(barWidth - INDICATOR_SIZE / 2, raw));
  }, [barWidth, deepPct]);

  useEffect(() => {
    indicatorX.value = withTiming(Math.max(0, clampedIndicatorX - INDICATOR_SIZE / 2), {
      duration: 400,
      easing: Easing.out(Easing.cubic),
    });
  }, [clampedIndicatorX, indicatorX]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
  }));

  const handleBarLayout = (event: LayoutChangeEvent) => {
    setBarWidth(event.nativeEvent.layout.width);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>DEEP SLEEP</Text>

      <View style={styles.metricRow}>
        <Text style={[styles.metricMain, deepMinutes === null && styles.metricMissing]}>{main}</Text>
        {suffix ? (
          <Text style={[styles.metricSuffix, deepMinutes === null && styles.metricMissing]}>
            {suffix}
          </Text>
        ) : null}
      </View>

      <Text style={styles.copy}>{getCopy(zone)}</Text>

      <View style={styles.barWrap} onLayout={handleBarLayout}>
        <LinearGradient
          colors={[SLEEP_THEME.zoneBarLow, SLEEP_THEME.zoneBarFair, SLEEP_THEME.zoneBarGreat]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.bar}
        />
        <AnimatedView style={[styles.indicator, indicatorStyle]} />
      </View>

      <View style={styles.zoneLabels}>
        <Text style={styles.zoneText}>Low</Text>
        <Text style={styles.zoneText}>Fair</Text>
        <Text style={styles.zoneText}>Great</Text>
      </View>

      <View style={styles.statusRow}>
        <View style={[styles.statusPill, { backgroundColor: status.backgroundColor }]}>
          <Text style={[styles.statusText, { color: status.textColor }]}>{status.label}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: SLEEP_THEME.cardBg,
    borderRadius: SLEEP_LAYOUT.cardRadiusOuter,
    padding: SLEEP_LAYOUT.cardPadding,
  },
  title: {
    marginBottom: 14,
    color: SLEEP_THEME.textMuted1,
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 11,
    letterSpacing: 0.7,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  metricMain: {
    color: SLEEP_THEME.textPrimary,
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: -1.1,
  },
  metricSuffix: {
    marginLeft: 4,
    marginBottom: 4,
    color: 'rgba(255,255,255,0.82)',
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 18,
    lineHeight: 20,
  },
  metricMissing: {
    opacity: 0.4,
  },
  copy: {
    marginBottom: 16,
    color: 'rgba(255,255,255,0.46)',
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 12,
    lineHeight: 16,
  },
  barWrap: {
    justifyContent: 'center',
    marginBottom: 8,
  },
  bar: {
    height: 8,
    borderRadius: 999,
  },
  indicator: {
    position: 'absolute',
    top: -4,
    width: INDICATOR_SIZE,
    height: INDICATOR_SIZE,
    borderRadius: INDICATOR_SIZE / 2,
    backgroundColor: '#DADDE2',
    shadowColor: SLEEP_THEME.screenBg,
    shadowOpacity: 0.24,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  zoneLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  zoneText: {
    color: 'rgba(255,255,255,0.3)',
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 11,
    lineHeight: 14,
  },
  statusRow: {
    alignItems: 'flex-end',
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  statusText: {
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 11,
    lineHeight: 13,
  },
});
