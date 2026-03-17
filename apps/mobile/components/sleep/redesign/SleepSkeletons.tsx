import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { SLEEP_LAYOUT, SLEEP_THEME } from '@constants';
import type { SleepSkeletonProps } from '../../../types/sleep-ui';

const CARD_HEIGHT = 172;
const STAGES_HEIGHT = 188;

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
      <SkeletonBlock width="62%" height={74} radius={22} style={styles.heroGrade} />
      <SkeletonBlock width="36%" height={28} radius={12} style={styles.heroScore} />
      <SkeletonBlock width="78%" height={18} radius={9} style={styles.heroDescription} />
      <SkeletonBlock width="58%" height={18} radius={9} style={styles.heroDescriptionSecondary} />
      <View style={styles.heroBadgeRow}>
        <SkeletonBlock width="54%" height={34} radius={17} />
        <SkeletonBlock width="18%" height={34} radius={17} />
      </View>
    </View>
  );
}

export function ChartSkeleton({ visible = true }: SleepSkeletonProps) {
  if (!visible) return null;

  return (
    <View style={styles.chartWrap}>
      <SkeletonBlock width="100%" height={96} radius={30} />
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
      <SkeletonBlock width="46%" height={50} radius={18} style={styles.cardMetric} />
      <SkeletonBlock width="82%" height={14} radius={7} style={styles.cardLine} />
      <SkeletonBlock width="66%" height={14} radius={7} style={styles.cardLineTight} />
      <SkeletonBlock width="100%" height={8} radius={4} />
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
        <SkeletonBlock width="100%" height={116} radius={14} />
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
    marginBottom: 12,
  },
  heroScore: {
    marginBottom: 16,
  },
  heroDescription: {
    marginBottom: 10,
  },
  heroDescriptionSecondary: {
    marginBottom: 14,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  chartWrap: {
    marginTop: -8,
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
    marginBottom: 18,
  },
  cardLine: {
    marginBottom: 12,
  },
  cardLineTight: {
    marginBottom: 16,
  },
});
