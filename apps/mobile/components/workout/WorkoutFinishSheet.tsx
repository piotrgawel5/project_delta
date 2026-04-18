import { memo, useMemo, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SLEEP_FONTS, SLEEP_LAYOUT, SLEEP_THEME, WORKOUT_THEME } from '@constants';
import { getExerciseById } from '@lib/workoutFixtures';
import { getSessionMuscles, getTotalSets } from '@lib/workoutAnalytics';
import type { WorkoutSession } from '@shared';

const SPRING = { damping: 16, stiffness: 220 } as const;

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const StatPill = memo(function StatPill({
  value,
  label,
  delay,
}: {
  value: string;
  label: string;
  delay: number;
}) {
  return (
    <Animated.View entering={FadeInDown.duration(300).delay(delay)} style={styles.statPill}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Animated.View>
  );
});

interface WorkoutFinishSheetProps {
  sheetRef: React.RefObject<BottomSheet | null>;
  session: WorkoutSession | null;
  onSave: () => Promise<void>;
  onDiscard: () => void;
}

export default function WorkoutFinishSheet({
  sheetRef,
  session,
  onSave,
  onDiscard,
}: WorkoutFinishSheetProps) {
  const snapPoints = useMemo(() => ['85%'], []);
  const saveScale = useSharedValue(1);
  const saveStyle = useAnimatedStyle(() => ({
    transform: [{ scale: saveScale.value }],
  }));

  const totalSets = useMemo(
    () => (session ? getTotalSets(session) : 0),
    [session]
  );

  const musclesTrained = useMemo(
    () => (session ? getSessionMuscles(session) : []),
    [session]
  );

  const exerciseNames = useMemo(() => {
    if (!session) return [];
    return session.exercises
      .map((log) => getExerciseById(log.exerciseId)?.name ?? log.exerciseId)
      .slice(0, 6);
  }, [session]);

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.handle}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(300).delay(80)} style={styles.header}>
          <View style={styles.trophyWrap}>
            <MaterialCommunityIcons name="trophy" size={28} color={WORKOUT_THEME.accent} />
          </View>
          <Text style={styles.title}>Workout Complete</Text>
          <Text style={styles.subtitle}>Great work — here&apos;s your summary.</Text>
        </Animated.View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatPill
            value={totalSets.toString()}
            label="Sets"
            delay={140}
          />
          <StatPill
            value={session?.exercises.length.toString() ?? '0'}
            label="Exercises"
            delay={180}
          />
          <StatPill
            value={formatDuration(session?.durationSeconds ?? null)}
            label="Duration"
            delay={220}
          />
        </View>

        {/* Exercises */}
        {exerciseNames.length > 0 && (
          <Animated.View
            entering={FadeInDown.duration(300).delay(260)}
            style={styles.section}>
            <Text style={styles.sectionTitle}>Exercises</Text>
            <View style={styles.card}>
              {exerciseNames.map((name, i) => (
                <View
                  key={name}
                  style={[
                    styles.exerciseRow,
                    i < exerciseNames.length - 1 && styles.exerciseRowBorder,
                  ]}>
                  <Text style={styles.exerciseName}>{name}</Text>
                  <Text style={styles.exerciseSets}>
                    {session?.exercises[i]?.sets.length ?? 0} sets
                  </Text>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        {/* Muscles trained */}
        {musclesTrained.length > 0 && (
          <Animated.View
            entering={FadeInDown.duration(300).delay(300)}
            style={styles.section}>
            <Text style={styles.sectionTitle}>Muscles Trained</Text>
            <View style={styles.muscleWrap}>
              {musclesTrained.map((m) => (
                <View key={m} style={styles.musclePill}>
                  <Text style={styles.musclePillText}>
                    {m.replace('_', ' ')}
                  </Text>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        {/* Muscle map placeholder — wired in P3 */}
        <Animated.View
          entering={FadeInDown.duration(300).delay(340)}
          style={styles.muscleMapPlaceholder}>
          <Text style={styles.muscleMapPlaceholderText}>Muscle map — P3</Text>
        </Animated.View>

        {/* Actions */}
        <Animated.View entering={FadeInDown.duration(300).delay(380)} style={styles.actions}>
          <Animated.View style={saveStyle}>
            <Pressable
              onPressIn={() => {
                saveScale.value = withSpring(0.96, SPRING);
              }}
              onPressOut={() => {
                saveScale.value = withSpring(1, SPRING);
              }}
              onPress={async () => {
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                await onSave();
                sheetRef.current?.close();
              }}
              style={styles.saveBtn}>
              <Text style={styles.saveBtnText}>Save Workout</Text>
            </Pressable>
          </Animated.View>

          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onDiscard();
              sheetRef.current?.close();
            }}
            style={styles.discardBtn}>
            <Text style={styles.discardBtnText}>Discard</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetBg: { backgroundColor: SLEEP_THEME.bottomSheetBg },
  handle: { backgroundColor: SLEEP_THEME.border },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: SLEEP_LAYOUT.screenPaddingH,
    paddingBottom: 48,
    gap: 20,
  },
  header: { alignItems: 'center', paddingTop: 8 },
  trophyWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: WORKOUT_THEME.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 24,
    lineHeight: 28,
    color: SLEEP_THEME.textPrimary,
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 15,
    lineHeight: 20,
    color: SLEEP_THEME.textMuted1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: SLEEP_LAYOUT.cardGap,
  },
  statPill: {
    flex: 1,
    backgroundColor: SLEEP_THEME.cardBg,
    borderRadius: SLEEP_LAYOUT.cardRadiusInner,
    paddingVertical: 16,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 28,
    lineHeight: 32,
    color: SLEEP_THEME.textPrimary,
    marginBottom: 4,
  },
  statLabel: {
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 12,
    lineHeight: 16,
    color: SLEEP_THEME.textMuted1,
  },
  section: { gap: 10 },
  sectionTitle: {
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 13,
    lineHeight: 16,
    color: SLEEP_THEME.textMuted1,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  card: {
    backgroundColor: SLEEP_THEME.cardBg,
    borderRadius: SLEEP_LAYOUT.cardRadiusOuter,
    overflow: 'hidden',
  },
  exerciseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SLEEP_LAYOUT.cardPadding,
    paddingVertical: 14,
  },
  exerciseRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SLEEP_THEME.border,
  },
  exerciseName: {
    fontFamily: SLEEP_FONTS.medium,
    fontSize: 15,
    lineHeight: 20,
    color: SLEEP_THEME.textPrimary,
  },
  exerciseSets: {
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 13,
    lineHeight: 16,
    color: SLEEP_THEME.textMuted1,
  },
  muscleWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  musclePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: WORKOUT_THEME.accentDim,
    borderWidth: 1,
    borderColor: 'rgba(48,209,88,0.2)',
  },
  musclePillText: {
    fontFamily: SLEEP_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: WORKOUT_THEME.accent,
    textTransform: 'capitalize',
  },
  muscleMapPlaceholder: {
    height: 100,
    borderRadius: SLEEP_LAYOUT.cardRadiusOuter,
    backgroundColor: SLEEP_THEME.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: SLEEP_THEME.border,
    borderStyle: 'dashed',
  },
  muscleMapPlaceholderText: {
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 13,
    color: SLEEP_THEME.textMuted2,
  },
  actions: { gap: 10 },
  saveBtn: {
    height: 56,
    borderRadius: SLEEP_LAYOUT.cardRadiusOuter,
    backgroundColor: WORKOUT_THEME.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 17,
    lineHeight: 22,
    color: SLEEP_THEME.screenBg,
  },
  discardBtn: {
    height: 48,
    borderRadius: SLEEP_LAYOUT.cardRadiusOuter,
    backgroundColor: SLEEP_THEME.elevatedBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discardBtnText: {
    fontFamily: SLEEP_FONTS.medium,
    fontSize: 15,
    lineHeight: 20,
    color: SLEEP_THEME.textMuted1,
  },
});
