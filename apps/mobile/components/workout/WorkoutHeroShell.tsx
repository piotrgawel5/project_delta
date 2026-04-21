import { memo, useCallback, useMemo } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { useRouter } from 'expo-router';
import { SLEEP_FONTS, SLEEP_LAYOUT, SLEEP_THEME, WORKOUT_THEME } from '@constants';
import type { MuscleGroup, MuscleIntensity } from '@shared';
import { MuscleHeatmapCompact } from '@components/workout/muscleMap';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface WorkoutHeroShellProps {
  totalSets: number;
  weeklyDelta: number | null;
  selectedDate: Date;
  heatmap: Record<MuscleGroup, MuscleIntensity>;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });
}

const HeroBackground = memo(function HeroBackground() {
  const radialId = 'workout-hero-radial';
  const overlayId = 'workout-hero-overlay';

  return (
    <Svg
      width={SCREEN_WIDTH}
      height={SLEEP_LAYOUT.heroHeight}
      style={StyleSheet.absoluteFill}
      pointerEvents="none">
      <Defs>
        <RadialGradient
          id={radialId}
          cx="72%"
          cy="18%"
          rx="65%"
          ry="55%"
          gradientUnits="userSpaceOnUse">
          <Stop offset="0%" stopColor={WORKOUT_THEME.heroGradientPrimary} stopOpacity="1" />
          <Stop offset="70%" stopColor={WORKOUT_THEME.heroGradientMid} stopOpacity="1" />
          <Stop offset="100%" stopColor={WORKOUT_THEME.heroGradientEnd} stopOpacity="1" />
        </RadialGradient>
        <SvgLinearGradient id={overlayId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={WORKOUT_THEME.heroOverlayStart} />
          <Stop offset="61%" stopColor={WORKOUT_THEME.heroOverlayEnd} />
        </SvgLinearGradient>
      </Defs>
      <Rect width={SCREEN_WIDTH} height={SLEEP_LAYOUT.heroHeight} fill={`url(#${radialId})`} />
      <Rect width={SCREEN_WIDTH} height={SLEEP_LAYOUT.heroHeight} fill={`url(#${overlayId})`} />
    </Svg>
  );
});

export default function WorkoutHeroShell({
  totalSets,
  weeklyDelta,
  selectedDate,
  heatmap,
}: WorkoutHeroShellProps) {
  const router = useRouter();
  const dateLabel = useMemo(() => formatDate(selectedDate), [selectedDate]);
  const handleMapPress = useCallback(() => {
    router.push('/workout/progress');
  }, [router]);

  const deltaLabel = useMemo(() => {
    if (weeklyDelta === null) return null;
    if (weeklyDelta === 0) return null;
    return weeklyDelta > 0 ? `+${weeklyDelta} sets` : `${weeklyDelta} sets`;
  }, [weeklyDelta]);

  const deltaIsPositive = weeklyDelta !== null && weeklyDelta > 0;

  return (
    <View style={styles.container}>
      <HeroBackground />

      <View style={styles.content}>
        <View style={styles.left}>
          <Text style={styles.dateLabel}>{dateLabel}</Text>

          <View style={styles.volumeRow}>
            <Text style={styles.volumeNumber}>{totalSets}</Text>
            <Text style={styles.volumeUnit}>sets</Text>
          </View>

          <Text style={styles.volumeSubtitle}>this week</Text>

          {deltaLabel !== null && (
            <View
              style={[
                styles.deltaPill,
                deltaIsPositive ? styles.deltaPillPositive : styles.deltaPillNegative,
              ]}>
              <Text
                style={[
                  styles.deltaText,
                  deltaIsPositive ? styles.deltaTextPositive : styles.deltaTextNegative,
                ]}>
                {deltaLabel}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.right}>
          <MuscleHeatmapCompact heatmap={heatmap} onPress={handleMapPress} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: SLEEP_LAYOUT.heroHeight,
    backgroundColor: SLEEP_THEME.screenBg,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: SLEEP_LAYOUT.heroTextPaddingH,
    paddingBottom: 28,
    paddingTop: SLEEP_LAYOUT.heroTextPaddingTop,
  },
  left: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  right: {
    width: 120,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  dateLabel: {
    fontFamily: SLEEP_FONTS.medium,
    fontSize: 13,
    lineHeight: 16,
    color: SLEEP_THEME.textMuted1,
    marginBottom: 8,
    textTransform: 'capitalize',
  },
  volumeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  volumeNumber: {
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 72,
    lineHeight: 72,
    color: SLEEP_THEME.textPrimary,
    letterSpacing: -2,
  },
  volumeUnit: {
    fontFamily: SLEEP_FONTS.medium,
    fontSize: 18,
    lineHeight: 24,
    color: SLEEP_THEME.textSecondary,
    marginBottom: 10,
  },
  volumeSubtitle: {
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 14,
    lineHeight: 18,
    color: SLEEP_THEME.textMuted1,
    marginTop: 2,
    marginBottom: 12,
  },
  deltaPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  deltaPillPositive: {
    backgroundColor: WORKOUT_THEME.accentDim,
  },
  deltaPillNegative: {
    backgroundColor: SLEEP_THEME.lowPillBg,
  },
  deltaText: {
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 13,
    lineHeight: 16,
  },
  deltaTextPositive: {
    color: WORKOUT_THEME.accent,
  },
  deltaTextNegative: {
    color: SLEEP_THEME.danger,
  },
});
