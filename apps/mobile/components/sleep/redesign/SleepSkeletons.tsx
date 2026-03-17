import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { SLEEP_LAYOUT, SLEEP_THEME } from '@constants';
import type { SleepSkeletonProps } from '../../../types/sleep-ui';

const CARD_HEIGHT = 164;
const STAGES_HEIGHT = 220;

type SkeletonWidth = number | `${number}%`;

function useShimmer() {
  const animation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(animation, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(animation, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    );

    loop.start();
    return () => {
      loop.stop();
    };
  }, [animation]);

  return animation.interpolate({
    inputRange: [0, 1],
    outputRange: [SLEEP_THEME.skeletonBase, SLEEP_THEME.skeletonHighlight],
  });
}

function SkeletonBlock({
  width,
  height,
  radius,
  style,
}: {
  width: SkeletonWidth;
  height: number;
  radius: number;
  style?: object;
}) {
  const backgroundColor = useShimmer();

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor,
        },
        style,
      ]}
    />
  );
}

export function HeroSkeleton({ visible = true }: SleepSkeletonProps) {
  if (!visible) return null;

  return (
    <View style={styles.hero}>
      <SkeletonBlock width="34%" height={18} radius={9} style={styles.heroDate} />
      <SkeletonBlock width="58%" height={64} radius={18} style={styles.heroGrade} />
      <SkeletonBlock width="42%" height={24} radius={12} style={styles.heroScore} />
      <SkeletonBlock width="74%" height={16} radius={8} style={styles.heroDescription} />
      <SkeletonBlock width="56%" height={16} radius={8} style={styles.heroDescriptionSecondary} />
    </View>
  );
}

export function ChartSkeleton({ visible = true }: SleepSkeletonProps) {
  if (!visible) return null;

  return (
    <View style={styles.chartWrap}>
      <SkeletonBlock width="100%" height={90} radius={28} />
      <View style={styles.chartLabels}>
        {Array.from({ length: 7 }).map((_, index) => (
          <SkeletonBlock key={index} width={12} height={12} radius={6} />
        ))}
      </View>
    </View>
  );
}

export function CardSkeleton({ visible = true }: SleepSkeletonProps) {
  if (!visible) return null;

  return (
    <View style={styles.card}>
      <SkeletonBlock width="28%" height={12} radius={6} style={styles.cardTitle} />
      <SkeletonBlock width="44%" height={42} radius={18} style={styles.cardMetric} />
      <SkeletonBlock width="82%" height={14} radius={7} style={styles.cardLine} />
      <SkeletonBlock width="66%" height={14} radius={7} />
    </View>
  );
}

export function FullScreenSkeleton({ visible = true }: SleepSkeletonProps) {
  if (!visible) return null;

  return (
    <View style={styles.fullScreen}>
      <HeroSkeleton />
      <ChartSkeleton />
      <CardSkeleton />
      <CardSkeleton />
      <View style={styles.stageCard}>
        <SkeletonBlock width="34%" height={12} radius={6} style={styles.cardTitle} />
        <SkeletonBlock width="100%" height={14} radius={7} style={styles.cardLine} />
        <SkeletonBlock width="92%" height={14} radius={7} style={styles.cardLine} />
        <SkeletonBlock width="76%" height={14} radius={7} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    gap: SLEEP_LAYOUT.cardGap,
  },
  hero: {
    paddingHorizontal: SLEEP_LAYOUT.heroTextPaddingH,
    paddingTop: SLEEP_LAYOUT.heroTextPaddingTop,
    paddingBottom: SLEEP_LAYOUT.cardPadding,
  },
  heroDate: {
    marginBottom: 18,
  },
  heroGrade: {
    marginBottom: 14,
  },
  heroScore: {
    marginBottom: 18,
  },
  heroDescription: {
    marginBottom: 10,
  },
  heroDescriptionSecondary: {
    marginBottom: 8,
  },
  chartWrap: {
    marginTop: -SLEEP_LAYOUT.chartOverlap,
    paddingHorizontal: SLEEP_LAYOUT.screenPaddingH,
    paddingBottom: 8,
  },
  chartLabels: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  card: {
    backgroundColor: SLEEP_THEME.cardBg,
    borderRadius: SLEEP_LAYOUT.cardRadiusOuter,
    padding: SLEEP_LAYOUT.cardPadding,
    minHeight: CARD_HEIGHT,
  },
  stageCard: {
    backgroundColor: SLEEP_THEME.cardBg,
    borderRadius: SLEEP_LAYOUT.cardRadiusOuter,
    padding: SLEEP_LAYOUT.cardPadding,
    minHeight: STAGES_HEIGHT,
  },
  cardTitle: {
    marginBottom: 18,
  },
  cardMetric: {
    marginBottom: 24,
  },
  cardLine: {
    marginBottom: 12,
  },
});
