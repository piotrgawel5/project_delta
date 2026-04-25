import { memo, useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
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
import type { SessionMetadata } from '@store/workoutStore';

const SPRING = { damping: 16, stiffness: 220 } as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// ─── Stat pill ────────────────────────────────────────────────────────────────

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

// ─── Rating selector ─────────────────────────────────────────────────────────

const RatingSelector = memo(function RatingSelector({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.ratingRow}>
      {options.map((label, i) => {
        const optValue = i + 1;
        const isActive = value === optValue;
        return (
          <Pressable
            key={label}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onChange(optValue);
            }}
            style={[styles.ratingPill, isActive && styles.ratingPillActive]}>
            <Text style={[styles.ratingPillText, isActive && styles.ratingPillTextActive]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
});

// ─── Props ────────────────────────────────────────────────────────────────────

interface WorkoutFinishSheetProps {
  sheetRef: React.RefObject<BottomSheet | null>;
  session: WorkoutSession | null;
  onSave: (metadata: SessionMetadata) => Promise<void>;
  onDiscard: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function WorkoutFinishSheet({
  sheetRef,
  session,
  onSave,
  onDiscard,
}: WorkoutFinishSheetProps) {
  const snapPoints = useMemo(() => ['92%'], []);
  const saveScale = useSharedValue(1);

  const [name, setName] = useState('');
  const [feelRating, setFeelRating] = useState<number | null>(null);
  const [difficultyRating, setDifficultyRating] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const saveStyle = useAnimatedStyle(() => ({
    transform: [{ scale: saveScale.value }],
  }));

  const totalSets = useMemo(() => (session ? getTotalSets(session) : 0), [session]);

  const exerciseNames = useMemo(() => {
    if (!session) return [];
    return session.exercises
      .map((log) => getExerciseById(log.exerciseId)?.name ?? log.exerciseId)
      .slice(0, 6);
  }, [session]);

  const musclesTrained = useMemo(
    () => (session ? getSessionMuscles(session) : []),
    [session],
  );

  const resetForm = useCallback(() => {
    setName('');
    setFeelRating(null);
    setDifficultyRating(null);
    setNotes('');
    setShowConfirm(false);
  }, []);

  const handleSheetChange = useCallback(
    (index: number) => {
      if (index === -1) resetForm();
    },
    [resetForm],
  );

  const handleSave = useCallback(async () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await onSave({
      name: name.trim() || null,
      feelRating,
      difficultyRating,
      notes: notes.trim() || null,
    });
    sheetRef.current?.close();
    resetForm();
  }, [onSave, name, feelRating, difficultyRating, notes, sheetRef, resetForm]);

  const handleDiscard = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onDiscard();
    sheetRef.current?.close();
    resetForm();
  }, [onDiscard, sheetRef, resetForm]);

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.handle}
      onChange={handleSheetChange}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>

        {/* Header */}
        <Animated.View entering={FadeInDown.duration(300).delay(60)} style={styles.header}>
          <View style={styles.trophyWrap}>
            <MaterialCommunityIcons name="trophy" size={28} color={WORKOUT_THEME.accent} />
          </View>
          <Text style={styles.title}>Workout Complete</Text>
          <Text style={styles.subtitle}>Nice work — save your session details.</Text>
        </Animated.View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatPill value={totalSets.toString()} label="Sets" delay={120} />
          <StatPill value={(session?.exercises.length ?? 0).toString()} label="Exercises" delay={160} />
          <StatPill value={formatDuration(session?.durationSeconds ?? null)} label="Duration" delay={200} />
        </View>

        <View style={styles.divider} />

        {/* Session name */}
        <Animated.View entering={FadeInDown.duration(300).delay(240)} style={styles.section}>
          <Text style={styles.sectionTitle}>Session Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Morning workout"
            placeholderTextColor={SLEEP_THEME.textMuted2}
            returnKeyType="done"
            maxLength={100}
          />
        </Animated.View>

        {/* Feel */}
        <Animated.View entering={FadeInDown.duration(300).delay(280)} style={styles.section}>
          <Text style={styles.sectionTitle}>How did it feel?</Text>
          <RatingSelector
            options={['Rough', 'OK', 'Good', 'Great']}
            value={feelRating}
            onChange={setFeelRating}
          />
        </Animated.View>

        {/* Difficulty */}
        <Animated.View entering={FadeInDown.duration(300).delay(320)} style={styles.section}>
          <Text style={styles.sectionTitle}>Difficulty</Text>
          <RatingSelector
            options={['Easy', 'Moderate', 'Hard', 'Full Effort']}
            value={difficultyRating}
            onChange={setDifficultyRating}
          />
        </Animated.View>

        {/* Notes */}
        <Animated.View entering={FadeInDown.duration(300).delay(360)} style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Optional notes about this session…"
            placeholderTextColor={SLEEP_THEME.textMuted2}
            multiline
            textAlignVertical="top"
            maxLength={1000}
          />
        </Animated.View>

        {/* Exercises summary */}
        {exerciseNames.length > 0 && (
          <Animated.View entering={FadeInDown.duration(300).delay(400)} style={styles.section}>
            <Text style={styles.sectionTitle}>Exercises</Text>
            <View style={styles.card}>
              {exerciseNames.map((exName, i) => (
                <View
                  key={exName}
                  style={[
                    styles.exerciseRow,
                    i < exerciseNames.length - 1 && styles.exerciseRowBorder,
                  ]}>
                  <Text style={styles.exerciseName}>{exName}</Text>
                  <Text style={styles.exerciseSets}>
                    {session?.exercises[i]?.sets.length ?? 0} sets
                  </Text>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        {/* Muscles */}
        {musclesTrained.length > 0 && (
          <Animated.View entering={FadeInDown.duration(300).delay(440)} style={styles.section}>
            <Text style={styles.sectionTitle}>Muscles Trained</Text>
            <View style={styles.muscleWrap}>
              {musclesTrained.map((m) => (
                <View key={m} style={styles.musclePill}>
                  <Text style={styles.musclePillText}>{m.replace('_', ' ')}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        {/* Actions */}
        <Animated.View entering={FadeInDown.duration(300).delay(480)} style={styles.actions}>
          {showConfirm ? (
            <Animated.View
              entering={FadeInDown.duration(250)}
              style={styles.confirmCard}>
              <Text style={styles.confirmTitle}>Discard this workout?</Text>
              <Text style={styles.confirmBody}>All progress will be lost.</Text>
              <Pressable
                onPress={() => setShowConfirm(false)}
                style={styles.keepBtn}>
                <Text style={styles.keepBtnText}>Keep Workout</Text>
              </Pressable>
              <Pressable onPress={handleDiscard} style={styles.discardForeverBtn}>
                <Text style={styles.discardForeverText}>Discard Forever</Text>
              </Pressable>
            </Animated.View>
          ) : (
            <>
              <Animated.View style={saveStyle}>
                <Pressable
                  onPressIn={() => {
                    saveScale.value = withSpring(0.96, SPRING);
                  }}
                  onPressOut={() => {
                    saveScale.value = withSpring(1, SPRING);
                  }}
                  onPress={handleSave}
                  style={styles.saveBtn}>
                  <Text style={styles.saveBtnText}>Save Workout</Text>
                </Pressable>
              </Animated.View>

              <Pressable
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowConfirm(true);
                }}
                style={styles.discardBtn}>
                <Text style={styles.discardBtnText}>Discard Workout</Text>
              </Pressable>
            </>
          )}
        </Animated.View>
      </ScrollView>
    </BottomSheet>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  sheetBg: { backgroundColor: SLEEP_THEME.bottomSheetBg },
  handle: { backgroundColor: SLEEP_THEME.border },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: SLEEP_LAYOUT.screenPaddingH,
    paddingBottom: 48,
    gap: 20,
  },

  // Header
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

  // Stats
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
    fontSize: 24,
    lineHeight: 28,
    color: SLEEP_THEME.textPrimary,
    marginBottom: 4,
  },
  statLabel: {
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 12,
    lineHeight: 16,
    color: SLEEP_THEME.textMuted1,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: SLEEP_THEME.border,
    marginVertical: 4,
  },

  // Form sections
  section: { gap: 10 },
  sectionTitle: {
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 11,
    lineHeight: 14,
    color: SLEEP_THEME.textMuted1,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  input: {
    backgroundColor: SLEEP_THEME.cardBg,
    borderRadius: SLEEP_LAYOUT.cardRadiusInner,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 15,
    lineHeight: 20,
    color: SLEEP_THEME.textPrimary,
  },
  notesInput: {
    minHeight: 80,
    paddingTop: 14,
  },

  // Rating selector
  ratingRow: {
    flexDirection: 'row',
    gap: 8,
  },
  ratingPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: SLEEP_LAYOUT.cardRadiusInner,
    backgroundColor: SLEEP_THEME.cardBg,
    borderWidth: 1,
    borderColor: SLEEP_THEME.border,
    alignItems: 'center',
  },
  ratingPillActive: {
    backgroundColor: WORKOUT_THEME.accentDim,
    borderColor: WORKOUT_THEME.accent,
  },
  ratingPillText: {
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 11,
    lineHeight: 14,
    color: SLEEP_THEME.textMuted1,
    textAlign: 'center',
  },
  ratingPillTextActive: {
    fontFamily: SLEEP_FONTS.semiBold,
    color: WORKOUT_THEME.accent,
  },

  // Exercises summary
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

  // Muscles
  muscleWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  musclePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: SLEEP_LAYOUT.cardRadiusInner,
    backgroundColor: WORKOUT_THEME.accentDim,
  },
  musclePillText: {
    fontFamily: SLEEP_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: WORKOUT_THEME.accent,
    textTransform: 'capitalize',
  },

  // Actions
  actions: { gap: 10 },
  saveBtn: {
    height: 56,
    borderRadius: SLEEP_LAYOUT.cardRadiusOuter,
    backgroundColor: SLEEP_THEME.textPrimary,
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
    backgroundColor: 'rgba(255,69,58,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  discardBtnText: {
    fontFamily: SLEEP_FONTS.medium,
    fontSize: 15,
    lineHeight: 20,
    color: SLEEP_THEME.danger,
  },

  // Discard confirmation card
  confirmCard: {
    backgroundColor: SLEEP_THEME.cardBg,
    borderRadius: SLEEP_LAYOUT.cardRadiusOuter,
    padding: SLEEP_LAYOUT.cardPadding,
    gap: 12,
  },
  confirmTitle: {
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
    color: SLEEP_THEME.textPrimary,
  },
  confirmBody: {
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    color: SLEEP_THEME.textMuted1,
    marginBottom: 4,
  },
  keepBtn: {
    height: 52,
    borderRadius: SLEEP_LAYOUT.cardRadiusOuter,
    backgroundColor: SLEEP_THEME.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keepBtnText: {
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 15,
    lineHeight: 20,
    color: SLEEP_THEME.screenBg,
  },
  discardForeverBtn: {
    height: 48,
    borderRadius: SLEEP_LAYOUT.cardRadiusOuter,
    backgroundColor: 'rgba(255,69,58,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  discardForeverText: {
    fontFamily: SLEEP_FONTS.medium,
    fontSize: 15,
    lineHeight: 20,
    color: SLEEP_THEME.danger,
  },
});
