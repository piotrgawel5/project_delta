import { memo, useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { SLEEP_FONTS, SLEEP_LAYOUT, SLEEP_THEME, WORKOUT_THEME } from '@constants';
import type { WorkoutSet } from '@shared';

const SPRING = { damping: 14, stiffness: 260 } as const;
const ROW_HEIGHT = 52;

interface ActiveSetRowProps {
  setNumber: number;
  isCompleted: boolean;
  previousSet: Pick<WorkoutSet, 'reps' | 'weightKg'> | null;
  onComplete: (reps: number, weightKg: number | null) => void;
  onRemove: () => void;
}

const ActiveSetRow = memo(function ActiveSetRow({
  setNumber,
  isCompleted,
  previousSet,
  onComplete,
  onRemove,
}: ActiveSetRowProps) {
  const [reps, setReps] = useState(previousSet?.reps?.toString() ?? '');
  const [weight, setWeight] = useState(previousSet?.weightKg?.toString() ?? '');

  const checkScale = useSharedValue(1);
  const rowBg = useSharedValue(0);

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  const rowStyle = useAnimatedStyle(() => ({
    backgroundColor: rowBg.value === 0
      ? 'transparent'
      : `rgba(48,209,88,${rowBg.value * 0.08})`,
  }));

  const handleComplete = useCallback(() => {
    const repsNum = parseInt(reps, 10);
    if (isNaN(repsNum) || repsNum <= 0) return;

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Spring pulse on checkmark
    checkScale.value = withSequence(
      withSpring(1.4, { damping: 8, stiffness: 300 }),
      withSpring(1, SPRING)
    );
    // Subtle green row flash
    rowBg.value = withSequence(
      withTiming(1, { duration: 120 }),
      withTiming(0, { duration: 600 })
    );

    onComplete(repsNum, weight ? parseFloat(weight) : null);
  }, [reps, weight, checkScale, rowBg, onComplete]);

  return (
    <Animated.View style={[styles.row, rowStyle]}>
      {/* Set number */}
      <View style={styles.setNumWrap}>
        <Text style={[styles.setNum, isCompleted && styles.setNumCompleted]}>
          {setNumber}
        </Text>
      </View>

      {/* Weight input */}
      <View style={styles.inputWrap}>
        <TextInput
          style={[styles.input, isCompleted && styles.inputCompleted]}
          value={weight}
          onChangeText={setWeight}
          placeholder={previousSet?.weightKg?.toString() ?? '—'}
          placeholderTextColor={SLEEP_THEME.textMuted2}
          keyboardType="decimal-pad"
          editable={!isCompleted}
          selectTextOnFocus
        />
        <Text style={styles.inputUnit}>kg</Text>
      </View>

      {/* Reps input */}
      <View style={styles.inputWrap}>
        <TextInput
          style={[styles.input, isCompleted && styles.inputCompleted]}
          value={reps}
          onChangeText={setReps}
          placeholder={previousSet?.reps?.toString() ?? '—'}
          placeholderTextColor={SLEEP_THEME.textMuted2}
          keyboardType="number-pad"
          editable={!isCompleted}
          selectTextOnFocus
        />
        <Text style={styles.inputUnit}>reps</Text>
      </View>

      {/* Complete / remove */}
      {isCompleted ? (
        <Pressable onPress={onRemove} hitSlop={8} style={styles.actionBtn}>
          <Ionicons name="checkmark-circle" size={28} color={WORKOUT_THEME.setComplete} />
        </Pressable>
      ) : (
        <Animated.View style={checkStyle}>
          <Pressable onPress={handleComplete} hitSlop={8} style={styles.actionBtn}>
            <View style={styles.checkCircle} />
          </Pressable>
        </Animated.View>
      )}
    </Animated.View>
  );
});

export default ActiveSetRow;

const styles = StyleSheet.create({
  row: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SLEEP_LAYOUT.cardPadding,
    gap: 8,
    borderRadius: SLEEP_LAYOUT.cardRadiusInner,
  },
  setNumWrap: {
    width: 28,
    alignItems: 'center',
  },
  setNum: {
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 16,
    lineHeight: 20,
    color: SLEEP_THEME.textMuted1,
  },
  setNumCompleted: {
    color: WORKOUT_THEME.setComplete,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SLEEP_THEME.cardInset,
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 36,
    gap: 4,
  },
  input: {
    flex: 1,
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 16,
    lineHeight: 20,
    color: SLEEP_THEME.textPrimary,
    padding: 0,
  },
  inputCompleted: {
    color: SLEEP_THEME.textMuted1,
  },
  inputUnit: {
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 12,
    lineHeight: 16,
    color: SLEEP_THEME.textMuted2,
  },
  actionBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: WORKOUT_THEME.setIncomplete,
    backgroundColor: 'transparent',
  },
});
