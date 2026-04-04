import { useEffect, useMemo, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  Keyframe,
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
const OVERLAY_LAYER_OPACITY = 0.35;
const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

const HERO_SLIDE_DIST = 28;
const HERO_SLIDE_IN_MS = 280;
const HERO_SLIDE_OUT_MS = 160;

function getHeroPreset(grade: string, isEmpty: boolean): HeroPreset {
  if (isEmpty) return SLEEP_THEME.heroGradePresets.Empty;
  return (
    SLEEP_THEME.heroGradePresets[grade as keyof typeof SLEEP_THEME.heroGradePresets] ??
    SLEEP_THEME.heroGradePresets.Empty
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
        <RadialGradient id={radialId} cx="18%" cy="9%" rx="112%" ry="118%" fx="18%" fy="9%">
          <Stop offset="0%" stopColor={preset.primary} stopOpacity={1} />
          <Stop offset="70%" stopColor={preset.mid} stopOpacity={1} />
          <Stop offset="100%" stopColor={preset.end} stopOpacity={1} />
        </RadialGradient>
        <SvgLinearGradient id={overlayId} x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={preset.overlayStart} stopOpacity={0.8} />
          <Stop offset="61%" stopColor={preset.overlayEnd} stopOpacity={0.1} />
        </SvgLinearGradient>
      </Defs>
      <Rect width="100%" height={SCREEN_HEIGHT} fill={`url(#${radialId})`} />
      <Rect
        width="100%"
        height={SCREEN_HEIGHT}
        fill={`url(#${overlayId})`}
        opacity={OVERLAY_LAYER_OPACITY}
      />
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
  const { instantTransitionRef, pagerScrollX, pageIndex, swipeDirection } = props;
  const isEmpty = props.score === undefined;
  const targetPreset = useMemo(() => getHeroPreset(props.grade, isEmpty), [props.grade, isEmpty]);

  // Settled preset — only updates after animation completes or on instant snap.
  const [settledPreset, setSettledPreset] = useState<HeroPreset>(targetPreset);
  const [overlayPreset, setOverlayPreset] = useState<HeroPreset>(targetPreset);
  const overlayOpacity = useSharedValue(0);

  // Adjacent presets for real-time drag blending.
  const prevPreset = useMemo(
    () => getHeroPreset(props.prevGrade, props.prevGrade === '--'),
    [props.prevGrade]
  );
  const nextPreset = useMemo(
    () => getHeroPreset(props.nextGrade, props.nextGrade === '--'),
    [props.nextGrade]
  );

  // renderedBase: normally the settled preset; snaps instantly to target on drag transitions
  // so the base updates on the same render cycle without waiting for useEffect.
  const renderedBase = useMemo(() => {
    if (instantTransitionRef.current) return targetPreset;
    return settledPreset;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settledPreset, targetPreset]);

  useEffect(() => {
    // Always consume the instant-transition flag so it doesn't persist to calendar selects.
    const isInstant = instantTransitionRef.current;
    if (isInstant) instantTransitionRef.current = false;

    if (samePreset(settledPreset, targetPreset)) return;

    if (isInstant) {
      // Drag-driven transition: base already shows the target (via renderedBase).
      // Just sync the settled state and cancel any in-flight withTiming.
      overlayOpacity.value = 0;
      setSettledPreset(targetPreset);
      return;
    }

    // Calendar-driven transition: smooth cross-fade.
    setOverlayPreset(targetPreset);
    overlayOpacity.value = 0;
    overlayOpacity.value = withTiming(
      1,
      { duration: 600, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (!finished) return;
        runOnJS(setSettledPreset)(targetPreset);
        overlayOpacity.value = 0;
      }
    );
  }, [settledPreset, overlayOpacity, targetPreset, instantTransitionRef]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  // Fresh Keyframe instance per (direction × date) — Reanimated requires a new object
  // each time to avoid treating the same reference as "already running" and skipping it.
  // No delay — old text fades out while new text simultaneously slides in.
  // The slide motion provides enough visual separation; a delay would create
  // a visible gap where neither text is visible (flash frame).
  const heroTextEntering = useMemo(() => {
    if (swipeDirection === 'right')
      return new Keyframe({
        0: { opacity: 0, transform: [{ translateX: HERO_SLIDE_DIST }] },
        100: { opacity: 1, transform: [{ translateX: 0 }] },
      }).duration(HERO_SLIDE_IN_MS);
    if (swipeDirection === 'left')
      return new Keyframe({
        0: { opacity: 0, transform: [{ translateX: -HERO_SLIDE_DIST }] },
        100: { opacity: 1, transform: [{ translateX: 0 }] },
      }).duration(HERO_SLIDE_IN_MS);
    return FadeIn.duration(HERO_SLIDE_IN_MS);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swipeDirection, props.selectedDate]);

  const heroFadeOut = useMemo(
    () => FadeOut.duration(HERO_SLIDE_OUT_MS),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.selectedDate]
  );

  const heroTextKey = `hero-${props.selectedDate.getTime()}`;

  // Real-time blend layers driven by the pager scroll position.
  // prevBlend fades in as the user drags right (going to yesterday).
  // nextBlend fades in as the user drags left (going to tomorrow).
  const prevBlendStyle = useAnimatedStyle(() => {
    const norm = pagerScrollX.value / SCREEN_WIDTH;
    return { opacity: Math.max(0, Math.min(1, pageIndex - norm)) };
  });
  const nextBlendStyle = useAnimatedStyle(() => {
    const norm = pagerScrollX.value / SCREEN_WIDTH;
    return { opacity: Math.max(0, Math.min(1, norm - pageIndex)) };
  });

  const dateLabel = props.selectedDate.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <View style={styles.hero}>
      {/* Layer 1 — settled / instant-snap base */}
      <View style={styles.gradientLayer} pointerEvents="none">
        <HeroGradientLayer preset={renderedBase} />
      </View>
      {/* Layer 2 — calendar cross-fade overlay (withTiming) */}
      <Animated.View style={[styles.gradientLayer, overlayStyle]} pointerEvents="none">
        <HeroGradientLayer preset={overlayPreset} />
      </Animated.View>
      {/* Layer 3 — previous day blend (drag-right gesture) */}
      <Animated.View style={[styles.gradientLayer, prevBlendStyle]} pointerEvents="none">
        <HeroGradientLayer preset={prevPreset} />
      </Animated.View>
      {/* Layer 4 — next day blend (drag-left gesture) */}
      <Animated.View style={[styles.gradientLayer, nextBlendStyle]} pointerEvents="none">
        <HeroGradientLayer preset={nextPreset} />
      </Animated.View>

      <View style={styles.content}>
        {props.isLoading ? (
          <>
            <HeroSkeleton />
            <ChartSkeleton />
          </>
        ) : (
          <>
            <Animated.View key={heroTextKey} entering={heroTextEntering} exiting={heroFadeOut}>
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
            </Animated.View>

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
  gradientLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT,
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
