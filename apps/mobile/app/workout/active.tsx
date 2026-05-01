import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import BottomSheet from '@gorhom/bottom-sheet';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useWorkoutStore } from '@store/workoutStore';
import type { SessionMetadata } from '@store/workoutStore';
import { SLEEP_FONTS, WORKOUT_THEME, tabularStyle } from '@constants';
import { getTotalSets } from '@lib/workoutAnalytics';
import { useActiveTimer } from '@lib/workoutTimer';
import FocusCard from '@components/workout/FocusCard';
import CollapsedExerciseCard from '@components/workout/CollapsedExerciseCard';
import RestTimer from '@components/workout/RestTimer';
import ExercisePickerSheet from '@components/workout/ExercisePickerSheet';
import WorkoutFinishSheet from '@components/workout/WorkoutFinishSheet';

const HEADER_HEIGHT = 56;
const PAD_X = 16;
const DEFAULT_PLANNED_SETS = 4;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function ActiveWorkoutScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pickerRef = useRef<BottomSheet | null>(null);
  const finishRef = useRef<BottomSheet | null>(null);

  const activeSession = useWorkoutStore((s) => s.activeSession);
  const addExercise = useWorkoutStore((s) => s.addExercise);
  const logSet = useWorkoutStore((s) => s.logSet);
  const removeExercise = useWorkoutStore((s) => s.removeExercise);
  const pauseWorkout = useWorkoutStore((s) => s.pauseWorkout);
  const resumeWorkout = useWorkoutStore((s) => s.resumeWorkout);
  const finishWorkout = useWorkoutStore((s) => s.finishWorkout);
  const discardWorkout = useWorkoutStore((s) => s.discardWorkout);
  const drainSyncQueue = useWorkoutStore((s) => s.drainSyncQueue);
  const syncStatus = useWorkoutStore((s) => s.syncStatus);
  const lastSyncError = useWorkoutStore((s) => s.lastSyncError);

  const [restTimerVisible, setRestTimerVisible] = useState(false);
  const finishScale = useSharedValue(1);

  const isPaused = activeSession?.isPaused ?? false;
  const elapsedLabel = useActiveTimer(activeSession);
  const totalSets = useMemo(
    () => (activeSession ? getTotalSets(activeSession) : 0),
    [activeSession],
  );

  // Identify the focused (current) exercise — first one with an incomplete set
  // or remaining capacity. Falls back to the first exercise.
  const focusedExerciseIdx = useMemo(() => {
    if (!activeSession) return 0;
    for (let i = 0; i < activeSession.exercises.length; i++) {
      const ex = activeSession.exercises[i];
      const completed = ex.sets.filter((s) => s.completedAt).length;
      if (completed < DEFAULT_PLANNED_SETS) return i;
    }
    return Math.max(0, activeSession.exercises.length - 1);
  }, [activeSession]);

  const handleSetCompleted = useCallback(
    (exerciseId: string, weightKg: number | null, reps: number) => {
      if (!activeSession) return;
      const ex = activeSession.exercises.find((e) => e.exerciseId === exerciseId);
      const setNumber = (ex?.sets.length ?? 0) + 1;
      logSet(exerciseId, {
        setNumber,
        reps,
        weightKg,
        durationSeconds: null,
        rpe: null,
      });
      setRestTimerVisible(true);
    },
    [activeSession, logSet],
  );

  const handleAddExercises = useCallback(
    (exerciseIds: string[]) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      for (const id of exerciseIds) addExercise(id);
    },
    [addExercise],
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
    finishRef.current?.expand();
  }, []);

  const finishBtnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: finishScale.value }],
  }));

  if (!activeSession) return null;

  const headerTop = insets.top;

  return (
    <View style={styles.container}>
      {/* Sticky header */}
      <BlurView
        intensity={20}
        tint="dark"
        style={[styles.header, { top: headerTop, height: HEADER_HEIGHT }]}>
        <View style={styles.headerLeft}>
          <Pressable onPress={handleMinimize} hitSlop={8} style={styles.headerIconBtn}>
            <MaterialCommunityIcons name="close" size={22} color={WORKOUT_THEME.fg2} />
          </Pressable>
          <Pressable onPress={handleTogglePause} hitSlop={8} style={styles.headerIconBtn}>
            <MaterialCommunityIcons
              name={isPaused ? 'play' : 'pause'}
              size={20}
              color={WORKOUT_THEME.fg2}
            />
          </Pressable>
        </View>

        <View style={styles.headerCenter}>
          <Animated.Text entering={FadeIn.duration(300)} style={styles.elapsedLabel}>
            {elapsedLabel}
          </Animated.Text>
          <Text style={styles.headerMetaRow}>
            <Text style={styles.metaText}>{totalSets} sets</Text>
          </Text>
        </View>

        <AnimatedPressable
          onPressIn={() => {
            finishScale.value = withTiming(0.97, { duration: 100 });
          }}
          onPressOut={() => {
            finishScale.value = withTiming(1, { duration: 100 });
          }}
          onPress={handleFinish}
          style={[styles.finishBtn, finishBtnStyle]}>
          <Text style={styles.finishBtnText}>Finish</Text>
        </AnimatedPressable>
      </BlurView>

      {/* Body */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: headerTop + HEADER_HEIGHT + 12,
            paddingBottom: insets.bottom + 180,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {activeSession.exercises.length === 0 && (
          <Animated.View entering={FadeIn.duration(400)} style={styles.empty}>
            <MaterialCommunityIcons name="dumbbell" size={36} color={WORKOUT_THEME.fg4} />
            <Text style={styles.emptyTitle}>No exercises yet</Text>
            <Text style={styles.emptyBody}>Tap the button below to add your first exercise.</Text>
          </Animated.View>
        )}

        {activeSession.exercises.map((log, i) => {
          const isFocus = i === focusedExerciseIdx;
          if (isFocus) {
            return (
              <Animated.View key={log.exerciseId} entering={FadeInDown.duration(280).delay(i * 40)}>
                <FocusCard
                  exerciseId={log.exerciseId}
                  index={i}
                  totalExercises={activeSession.exercises.length}
                  sets={log.sets}
                  plannedSetCount={DEFAULT_PLANNED_SETS}
                  onComplete={(w, r) => handleSetCompleted(log.exerciseId, w, r)}
                  onRemoveExercise={removeExercise}
                />
              </Animated.View>
            );
          }
          return (
            <Animated.View key={log.exerciseId} entering={FadeInDown.duration(280).delay(i * 40)}>
              <CollapsedExerciseCard
                exerciseId={log.exerciseId}
                index={i}
                sets={log.sets}
                plannedSetCount={DEFAULT_PLANNED_SETS}
              />
            </Animated.View>
          );
        })}

        {/* Add exercise dashed CTA */}
        <Pressable
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            pickerRef.current?.snapToIndex(0);
          }}
          style={styles.addBtn}>
          <MaterialCommunityIcons name="plus" size={17} color={WORKOUT_THEME.fg2} />
          <Text style={styles.addBtnText}>Add exercise</Text>
        </Pressable>
      </ScrollView>

      {/* Rest bar */}
      {restTimerVisible && (
        <RestTimer isVisible={restTimerVisible} onDismiss={() => setRestTimerVisible(false)} />
      )}

      <ExercisePickerSheet sheetRef={pickerRef} onAdd={handleAddExercises} />

      <WorkoutFinishSheet
        sheetRef={finishRef}
        session={activeSession}
        syncStatus={syncStatus}
        lastSyncError={lastSyncError}
        onRetry={() => void drainSyncQueue()}
        onSave={async (metadata: SessionMetadata) => {
          try {
            await finishWorkout(metadata);
            // Clear the in-progress slot before navigating so the sheet's own
            // close() callback lands on a still-mounted ref, not a screen
            // partway through unmounting.
            discardWorkout();
            router.back();
          } catch {
            // Sheet stays open; user can retry from the inline error banner.
          }
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
  container: { flex: 1, backgroundColor: WORKOUT_THEME.bg },
  header: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: WORKOUT_THEME.border,
    zIndex: 50,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  headerCenter: {
    alignItems: 'center',
  },
  elapsedLabel: {
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 19,
    color: WORKOUT_THEME.fg,
    letterSpacing: -0.4,
    ...tabularStyle,
  },
  headerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  metaText: {
    fontFamily: SLEEP_FONTS.medium,
    fontSize: 11,
    color: WORKOUT_THEME.fg3,
  },
  finishBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: WORKOUT_THEME.fg,
  },
  finishBtnText: {
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 14,
    color: WORKOUT_THEME.bg,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: PAD_X,
    gap: 12,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyTitle: {
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 20,
    color: WORKOUT_THEME.fg,
  },
  emptyBody: {
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 14,
    color: WORKOUT_THEME.fg3,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 22,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: WORKOUT_THEME.borderStrong,
  },
  addBtnText: {
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 14,
    color: WORKOUT_THEME.fg2,
  },
});
