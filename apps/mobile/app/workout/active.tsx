import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import BottomSheet from '@gorhom/bottom-sheet';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useWorkoutStore } from '@store/workoutStore';
import type { ActiveWorkoutSession, SessionMetadata } from '@store/workoutStore';
import { SLEEP_FONTS, SLEEP_LAYOUT, SLEEP_THEME, WORKOUT_THEME } from '@constants';
import { getExerciseById } from '@lib/workoutFixtures';
import { getTotalSets } from '@lib/workoutAnalytics';
import { useActiveTimer } from '@lib/workoutTimer';
import type { WorkoutSet } from '@shared';
import ActiveSetRow from '@components/workout/ActiveSetRow';
import RestTimer from '@components/workout/RestTimer';
import ExercisePickerSheet from '@components/workout/ExercisePickerSheet';
import WorkoutFinishSheet from '@components/workout/WorkoutFinishSheet';

const SPRING = { damping: 16, stiffness: 220 } as const;

// ─── Exercise section ──────────────────────────────────────────────────────────
interface ExerciseSectionProps {
  exerciseId: string;
  sets: WorkoutSet[];
  index: number;
  onLogSet: (exerciseId: string, set: Omit<WorkoutSet, 'id' | 'completedAt'>) => void;
  onRemoveSet: (exerciseId: string, setId: string) => void;
  onRemoveExercise: (exerciseId: string) => void;
  onSetCompleted: () => void;
}

function ExerciseSection({
  exerciseId,
  sets,
  index,
  onLogSet,
  onRemoveSet,
  onRemoveExercise,
  onSetCompleted,
}: ExerciseSectionProps) {
  const exercise = getExerciseById(exerciseId);
  const completedSets = sets.filter((s) => s.completedAt);

  const handleComplete = useCallback(
    (reps: number, weightKg: number | null) => {
      onLogSet(exerciseId, {
        setNumber: sets.length + 1,
        reps,
        weightKg,
        durationSeconds: null,
        rpe: null,
      });
      onSetCompleted();
    },
    [exerciseId, sets.length, onLogSet, onSetCompleted]
  );

  // Prepare set rows: completed sets + one pending row
  const pendingSetNumber = sets.length + 1;
  const lastCompletedSet = completedSets[completedSets.length - 1] ?? null;

  return (
    <Animated.View
      entering={FadeInDown.duration(300).delay(index * 60)}
      style={styles.exerciseSection}>
      {/* Exercise header */}
      <View style={styles.exerciseHeader}>
        <View style={styles.exerciseTitleWrap}>
          <Text style={styles.exerciseTitle}>{exercise?.name ?? exerciseId}</Text>
          <View style={styles.muscleBadges}>
            {exercise?.primaryMuscles.slice(0, 2).map((m) => (
              <View key={m} style={styles.muscleBadge}>
                <Text style={styles.muscleBadgeText}>{m.replace('_', ' ')}</Text>
              </View>
            ))}
          </View>
        </View>
        <Pressable
          onPress={() => onRemoveExercise(exerciseId)}
          hitSlop={8}
          style={styles.removeExerciseBtn}>
          <Ionicons name="close" size={18} color={SLEEP_THEME.textMuted2} />
        </Pressable>
      </View>

      {/* Column headers */}
      <View style={styles.colHeaders}>
        <View style={styles.setNumCol}>
          <Text style={styles.colHeader}>Set</Text>
        </View>
        <View style={styles.inputCol}>
          <Text style={styles.colHeader}>Weight</Text>
        </View>
        <View style={styles.inputCol}>
          <Text style={styles.colHeader}>Reps</Text>
        </View>
        <View style={styles.checkCol} />
      </View>

      {/* Completed sets */}
      {sets.map((set) => (
        <ActiveSetRow
          key={set.id}
          setNumber={set.setNumber}
          isCompleted
          previousSet={null}
          onComplete={() => {}}
          onRemove={() => onRemoveSet(exerciseId, set.id)}
        />
      ))}

      {/* Pending row */}
      <ActiveSetRow
        key={`pending-${pendingSetNumber}`}
        setNumber={pendingSetNumber}
        isCompleted={false}
        previousSet={lastCompletedSet ? { reps: lastCompletedSet.reps, weightKg: lastCompletedSet.weightKg } : null}
        onComplete={handleComplete}
        onRemove={() => {}}
      />
    </Animated.View>
  );
}

