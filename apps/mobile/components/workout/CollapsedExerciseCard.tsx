import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { WorkoutSet } from '@shared';
import { SLEEP_FONTS, WORKOUT_THEME, tabularStyle } from '@constants';
import { getExerciseById } from '@lib/workoutFixtures';

interface Props {
  exerciseId: string;
  index: number;
  sets: WorkoutSet[];
  plannedSetCount: number;
  onPress?: () => void;
}

export default function CollapsedExerciseCard({
  exerciseId,
  index,
  sets,
  plannedSetCount,
  onPress,
}: Props) {
  const exercise = getExerciseById(exerciseId);
  const completed = sets.filter((s) => s.completedAt).length;
  const total = Math.max(plannedSetCount, sets.length);

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.numChip}>
        <Text style={styles.numChipText}>{index + 1}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {exercise?.name ?? exerciseId}
        </Text>
        <Text style={styles.meta}>
          Up next · {completed}/{total} sets
        </Text>
      </View>
      <View style={styles.dotsRow}>
        {Array.from({ length: total }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              { backgroundColor: i < completed ? WORKOUT_THEME.fg2 : WORKOUT_THEME.surface4 },
            ]}
          />
        ))}
      </View>
      <MaterialCommunityIcons name="chevron-down" size={18} color={WORKOUT_THEME.fg4} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: WORKOUT_THEME.surface2,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  numChip: {
    width: 26,
    height: 26,
    borderRadius: 999,
    backgroundColor: WORKOUT_THEME.surface3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numChipText: {
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 12,
    color: WORKOUT_THEME.fg3,
    ...tabularStyle,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 15,
    color: WORKOUT_THEME.fg,
  },
  meta: {
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 11.5,
    color: WORKOUT_THEME.fg3,
    marginTop: 2,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 999,
  },
});
