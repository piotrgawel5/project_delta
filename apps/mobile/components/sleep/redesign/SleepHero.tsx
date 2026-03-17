import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { SLEEP_FONTS, SLEEP_LAYOUT, SLEEP_THEME } from '@constants';
import { formatDuration } from '@lib/sleepFormatters';
import { ChartSkeleton, HeroSkeleton } from './SleepSkeletons';
import WeeklySleepChart from './WeeklySleepChart';
import type { SleepHeroProps } from '../../../types/sleep-ui';

type HeroPreset = (typeof SLEEP_THEME.heroGradePresets)[keyof typeof SLEEP_THEME.heroGradePresets];

const BADGE_RADIUS = 18;
const DURATION_PILL_RADIUS = 18;

function getHeroPreset(grade: string, isEmpty: boolean): HeroPreset {
  if (isEmpty) return SLEEP_THEME.heroGradePresets.Empty;
  return (
    SLEEP_THEME.heroGradePresets[
      grade as keyof typeof SLEEP_THEME.heroGradePresets
    ] ?? SLEEP_THEME.heroGradePresets.Great
  );
}

function samePreset(a: HeroPreset, b: HeroPreset): boolean {
  return (
    a.primary === b.primary &&
    a.mid === b.mid &&
    a.end === b.end &&
    a.overlayStart === b.overlayStart &&
    a.overlayEnd === b.overlayEnd
  );
}

function HeroGradientLayer({ preset }: { preset: HeroPreset }) {
  const gradientId = `hero-gradient-${preset.primary.replace('#', '')}-${preset.mid.replace('#', '')}-${preset.end.replace('#', '')}`;

  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <RadialGradient id={gradientId} cx="18%" cy="9%" rx="112%" ry="118%" fx="18%" fy="9%">
          <Stop offset="0%" stopColor={preset.primary} stopOpacity={1} />
          <Stop offset="68%" stopColor={preset.mid} stopOpacity={0.92} />
          <Stop offset="100%" stopColor="#000000" stopOpacity={0} />
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
  if (weeklyDelta === null) return null;

  const isNeutral = weeklyDelta === 0;
  const isPositive = weeklyDelta > 0;
  const arrow = isPositive ? '↑' : '↓';
  const accentColor = isPositive ? '#49FF75' : '#FFC0CC';
  const bodyText = isNeutral
    ? 'In line with your weekly average'
    : `${Math.abs(weeklyDelta)}% ${isPositive ? 'better' : 'worse'} than your weekly average`;

  return (
    <View style={styles.badge}>
      {isNeutral ? null : <Text style={[styles.badgeArrow, { color: accentColor }]}>{arrow}</Text>}
      <Text style={styles.badgeText}>{bodyText}</Text>
    </View>
  );
}

function DurationChip({ durationMinutes }: { durationMinutes: number | null }) {
  if (!durationMinutes) return null;

  const { h, m } = formatDuration(durationMinutes);
  const label = m > 0 ? `${h}h ${`${m}`.padStart(2, '0')}m` : `${h}h`;

  return (
    <View style={styles.durationChip}>
      <Text style={styles.durationChipText}>{label}</Text>
    </View>
  );
}

