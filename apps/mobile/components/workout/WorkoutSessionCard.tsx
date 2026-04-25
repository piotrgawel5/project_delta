import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { SLEEP_FONTS, SLEEP_LAYOUT, SLEEP_THEME, WORKOUT_THEME } from '@constants';
import { getSessionMuscles, getTotalSets } from '@lib/workoutAnalytics';
import type { WorkoutSession } from '@shared';

const SPRING = { damping: 18, stiffness: 280 } as const;
const MAX_MUSCLE_BADGES = 3;

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${seconds}s`;
}

interface WorkoutSessionCardProps {
  session: WorkoutSession;
  onPress?: () => void;
}

export default memo(function WorkoutSessionCard({ session, onPress }: WorkoutSessionCardProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const totalSets = useMemo(() => getTotalSets(session), [session]);
  const muscles = useMemo(() => getSessionMuscles(session).slice(0, MAX_MUSCLE_BADGES), [session]);
  const dateLabel = useMemo(() => formatDate(session.date), [session.date]);
  const duration = useMemo(() => formatDuration(session.durationSeconds), [session.durationSeconds]);

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPressIn={() => {
          scale.value = withSpring(0.98, SPRING);
        }}
        onPressOut={() => {
          scale.value = withSpring(1, SPRING);
        }}
        onPress={() => {
          if (onPress) {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onPress();
          }
        }}
        style={styles.card}>
        <View style={styles.accentBar} />
        <View style={styles.body}>
          <View style={styles.topRow}>
            <Text style={styles.dateLabel}>{dateLabel}</Text>
            {duration ? <Text style={styles.duration}>{duration}</Text> : null}
          </View>
          <Text style={styles.statsLine}>
            {session.exercises.length} {session.exercises.length === 1 ? 'exercise' : 'exercises'}
            {'  ·  '}
            {totalSets} {totalSets === 1 ? 'set' : 'sets'}
          </Text>
          {muscles.length > 0 && (
            <View style={styles.muscleRow}>
              {muscles.map((m) => (
                <View key={m} style={styles.muscleBadge}>
                  <Text style={styles.muscleBadgeText}>{m.replace('_', ' ')}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: SLEEP_THEME.cardBg,
    borderRadius: SLEEP_LAYOUT.cardRadiusOuter,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  accentBar: {
    width: 3,
    backgroundColor: WORKOUT_THEME.accent,
  },
  body: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateLabel: {
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 15,
    lineHeight: 20,
    color: SLEEP_THEME.textPrimary,
    textTransform: 'capitalize',
  },
  duration: {
    fontFamily: SLEEP_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
    color: SLEEP_THEME.textMuted1,
  },
  statsLine: {
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
    color: SLEEP_THEME.textMuted1,
  },
  muscleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  muscleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: SLEEP_LAYOUT.cardRadiusInner,
    backgroundColor: SLEEP_THEME.cardInset,
  },
  muscleBadgeText: {
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 11,
    lineHeight: 14,
    color: SLEEP_THEME.textMuted1,
    textTransform: 'capitalize',
  },
});
