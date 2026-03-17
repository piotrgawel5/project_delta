import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { SLEEP_FONTS, SLEEP_LAYOUT, SLEEP_THEME } from '@constants';
import { getHeroGradientStops } from '@lib/sleepWeeklyInsights';
import { useSleepGradient } from '@lib/useSleepGradient';
import { ChartSkeleton, HeroSkeleton } from './SleepSkeletons';
import WeeklySleepChart from './WeeklySleepChart';
import type { SleepHeroProps } from '../../../types/sleep-ui';

const BADGE_RADIUS = 20;
const EMPTY_PRIMARY = SLEEP_THEME.elevatedBg;
const EMPTY_MID = SLEEP_THEME.cardBg;
const EMPTY_END = SLEEP_THEME.screenBg;

function HeroGradientLayer({
  primary,
  mid,
  end,
}: {
  primary: string;
  mid: string;
  end: string;
}) {
  const gradientId = `hero-gradient-${primary.replace('#', '')}-${mid.replace('#', '')}-${end.replace('#', '')}`;

  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <RadialGradient id={gradientId} cx="50%" cy="0%" rx="75%" ry="100%">
          <Stop offset="0%" stopColor={primary} stopOpacity={1} />
          <Stop offset="70%" stopColor={mid} stopOpacity={1} />
          <Stop offset="100%" stopColor={end} stopOpacity={1} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
    </Svg>
  );
}

function ScoreRow({ score }: { score: number | undefined }) {
  const scoreLabel = score === undefined ? '--' : `${score}`;

  return (
    <View style={styles.scoreRow}>
      <Text style={[styles.scoreValue, score === undefined && styles.emptyMetric]}>{scoreLabel}</Text>
      <Text style={[styles.scoreSeparator, score === undefined && styles.emptyMetric]}> / </Text>
      <Text style={[styles.scoreValue, score === undefined && styles.emptyMetric]}>100</Text>
    </View>
  );
}

function WeeklyDeltaBadge({ weeklyDelta }: { weeklyDelta: number | null }) {
  if (weeklyDelta === null || weeklyDelta === 0) return null;

  const isPositive = weeklyDelta > 0;
  const arrow = isPositive ? '↑' : '↓';
  const color = isPositive ? SLEEP_THEME.success : SLEEP_THEME.danger;
  const direction = isPositive ? 'better' : 'worse';

  return (
    <View style={styles.badge}>
      <Text style={[styles.badgeText, { color }]}>
        {arrow} {Math.abs(weeklyDelta)}% {direction} than your weekly average
      </Text>
    </View>
  );
}

