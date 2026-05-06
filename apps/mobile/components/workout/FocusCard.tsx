import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { WorkoutSet } from '@shared';
import { SLEEP_FONTS, WORKOUT_THEME, tabularStyle } from '@constants';
import { getExerciseById } from '@lib/workoutFixtures';
import PlateCalculator from './PlateCalculator';

const STEPPERS_KG = [-2.5, -1, 1, 2.5, 5] as const;

interface Props {
  exerciseId: string;
  index: number;
  totalExercises: number;
  sets: WorkoutSet[];
  plannedSetCount: number; // expected total sets for the dots ribbon
  onComplete: (weightKg: number | null, reps: number) => void;
  onRemoveExercise: (exerciseId: string) => void;
}

function formatStep(v: number): string {
  const sign = v > 0 ? '+' : '';
  return `${sign}${v}`;
}

export default function FocusCard({
  exerciseId,
  index,
  sets,
  plannedSetCount,
  onComplete,
  onRemoveExercise,
}: Props) {
  const exercise = getExerciseById(exerciseId);
  const completed = sets.filter((s) => s.completedAt);
  const lastCompleted = completed[completed.length - 1] ?? null;
  const dotsCount = Math.max(plannedSetCount, sets.length + 1);
  const currentIdx = sets.length; // pending row sits at this index in the dots ribbon
  const setsCompleted = completed.length;

  const [weight, setWeight] = useState<string>(
    lastCompleted?.weightKg != null ? String(lastCompleted.weightKg) : '',
  );
  const [reps, setReps] = useState<string>(
    lastCompleted?.reps != null ? '' : '',
  );
  const repsInputRef = useRef<TextInput | null>(null);
  const [plateModalOpen, setPlateModalOpen] = useState(false);

  // Reset inputs when this exercise's completed set count changes (a set was logged).
  // We intentionally key on `sets.length` rather than `completed.length` to also
  // respond to optimistic deletions.
  const setsLen = sets.length;
  useEffect(() => {
    if (lastCompleted?.weightKg != null) {
      setWeight(String(lastCompleted.weightKg));
    }
    setReps('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setsLen]);

  const weightSuggested = !weight && lastCompleted?.weightKg != null;
  const placeholderWeight = lastCompleted?.weightKg != null ? String(lastCompleted.weightKg) : '';
  const placeholderReps = lastCompleted?.reps != null ? String(lastCompleted.reps) : '8';

  // Pulse animation for the active dot when a set is completed
  const pulseScale = useSharedValue(1);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulseScale.value }] }));

  const ctaScale = useSharedValue(1);
  const ctaStyle = useAnimatedStyle(() => ({ transform: [{ scale: ctaScale.value }] }));

  const adjustWeight = (delta: number) => {
    const cur = parseFloat(weight) || (lastCompleted?.weightKg ?? 0);
    const next = Math.max(0, cur + delta);
    setWeight(Number.isInteger(next) ? String(next) : next.toFixed(1));
    void Haptics.selectionAsync();
  };

  const handleComplete = () => {
    const repsNum = parseInt(reps, 10);
    if (!Number.isFinite(repsNum) || repsNum <= 0) {
      // Fall back to placeholder if user didn't input
      const fallback = parseInt(placeholderReps, 10);
      if (!Number.isFinite(fallback) || fallback <= 0) return;
    }
    const finalReps = Number.isFinite(repsNum) && repsNum > 0 ? repsNum : parseInt(placeholderReps, 10);
    const w = parseFloat(weight);
    const finalWeight = Number.isFinite(w) && w > 0 ? w : lastCompleted?.weightKg ?? null;

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    pulseScale.value = withSequence(
      withTiming(1.18, { duration: 80 }),
      withTiming(1, { duration: 120 }),
    );
    onComplete(finalWeight, finalReps);
  };

  const muscleTags = useMemo(
    () => (exercise?.primaryMuscles.slice(0, 2) ?? []).map((m) => m.replace(/_/g, ' ')),
    [exercise],
  );

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.numChip}>
          <Text style={styles.numChipText}>{index + 1}</Text>
        </View>
        <View style={styles.headerMain}>
          <Text style={styles.title} numberOfLines={1}>
            {exercise?.name ?? exerciseId}
          </Text>
          <View style={styles.tagRow}>
            {muscleTags.map((m) => (
              <View key={m} style={styles.tag}>
                <Text style={styles.tagText}>{m}</Text>
              </View>
            ))}
            <Text style={styles.setCounter}>
              {setsCompleted}/{dotsCount}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={() => onRemoveExercise(exerciseId)}
          hitSlop={8}
          style={styles.moreBtn}>
          <MaterialCommunityIcons name="close" size={18} color={WORKOUT_THEME.fg4} />
        </Pressable>
      </View>

      {/* Dots ribbon */}
      <View style={styles.ribbon}>
        {Array.from({ length: dotsCount }).map((_, i) => {
          const isDone = i < setsCompleted;
          const isCurrent = i === currentIdx;
          const isLast = i === dotsCount - 1;
          return (
            <View
              key={i}
              style={[
                styles.ribbonItem,
                !isLast && { flex: 1 },
              ]}>
              <Animated.View
                style={[
                  styles.dot,
                  isDone && styles.dotDone,
                  isCurrent && styles.dotCurrent,
                  isCurrent && pulseStyle,
                ]}>
                {isDone ? (
                  <MaterialCommunityIcons name="check" size={13} color={WORKOUT_THEME.bg} />
                ) : (
                  <Text style={[styles.dotNum, isCurrent && { color: WORKOUT_THEME.fg }]}>
                    {i + 1}
                  </Text>
                )}
              </Animated.View>
              {!isLast && (
                <View
                  style={[
                    styles.connector,
                    { backgroundColor: isDone ? WORKOUT_THEME.fg2 : WORKOUT_THEME.surface4 },
                  ]}
                />
              )}
            </View>
          );
        })}
      </View>

      {/* Last-set hint */}
      {lastCompleted && (
        <View style={styles.lastRow}>
          <MaterialCommunityIcons name="history" size={13} color={WORKOUT_THEME.fg4} />
          <Text style={styles.lastLabel}>Last set</Text>
          <Text style={styles.lastValue}>
            {lastCompleted.weightKg != null ? `${lastCompleted.weightKg}kg × ` : ''}
            {lastCompleted.reps}
          </Text>
        </View>
      )}

      {/* Big inputs */}
      <View style={styles.fieldsRow}>
        <BigField
          label="Weight"
          value={weight}
          unit="kg"
          placeholder={placeholderWeight}
          onChangeText={setWeight}
          suggested={weightSuggested}
          onSubmit={() => repsInputRef.current?.focus()}
        />
        <BigField
          label="Reps"
          value={reps}
          unit="reps"
          placeholder={placeholderReps}
          onChangeText={setReps}
          inputRef={repsInputRef}
          returnKeyType="done"
        />
      </View>

      {/* Steppers */}
      <View style={styles.steppers}>
        {STEPPERS_KG.map((v) => (
          <Pressable key={v} style={styles.stepper} onPress={() => adjustWeight(v)}>
            <Text style={styles.stepperText}>{formatStep(v)} kg</Text>
          </Pressable>
        ))}
        <Pressable
          style={styles.stepper}
          onPress={() => {
            void Haptics.selectionAsync();
            setPlateModalOpen(true);
          }}>
          <MaterialCommunityIcons name="weight" size={14} color={WORKOUT_THEME.fg2} />
        </Pressable>
      </View>

      <PlateCalculator
        visible={plateModalOpen}
        targetKg={parseFloat(weight) || lastCompleted?.weightKg || 0}
        onClose={() => setPlateModalOpen(false)}
      />

      {/* Complete CTA */}
      <Animated.View style={ctaStyle}>
        <Pressable
          onPressIn={() => {
            ctaScale.value = withTiming(0.97, { duration: 100 });
          }}
          onPressOut={() => {
            ctaScale.value = withTiming(1, { duration: 100 });
          }}
          onPress={handleComplete}
          style={styles.cta}>
          <MaterialCommunityIcons name="check" size={18} color={WORKOUT_THEME.bg} />
          <Text style={styles.ctaText}>Complete set {currentIdx + 1}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

