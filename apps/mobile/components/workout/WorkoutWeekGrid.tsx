import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { SLEEP_FONTS, SLEEP_LAYOUT, SLEEP_THEME, WORKOUT_THEME } from '@constants';
import type { WorkoutSession } from '@shared';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;
const SPRING = { damping: 18, stiffness: 280 } as const;

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  // getDay: 0=Sun, 1=Mon ... shift so Mon=0
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDateKey(date: Date): string {
  return date.toISOString().substring(0, 10);
}

interface WorkoutWeekGridProps {
  sessions: WorkoutSession[];
  selectedDate: Date;
  onDayPress: (date: Date) => void;
}

const DayPill = memo(function DayPill({
  label,
  date,
  isToday,
  isSelected,
  hasWorkout,
  isFuture,
  onPress,
}: {
  label: string;
  date: Date;
  isToday: boolean;
  isSelected: boolean;
  hasWorkout: boolean;
  isFuture: boolean;
  onPress: (date: Date) => void;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.pillWrap, animatedStyle]}>
      <Pressable
        onPressIn={() => {
          scale.value = withSpring(0.88, SPRING);
        }}
        onPressOut={() => {
          scale.value = withSpring(1, SPRING);
        }}
        onPress={() => {
          if (!isFuture) {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onPress(date);
          }
        }}
        style={[styles.pill, isSelected && styles.pillSelected, isToday && styles.pillToday]}>
        <Text
          style={[
            styles.dayLabel,
            isSelected ? styles.dayLabelSelected : isFuture ? styles.dayLabelFuture : null,
          ]}>
          {label}
        </Text>
        <View
          style={[
            styles.dot,
            hasWorkout ? styles.dotWorkedOut : styles.dotEmpty,
            isFuture && styles.dotFuture,
          ]}
        />
      </Pressable>
    </Animated.View>
  );
});

export default function WorkoutWeekGrid({
  sessions,
  selectedDate,
  onDayPress,
}: WorkoutWeekGridProps) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const monday = useMemo(() => getMondayOfWeek(today), [today]);

  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      return d;
    }),
    [monday]
  );

  const workedOutKeys = useMemo(
    () => new Set(sessions.map((s) => s.date)),
    [sessions]
  );

  const selectedKey = toDateKey(selectedDate);
  const todayKey = toDateKey(today);

  return (
    <View style={styles.container}>
      {weekDates.map((date, i) => {
        const key = toDateKey(date);
        return (
          <DayPill
            key={key}
            label={DAYS[i]}
            date={date}
            isToday={key === todayKey}
            isSelected={key === selectedKey}
            hasWorkout={workedOutKeys.has(key)}
            isFuture={date > today}
            onPress={onDayPress}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: SLEEP_LAYOUT.screenPaddingH,
    paddingVertical: 4,
  },
  pillWrap: {
    flex: 1,
  },
  pill: {
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: SLEEP_LAYOUT.cardRadiusInner,
    backgroundColor: SLEEP_THEME.cardBg,
    gap: 6,
  },
  pillSelected: {
    backgroundColor: WORKOUT_THEME.accentDim,
    borderWidth: 1,
    borderColor: WORKOUT_THEME.accent,
  },
  pillToday: {
    borderWidth: 1,
    borderColor: SLEEP_THEME.border,
  },
  dayLabel: {
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 13,
    lineHeight: 16,
    color: WORKOUT_THEME.weekDayActive,
  },
  dayLabelSelected: {
    color: WORKOUT_THEME.accent,
  },
  dayLabelFuture: {
    color: WORKOUT_THEME.weekDayInactive,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  dotWorkedOut: {
    backgroundColor: WORKOUT_THEME.weekDotWorkedOut,
  },
  dotEmpty: {
    backgroundColor: WORKOUT_THEME.weekDotEmpty,
  },
  dotFuture: {
    opacity: 0,
  },
});
