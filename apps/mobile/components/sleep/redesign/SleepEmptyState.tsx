import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SLEEP_FONTS, SLEEP_LAYOUT, SLEEP_THEME } from '@constants';
import { CardSkeleton } from './SleepSkeletons';
import type { SleepEmptyStateProps } from '../../../types/sleep-ui';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function SleepEmptyState({ date, onAddData }: SleepEmptyStateProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const dateLabel = useMemo(
    () =>
      date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
    [date]
  );

  return (
    <View style={styles.container}>
      <View style={styles.messageWrap}>
        <Text style={styles.title}>No sleep data</Text>
        <Text style={styles.body}>
          We couldn&apos;t find a sleep record for {dateLabel}. Add one to unlock tonight&apos;s score and
          recovery details.
        </Text>
      </View>

      <AnimatedPressable
        onPressIn={() => {
          scale.value = withSpring(0.96, { damping: 15, stiffness: 200 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 15, stiffness: 200 });
        }}
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onAddData();
        }}
        style={[styles.cta, animatedStyle]}>
        <Text style={styles.ctaText}>Add Sleep Data</Text>
      </AnimatedPressable>

      <View style={styles.cards}>
        <CardSkeleton />
        <CardSkeleton />
        <View style={styles.stageShell}>
          <Text style={styles.stageTitle}>SLEEP STAGES</Text>
          <View style={styles.stagePlaceholder}>
            <Text style={styles.stageValue}>N/A</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: 12,
  },
  messageWrap: {
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  title: {
    marginBottom: 10,
    color: SLEEP_THEME.textPrimary,
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 24,
  },
  body: {
    color: SLEEP_THEME.textDisabled,
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  cta: {
    width: 220,
    height: 56,
    marginBottom: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SLEEP_THEME.textPrimary,
  },
  ctaText: {
    color: SLEEP_THEME.screenBg,
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 16,
  },
  cards: {
    width: '100%',
    gap: SLEEP_LAYOUT.cardGap,
  },
  stageShell: {
    backgroundColor: SLEEP_THEME.cardBg,
    borderRadius: SLEEP_LAYOUT.cardRadiusOuter,
    padding: SLEEP_LAYOUT.cardPadding,
    minHeight: 170,
  },
  stageTitle: {
    marginBottom: 18,
    color: SLEEP_THEME.textMuted1,
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  stagePlaceholder: {
    flex: 1,
    borderRadius: SLEEP_LAYOUT.cardRadiusInner,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SLEEP_THEME.elevatedBg,
  },
  stageValue: {
    color: SLEEP_THEME.textPrimary,
    opacity: 0.4,
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 32,
  },
});