interface BigFieldProps {
  label: string;
  value: string;
  unit: string;
  placeholder: string;
  onChangeText: (v: string) => void;
  suggested?: boolean;
  inputRef?: React.MutableRefObject<TextInput | null>;
  returnKeyType?: 'done' | 'next';
  onSubmit?: () => void;
}

function BigField({
  label,
  value,
  unit,
  placeholder,
  onChangeText,
  suggested,
  inputRef,
  returnKeyType = 'next',
  onSubmit,
}: BigFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldValueRow}>
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder || '—'}
          placeholderTextColor={suggested ? WORKOUT_THEME.fg3 : WORKOUT_THEME.fg4}
          keyboardType="decimal-pad"
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmit}
          style={[
            styles.fieldInput,
            { color: suggested ? WORKOUT_THEME.fg3 : WORKOUT_THEME.fg },
          ]}
        />
        <Text style={styles.fieldUnit}>{unit}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: WORKOUT_THEME.surface2,
    borderRadius: 26,
    padding: 18,
    borderWidth: 1,
    borderColor: WORKOUT_THEME.borderStrong,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  numChip: {
    width: 26,
    height: 26,
    borderRadius: 999,
    backgroundColor: WORKOUT_THEME.surface3,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  numChipText: {
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 12,
    color: WORKOUT_THEME.fg2,
    ...tabularStyle,
  },
  headerMain: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 16.5,
    color: WORKOUT_THEME.fg,
    letterSpacing: -0.2,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 5,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  tagText: {
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 10.5,
    color: WORKOUT_THEME.fg3,
    textTransform: 'capitalize',
    letterSpacing: 0.2,
  },
  setCounter: {
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 11,
    color: WORKOUT_THEME.fg4,
    marginLeft: 2,
    ...tabularStyle,
  },
  moreBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ribbon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
    marginBottom: 18,
    paddingHorizontal: 2,
  },
  ribbonItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: WORKOUT_THEME.fg5,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: {
    backgroundColor: WORKOUT_THEME.fg,
    borderColor: WORKOUT_THEME.fg,
  },
  dotCurrent: {
    borderColor: WORKOUT_THEME.fg,
  },
  dotNum: {
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 11,
    color: WORKOUT_THEME.fg4,
    ...tabularStyle,
  },
  connector: {
    flex: 1,
    height: 2,
    borderRadius: 1,
    marginHorizontal: 8,
  },
  lastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  lastLabel: {
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 12,
    color: WORKOUT_THEME.fg3,
  },
  lastValue: {
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 12,
    color: WORKOUT_THEME.fg2,
    marginLeft: 2,
    ...tabularStyle,
  },
  fieldsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  field: {
    flex: 1,
    backgroundColor: WORKOUT_THEME.surface3,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
  },
  fieldLabel: {
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 10.5,
    color: WORKOUT_THEME.fg3,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  fieldValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 4,
  },
  fieldInput: {
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 32,
    letterSpacing: -1,
    paddingVertical: 0,
    minWidth: 40,
    ...tabularStyle,
  },
  fieldUnit: {
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 13,
    color: WORKOUT_THEME.fg3,
  },
  steppers: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  stepper: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: WORKOUT_THEME.surface3,
    borderWidth: 1,
    borderColor: WORKOUT_THEME.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperText: {
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 12,
    color: WORKOUT_THEME.fg2,
    ...tabularStyle,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 18,
    backgroundColor: WORKOUT_THEME.fg,
  },
  ctaText: {
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 16,
    color: WORKOUT_THEME.bg,
  },
});