export default function SleepHero(props: SleepHeroProps) {
  const isEmpty = props.score === undefined;
  const targetPreset = useMemo(() => getHeroPreset(props.grade, isEmpty), [props.grade, isEmpty]);
  const [basePreset, setBasePreset] = useState<HeroPreset>(targetPreset);
  const [overlayPreset, setOverlayPreset] = useState<HeroPreset>(targetPreset);
  const overlayOpacity = useSharedValue(0);

  useEffect(() => {
    if (samePreset(basePreset, targetPreset)) {
      return;
    }

    setOverlayPreset(targetPreset);
    overlayOpacity.value = 0;
    overlayOpacity.value = withTiming(
      1,
      {
        duration: 600,
        easing: Easing.out(Easing.cubic),
      },
      (finished) => {
        if (!finished) return;
        runOnJS(setBasePreset)(targetPreset);
        overlayOpacity.value = 0;
      }
    );
  }, [basePreset, overlayOpacity, targetPreset]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const dateLabel = props.selectedDate.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <View style={[styles.hero, { backgroundColor: basePreset.mid }]}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <HeroGradientLayer preset={basePreset} />
      </View>
      <Animated.View style={[StyleSheet.absoluteFill, overlayStyle]} pointerEvents="none">
        <HeroGradientLayer preset={overlayPreset} />
      </Animated.View>
      <LinearGradient
        pointerEvents="none"
        colors={[basePreset.overlayStart, 'rgba(255,255,255,0.01)', 'rgba(0,0,0,0)']}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.overlay}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.04)', 'rgba(0,0,0,0.1)']}
        locations={[0, 0.78, 1]}
        style={styles.vignette}
      />
      <Animated.View style={[StyleSheet.absoluteFill, overlayStyle]} pointerEvents="none">
        <LinearGradient
          pointerEvents="none"
          colors={[overlayPreset.overlayStart, 'rgba(255,255,255,0.01)', 'rgba(0,0,0,0)']}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.overlay}
        />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, overlayStyle]} pointerEvents="none">
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.04)', 'rgba(0,0,0,0.1)']}
          locations={[0, 0.78, 1]}
          style={styles.vignette}
        />
      </Animated.View>

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
              <Ionicons name="chevron-forward" size={12} color={SLEEP_THEME.textSecondary} />
            </Pressable>

            <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.grade, isEmpty && styles.emptyMetric]}>
              {props.grade}
            </Text>
            <ScoreRow score={props.score} />
            <Text style={[styles.description, isEmpty && styles.emptyMetric]}>{props.description}</Text>
            <WeeklyDeltaBadge weeklyDelta={props.weeklyDelta} />

            <View style={styles.chartMetaRow}>
              <View />
              <DurationChip durationMinutes={props.durationMinutes} />
            </View>

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
    opacity: 0.2,
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    flex: 1,
    paddingTop: SLEEP_LAYOUT.heroTextPaddingTop,
    paddingBottom: 8,
  },
  dateButton: {
    marginHorizontal: SLEEP_LAYOUT.heroTextPaddingH,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
  },
  dateText: {
    color: 'rgba(255,255,255,0.72)',
    fontFamily: SLEEP_FONTS.medium,
    fontSize: 14,
    lineHeight: 18,
  },
  grade: {
    marginHorizontal: SLEEP_LAYOUT.heroTextPaddingH,
    marginBottom: 6,
    color: SLEEP_THEME.textPrimary,
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 72,
    lineHeight: 76,
    letterSpacing: -2.8,
  },
  scoreRow: {
    marginHorizontal: SLEEP_LAYOUT.heroTextPaddingH,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  scoreValue: {
    color: SLEEP_THEME.textPrimary,
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 22,
    lineHeight: 26,
  },
  scoreSeparator: {
    color: 'rgba(255,255,255,0.7)',
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 18,
    lineHeight: 24,
  },
  description: {
    marginHorizontal: SLEEP_LAYOUT.heroTextPaddingH,
    marginBottom: 18,
    maxWidth: '82%',
    color: 'rgba(255,255,255,0.8)',
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 14,
    lineHeight: 19,
  },
  badge: {
    alignSelf: 'flex-start',
    marginLeft: SLEEP_LAYOUT.heroTextPaddingH,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: BADGE_RADIUS,
    backgroundColor: SLEEP_THEME.badgePillOverlay,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  badgeArrow: {
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 16,
    lineHeight: 18,
  },
  badgeText: {
    color: SLEEP_THEME.textPrimary,
    fontFamily: SLEEP_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  chartMetaRow: {
    marginHorizontal: SLEEP_LAYOUT.heroTextPaddingH,
    marginBottom: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  durationChip: {
    borderRadius: DURATION_PILL_RADIUS,
    backgroundColor: SLEEP_THEME.heroDurationPillBg,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  durationChipText: {
    color: SLEEP_THEME.heroDurationPillText,
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 13,
    lineHeight: 16,
  },
  chartArea: {
    marginTop: -2,
  },
  emptyMetric: {
    opacity: 0.4,
  },
});