export default function SleepHero(props: SleepHeroProps) {
  const isEmpty = props.score === undefined;
  const initialKey = isEmpty ? EMPTY_PRIMARY : props.gradeColor;
  const { gradientBase, overlayAColor, overlayBColor, overlayAOpacity, overlayBOpacity, setGradientKey } =
    useSleepGradient({
      initialKey,
      defaultColor: isEmpty ? EMPTY_PRIMARY : getHeroGradientStops(props.gradeColor).primary,
      getColorForKey: (key) => {
        if (key === EMPTY_PRIMARY) return EMPTY_PRIMARY;
        return getHeroGradientStops(key).primary;
      },
    });

  useEffect(() => {
    setGradientKey(isEmpty ? EMPTY_PRIMARY : props.gradeColor, true);
  }, [isEmpty, props.gradeColor, setGradientKey]);

  const overlayAStyle = useAnimatedStyle(() => ({
    opacity: overlayAOpacity.value,
  }));
  const overlayBStyle = useAnimatedStyle(() => ({
    opacity: overlayBOpacity.value,
  }));

  const baseStops = isEmpty
    ? { primary: gradientBase, mid: EMPTY_MID, end: EMPTY_END }
    : { primary: gradientBase, mid: SLEEP_THEME.heroGradientMid, end: SLEEP_THEME.heroGradientEnd };
  const overlayAStops = isEmpty
    ? { primary: overlayAColor, mid: EMPTY_MID, end: EMPTY_END }
    : { primary: overlayAColor, mid: SLEEP_THEME.heroGradientMid, end: SLEEP_THEME.heroGradientEnd };
  const overlayBStops = isEmpty
    ? { primary: overlayBColor, mid: EMPTY_MID, end: EMPTY_END }
    : { primary: overlayBColor, mid: SLEEP_THEME.heroGradientMid, end: SLEEP_THEME.heroGradientEnd };
  const dateLabel = props.selectedDate.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <View style={styles.hero}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <HeroGradientLayer {...baseStops} />
      </View>
      <Animated.View style={[StyleSheet.absoluteFill, overlayAStyle]} pointerEvents="none">
        <HeroGradientLayer {...overlayAStops} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, overlayBStyle]} pointerEvents="none">
        <HeroGradientLayer {...overlayBStops} />
      </Animated.View>
      <LinearGradient
        pointerEvents="none"
        colors={[SLEEP_THEME.heroOverlayStart, SLEEP_THEME.heroOverlayEnd]}
        locations={[0, 0.61]}
        style={styles.overlay}
      />

      <View style={styles.content}>
        {props.isLoading ? (
          <>
            <HeroSkeleton />
            <ChartSkeleton />
          </>
        ) : (
          <>
            <Pressable disabled={!props.onPressDate} onPress={props.onPressDate} style={styles.dateButton}>
              <Text style={styles.dateText}>{dateLabel}</Text>
              <Ionicons name="chevron-forward" size={16} color={SLEEP_THEME.textSecondary} />
            </Pressable>

            <Text style={[styles.grade, isEmpty && styles.emptyMetric]}>{props.grade}</Text>
            <ScoreRow score={props.score} />
            <Text style={[styles.description, isEmpty && styles.emptyMetric]}>{props.description}</Text>
            <WeeklyDeltaBadge weeklyDelta={props.weeklyDelta} />

            <View style={styles.chartArea}>
              <WeeklySleepChart
                data={props.chartData}
                todayIndex={props.todayIndex}
                targetMinutes={props.targetMinutes}
              />
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    height: SLEEP_LAYOUT.heroHeight,
    overflow: 'hidden',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.35,
  },
  content: {
    flex: 1,
    paddingTop: SLEEP_LAYOUT.heroTextPaddingTop,
  },
  dateButton: {
    marginHorizontal: SLEEP_LAYOUT.heroTextPaddingH,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
  },
  dateText: {
    color: SLEEP_THEME.textSecondary,
    fontFamily: SLEEP_FONTS.medium,
    fontSize: 14,
  },
  grade: {
    marginHorizontal: SLEEP_LAYOUT.heroTextPaddingH,
    marginBottom: 6,
    color: SLEEP_THEME.textPrimary,
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 72,
    lineHeight: 74,
  },
  scoreRow: {
    marginHorizontal: SLEEP_LAYOUT.heroTextPaddingH,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  scoreValue: {
    color: SLEEP_THEME.textPrimary,
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 22,
  },
  scoreSeparator: {
    color: SLEEP_THEME.textSecondary,
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 18,
  },
  description: {
    marginHorizontal: SLEEP_LAYOUT.heroTextPaddingH,
    marginBottom: 14,
    color: SLEEP_THEME.textSecondary,
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  badge: {
    alignSelf: 'flex-start',
    marginLeft: SLEEP_LAYOUT.heroTextPaddingH,
    marginBottom: 18,
    borderRadius: BADGE_RADIUS,
    backgroundColor: SLEEP_THEME.badgePillBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeText: {
    fontFamily: SLEEP_FONTS.medium,
    fontSize: 13,
  },
  chartArea: {
    marginTop: -SLEEP_LAYOUT.chartOverlap,
  },
  emptyMetric: {
    opacity: 0.4,
  },
});
