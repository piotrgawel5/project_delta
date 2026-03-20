import { useEffect, useMemo, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { SLEEP_FONTS, SLEEP_LAYOUT, SLEEP_THEME } from '@constants';
import { ChartSkeleton, HeroSkeleton } from './SleepSkeletons';
import WeeklySleepChart from './WeeklySleepChart';
import type { SleepHeroProps } from '../../../types/sleep-ui';

type HeroPreset = (typeof SLEEP_THEME.heroGradePresets)[keyof typeof SLEEP_THEME.heroGradePresets];

const BADGE_RADIUS = 18;
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

function getHeroPreset(grade: string, isEmpty: boolean): HeroPreset {
  if (isEmpty) return SLEEP_THEME.heroGradePresets.Empty;
  return (
    SLEEP_THEME.heroGradePresets[grade as keyof typeof SLEEP_THEME.heroGradePresets] ??
    SLEEP_THEME.heroGradePresets.Great
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
  const radialId = `hero-radial-${preset.primary.replace('#', '')}-${preset.mid.replace('#', '')}-${preset.end.replace('#', '')}`;
  const overlayId = `hero-overlay-${preset.overlayStart.replace('#', '')}-${preset.overlayEnd.replace('#', '')}`;

  return (
    <Svg
      style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
      width="100%"
      height={SCREEN_HEIGHT}>
      <Defs>
        <RadialGradient id={radialId} cx="18%" cy="9%" rx="88%" ry="92%" fx="18%" fy="9%">
          <Stop offset="0%" stopColor={preset.primary} stopOpacity={1} />
          <Stop offset="70%" stopColor={preset.mid} stopOpacity={1} />
          <Stop offset="100%" stopColor="#000000" stopOpacity={1} />
        </RadialGradient>
        <SvgLinearGradient id={overlayId} x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={preset.overlayStart} stopOpacity={0.8} />
          <Stop offset="61%" stopColor="#000000" stopOpacity={0.1} />
        </SvgLinearGradient>
      </Defs>
      <Rect width="100%" height={SCREEN_HEIGHT} fill={`url(#${radialId})`} />
      <Rect width="100%" height={SCREEN_HEIGHT} fill={`url(#${overlayId})`} />
    </Svg>
  );
}

function ScoreRow({ score }: { score: number | undefined }) {
  const scoreLabel = score === undefined ? '--' : `${score}`;

  return (
    <View style={styles.scoreRow}>
      <Text style={[styles.scoreValue, score === undefined && styles.emptyMetric]}>
        {scoreLabel}
      </Text>
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
    <View style={styles.hero}>
      <View
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: SCREEN_HEIGHT }}
        pointerEvents="none">
        <HeroGradientLayer preset={basePreset} />
      </View>
      <Animated.View
        style={[
          { position: 'absolute', top: 0, left: 0, right: 0, height: SCREEN_HEIGHT },
          overlayStyle,
        ]}
        pointerEvents="none">
        <HeroGradientLayer preset={overlayPreset} />
      </Animated.View>

      <View style={styles.content}>
        {props.isLoading ? (
          <>
            <HeroSkeleton />
            <ChartSkeleton />
          </>
        ) : (
          <>
            <Pressable
              disabled={!props.onPressDate}
              onPress={props.onPressDate}
              style={styles.dateButton}>
              <Text style={styles.dateText}>{dateLabel}</Text>
              <Ionicons name="chevron-forward" size={12} color={SLEEP_THEME.textSecondary} />
            </Pressable>

            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[styles.grade, isEmpty && styles.emptyMetric]}>
              {props.grade}
            </Text>
            <ScoreRow score={props.score} />
            <Text style={[styles.description, isEmpty && styles.emptyMetric]}>
              {props.description}
            </Text>
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
    overflow: 'visible',
    backgroundColor: 'transparent',
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
  chartArea: {
    marginTop: -2,
  },
  emptyMetric: {
    opacity: 0.4,
  },
});