// ─── Active screen ─────────────────────────────────────────────────────────────
export default function ActiveWorkoutScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pickerRef = useRef<BottomSheet | null>(null);
  const finishRef = useRef<BottomSheet | null>(null);

  const activeSession = useWorkoutStore((s) => s.activeSession);
  const addExercise = useWorkoutStore((s) => s.addExercise);
  const logSet = useWorkoutStore((s) => s.logSet);
  const removeSet = useWorkoutStore((s) => s.removeSet);
  const removeExercise = useWorkoutStore((s) => s.removeExercise);
  const pauseWorkout = useWorkoutStore((s) => s.pauseWorkout);
  const resumeWorkout = useWorkoutStore((s) => s.resumeWorkout);
  const finishWorkout = useWorkoutStore((s) => s.finishWorkout);
  const discardWorkout = useWorkoutStore((s) => s.discardWorkout);

  const [restTimerVisible, setRestTimerVisible] = useState(false);
  const finishScale = useSharedValue(1);

  const isPaused = activeSession?.isPaused ?? false;
  const elapsedLabel = useActiveTimer(activeSession);
  const totalSets = useMemo(
    () => (activeSession ? getTotalSets(activeSession) : 0),
    [activeSession]
  );

  // Guard: if no active session (e.g. navigated directly), go back
  useEffect(() => {
    if (!activeSession) {
      router.back();
    }
  }, [activeSession, router]);

  const handleSetCompleted = useCallback(() => {
    setRestTimerVisible(true);
  }, []);

  const handleAddExercise = useCallback(
    (exerciseId: string) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      addExercise(exerciseId);
    },
    [addExercise]
  );

  const handleMinimize = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const handleTogglePause = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isPaused) resumeWorkout();
    else pauseWorkout();
  }, [isPaused, pauseWorkout, resumeWorkout]);

  const handleFinish = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    finishRef.current?.snapToIndex(0);
  }, []);

  const finishBtnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: finishScale.value }],
  }));

  if (!activeSession) return null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <BlurView intensity={12} tint="dark" style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable onPress={handleMinimize} hitSlop={8} style={styles.headerIconBtn}>
            <Ionicons name="close" size={22} color={SLEEP_THEME.textMuted1} />
          </Pressable>
          <Pressable onPress={handleTogglePause} hitSlop={8} style={styles.headerIconBtn}>
            <MaterialCommunityIcons
              name={isPaused ? 'play' : 'pause'}
              size={20}
              color={isPaused ? WORKOUT_THEME.accent : SLEEP_THEME.textMuted1}
            />
          </Pressable>
        </View>

        <View style={styles.headerCenter}>
          <Animated.Text
            entering={FadeIn.duration(300)}
            style={[styles.elapsedLabel, isPaused && styles.elapsedLabelPaused]}>
            {elapsedLabel}
          </Animated.Text>
          {isPaused ? (
            <Text style={styles.pausedBadge}>PAUSED</Text>
          ) : (
            <Text style={styles.setsLabel}>{totalSets} sets</Text>
          )}
        </View>

        <Animated.View style={finishBtnStyle}>
          <Pressable
            onPressIn={() => {
              finishScale.value = withSpring(0.94, SPRING);
            }}
            onPressOut={() => {
              finishScale.value = withSpring(1, SPRING);
            }}
            onPress={handleFinish}
            style={styles.finishBtn}>
            <Text style={styles.finishBtnText}>Finish</Text>
          </Pressable>
        </Animated.View>
      </BlurView>

      {/* Exercise list */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 120 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {activeSession.exercises.length === 0 && (
          <Animated.View entering={FadeIn.duration(400)} style={styles.emptyExercises}>
            <MaterialCommunityIcons
              name="dumbbell"
              size={40}
              color={WORKOUT_THEME.accentDim}
            />
            <Text style={styles.emptyTitle}>No exercises yet</Text>
            <Text style={styles.emptyBody}>Tap the button below to add your first exercise.</Text>
          </Animated.View>
        )}

        {activeSession.exercises.map((log, i) => (
          <ExerciseSection
            key={log.exerciseId}
            exerciseId={log.exerciseId}
            sets={log.sets}
            index={i}
            onLogSet={logSet}
            onRemoveSet={removeSet}
            onRemoveExercise={removeExercise}
            onSetCompleted={handleSetCompleted}
          />
        ))}

        {/* Rest timer */}
        {restTimerVisible && (
          <RestTimer
            isVisible={restTimerVisible}
            onDismiss={() => setRestTimerVisible(false)}
          />
        )}

        {/* Add exercise CTA */}
        <Pressable
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            pickerRef.current?.snapToIndex(0);
          }}
          style={styles.addExerciseBtn}>
          <Ionicons name="add-circle" size={20} color={WORKOUT_THEME.accent} />
          <Text style={styles.addExerciseText}>Add Exercise</Text>
        </Pressable>
      </ScrollView>

      {/* Exercise picker sheet */}
      <ExercisePickerSheet sheetRef={pickerRef} onAdd={handleAddExercise} />

      {/* Finish sheet */}
      <WorkoutFinishSheet
        sheetRef={finishRef}
        session={activeSession}
        onSave={async (metadata: SessionMetadata) => {
          await finishWorkout(metadata);
          router.back();
        }}
        onDiscard={() => {
          discardWorkout();
          router.back();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SLEEP_THEME.screenBg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SLEEP_LAYOUT.screenPaddingH,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SLEEP_THEME.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { alignItems: 'center' },
  elapsedLabel: {
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 20,
    lineHeight: 24,
    color: SLEEP_THEME.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  elapsedLabelPaused: {
    color: SLEEP_THEME.textMuted1,
  },
  setsLabel: {
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 12,
    lineHeight: 16,
    color: SLEEP_THEME.textMuted1,
    marginTop: 2,
  },
  pausedBadge: {
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 10,
    lineHeight: 13,
    color: WORKOUT_THEME.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  finishBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: SLEEP_LAYOUT.cardRadiusInner,
    backgroundColor: SLEEP_THEME.textPrimary,
  },
  finishBtnText: {
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 15,
    lineHeight: 20,
    color: SLEEP_THEME.screenBg,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: SLEEP_LAYOUT.screenPaddingH,
    paddingTop: 16,
    gap: SLEEP_LAYOUT.cardGap,
  },
  emptyExercises: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyTitle: {
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 20,
    lineHeight: 24,
    color: SLEEP_THEME.textPrimary,
  },
  emptyBody: {
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    color: SLEEP_THEME.textMuted1,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  exerciseSection: {
    backgroundColor: SLEEP_THEME.cardBg,
    borderRadius: SLEEP_LAYOUT.cardRadiusOuter,
    overflow: 'hidden',
    paddingBottom: 8,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: SLEEP_LAYOUT.cardPadding,
    paddingTop: SLEEP_LAYOUT.cardPadding,
    paddingBottom: 8,
  },
  exerciseTitleWrap: { flex: 1, gap: 6 },
  exerciseTitle: {
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 17,
    lineHeight: 22,
    color: SLEEP_THEME.textPrimary,
  },
  muscleBadges: { flexDirection: 'row', gap: 6 },
  muscleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: SLEEP_THEME.cardInset,
  },
  muscleBadgeText: {
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 11,
    lineHeight: 14,
    color: SLEEP_THEME.textMuted1,
    textTransform: 'capitalize',
  },
  removeExerciseBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colHeaders: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SLEEP_LAYOUT.cardPadding,
    paddingBottom: 4,
    gap: 8,
  },
  setNumCol: { width: 28, alignItems: 'center' },
  inputCol: { flex: 1 },
  checkCol: { width: 36 },
  colHeader: {
    fontFamily: SLEEP_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    color: SLEEP_THEME.textMuted2,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  addExerciseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: SLEEP_LAYOUT.cardRadiusOuter,
    borderWidth: 1,
    borderColor: WORKOUT_THEME.accentBorder,
    borderStyle: 'dashed',
  },
  addExerciseText: {
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 15,
    lineHeight: 20,
    color: WORKOUT_THEME.accent,
  },
});
