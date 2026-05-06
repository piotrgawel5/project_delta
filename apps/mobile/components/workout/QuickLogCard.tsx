// components/workout/QuickLogCard.tsx
//
// One-tap progression UI. Reads the suggester output for the active exercise
// and offers three shortcuts:
//   • Repeat last     — replay the previous-session sets, weight unchanged.
//   • +2.5 kg top set — apply the suggester's overload (caps respected).
//   • Skip            — remove the exercise from this session.

import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { WorkoutSession, WorkoutSet } from '@shared';
import { SLEEP_FONTS, WORKOUT_THEME } from '@constants';
import { getExerciseById } from '@lib/workoutFixtures';
import {
  suggestNextSession,
  type SuggestedSet,
} from '@lib/workoutProgression';

interface Props {
  exerciseId: string;
  index: number;
  sets: WorkoutSet[];
  pastSessions: WorkoutSession[];
  onLogSet: (set: Omit<WorkoutSet, 'id' | 'completedAt'>) => void;
  onRemoveExercise: (exerciseId: string) => void;
}

export default function QuickLogCard({
  exerciseId,
  index,
  sets,
  pastSessions,
  onLogSet,
  onRemoveExercise,
}: Props) {
  const exercise = getExerciseById(exerciseId);

  const sessionsForExercise = useMemo(
    () => pastSessions.filter((s) => s.exercises.some((e) => e.exerciseId === exerciseId)),
    [pastSessions, exerciseId],
  );

  const overloadSuggestion = useMemo(
    () => suggestNextSession(sessionsForExercise, exerciseId),
    [sessionsForExercise, exerciseId],
  );

  const lastSets = useMemo<SuggestedSet[]>(() => {
    const last = sessionsForExercise[0]?.exercises.find((e) => e.exerciseId === exerciseId);
    if (!last) return [];
    return last.sets.map((s) => ({
      reps: s.reps,
      weightKg: s.weightKg,
      durationSeconds: s.durationSeconds,
      rpe: null,
    }));
  }, [sessionsForExercise, exerciseId]);

  const completed = sets.length;
  const isFresh = completed === 0;

  const replay = (suggested: SuggestedSet[]) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    suggested.forEach((s, i) => {
      onLogSet({
        setNumber: i + 1,
        reps: s.reps ?? 0,
        weightKg: s.weightKg,
        durationSeconds: s.durationSeconds,
        rpe: s.rpe,
      });
    });
  };

  const handleSkip = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onRemoveExercise(exerciseId);
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.idx}>#{index + 1}</Text>
        <Text style={styles.title} numberOfLines={1}>
          {exercise?.name ?? exerciseId}
        </Text>
        <Pressable onPress={handleSkip} hitSlop={8} style={styles.skipBtn}>
          <MaterialCommunityIcons name="close" size={16} color={WORKOUT_THEME.fg3} />
        </Pressable>
      </View>

      {!isFresh && (
        <Text style={styles.statusLine}>
          {completed} {completed === 1 ? 'set logged' : 'sets logged'}
        </Text>
      )}

      {isFresh && lastSets.length === 0 && (
        <Text style={styles.emptyHint}>
          No prior session — switch to Detailed mode to log this exercise.
        </Text>
      )}

      {isFresh && lastSets.length > 0 && (
        <View style={styles.actions}>
          <Pressable
            onPress={() => replay(lastSets)}
            style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}>
            <MaterialCommunityIcons name="repeat" size={16} color={WORKOUT_THEME.fg} />
            <Text style={styles.btnLabel}>Repeat last</Text>
          </Pressable>

          {overloadSuggestion?.isOverload && (
            <Pressable
              onPress={() => replay(overloadSuggestion.sets)}
              style={({ pressed }) => [styles.btn, styles.btnPrimary, pressed && styles.btnPressed]}>
              <MaterialCommunityIcons name="arrow-up-bold" size={16} color={WORKOUT_THEME.successInk} />
              <Text style={[styles.btnLabel, styles.btnLabelPrimary]}>+2.5 kg top</Text>
            </Pressable>
          )}
        </View>
      )}

      {overloadSuggestion && (
        <Text style={styles.rationale}>{overloadSuggestion.rationale}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: WORKOUT_THEME.surface2,
    borderRadius: 18,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: WORKOUT_THEME.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  idx: {
    fontFamily: SLEEP_FONTS.medium,
    fontSize: 12,
    color: WORKOUT_THEME.fg3,
  },
  title: {
    flex: 1,
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 17,
    color: WORKOUT_THEME.fg,
  },
  skipBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WORKOUT_THEME.overlayWhite05,
  },
  statusLine: {
    marginTop: 6,
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 13,
    color: WORKOUT_THEME.fg3,
  },
  emptyHint: {
    marginTop: 8,
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 13,
    color: WORKOUT_THEME.fg3,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: WORKOUT_THEME.surface3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: WORKOUT_THEME.border,
  },
  btnPrimary: {
    backgroundColor: WORKOUT_THEME.successBg,
    borderColor: WORKOUT_THEME.successBorder,
  },
  btnPressed: {
    opacity: 0.7,
  },
  btnLabel: {
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 14,
    color: WORKOUT_THEME.fg,
  },
  btnLabelPrimary: {
    color: WORKOUT_THEME.success,
  },
  rationale: {
    marginTop: 10,
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 12,
    color: WORKOUT_THEME.fg3,
  },
});
