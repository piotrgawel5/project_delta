import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useWorkoutStore } from '@store/workoutStore';
import { SLEEP_FONTS, SLEEP_LAYOUT, SLEEP_THEME } from '@constants';
import { computeMuscleHeatmap, getNeglectedMuscles, isOvertrained } from '@lib/workoutAnalytics';
import { MuscleHeatmapLarge } from '@components/workout/muscleMap';
import type { MuscleGroup } from '@shared';

// Local accent palette retained for the progress screen (out of scope of the
// monochrome workout redesign — keeps the heatmap legend readable).
const PROGRESS_ACCENT = '#30D158';
const PROGRESS_ACCENT_DIM = 'rgba(48,209,88,0.15)';
const PROGRESS_OVERTRAIN_BG = 'rgba(255,69,58,0.12)';

const LOOKBACK_OPTIONS = [7, 14, 30] as const;
type LookbackDays = (typeof LOOKBACK_OPTIONS)[number];

const MUSCLE_DISPLAY_NAMES: Record<MuscleGroup, string> = {
  chest: 'Chest',
  front_delts: 'Front Delts',
  side_delts: 'Side Delts',
  rear_delts: 'Rear Delts',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  upper_back: 'Upper Back',
  lats: 'Lats',
  lower_back: 'Lower Back',
  traps: 'Traps',
  abs: 'Abs',
  obliques: 'Obliques',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  hip_flexors: 'Hip Flexors',
};

export default function WorkoutProgressScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const sessions = useWorkoutStore((s) => s.sessions);

  const [lookback, setLookback] = useState<LookbackDays>(7);

  const heatmap = useMemo(
    () => computeMuscleHeatmap(sessions, lookback),
    [sessions, lookback],
  );

  const overtrainedMuscles = useMemo<readonly MuscleGroup[]>(
    () =>
      (Object.keys(heatmap) as MuscleGroup[]).filter((m) => isOvertrained(m, sessions)),
    [heatmap, sessions],
  );

  const neglectedMuscles = useMemo(
    () => getNeglectedMuscles(sessions, lookback),
    [sessions, lookback],
  );

  const handleLookbackChange = (days: LookbackDays) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLookback(days);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          hitSlop={12}
          style={styles.backBtn}>
          <MaterialCommunityIcons
            name="chevron-left"
            size={28}
            color={SLEEP_THEME.textSecondary}
          />
        </Pressable>
        <Text style={styles.title}>Muscle Progress</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}>
        {/* Lookback toggle */}
        <Animated.View entering={FadeInDown.duration(350).delay(60)} style={styles.toggleRow}>
          {LOOKBACK_OPTIONS.map((days) => (
            <Pressable
              key={days}
              onPress={() => handleLookbackChange(days)}
              style={[styles.togglePill, lookback === days && styles.togglePillActive]}>
              <Text
                style={[styles.toggleText, lookback === days && styles.toggleTextActive]}>
                {days}d
              </Text>
            </Pressable>
          ))}
        </Animated.View>

        {/* Heatmap */}
        <Animated.View entering={FadeInDown.duration(400).delay(120)} style={styles.mapCard}>
          <MuscleHeatmapLarge heatmap={heatmap} overtrainedMuscles={overtrainedMuscles} />
        </Animated.View>

        {/* Neglected muscles */}
        {neglectedMuscles.length > 0 && (
          <Animated.View entering={FadeInDown.duration(350).delay(200)} style={styles.section}>
            <Text style={styles.sectionTitle}>
              {`Neglected (last ${lookback} days)`.toUpperCase()}
            </Text>
            <View style={styles.tagRow}>
              {neglectedMuscles.map((muscle) => (
                <View key={muscle} style={styles.tag}>
                  <Text style={styles.tagText}>{MUSCLE_DISPLAY_NAMES[muscle]}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        {/* Overtraining warning */}
        {overtrainedMuscles.length > 0 && (
          <Animated.View entering={FadeInDown.duration(350).delay(260)} style={styles.section}>
            <Text style={styles.sectionTitle}>OVERTRAINING RISK</Text>
            <View style={styles.tagRow}>
              {overtrainedMuscles.map((muscle) => (
                <View key={muscle} style={[styles.tag, styles.tagDanger]}>
                  <Text style={[styles.tagText, styles.tagTextDanger]}>
                    {MUSCLE_DISPLAY_NAMES[muscle]}
                  </Text>
                </View>
              ))}
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SLEEP_THEME.screenBg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SLEEP_LAYOUT.screenPaddingH,
    paddingVertical: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 18,
    lineHeight: 24,
    color: SLEEP_THEME.textPrimary,
  },
  scroll: {
    flex: 1,
  },
  content: {
    gap: SLEEP_LAYOUT.cardGap,
    paddingHorizontal: SLEEP_LAYOUT.screenPaddingH,
    paddingTop: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  togglePill: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: SLEEP_LAYOUT.cardRadiusInner,
    backgroundColor: SLEEP_THEME.cardBg,
  },
  togglePillActive: {
    backgroundColor: PROGRESS_ACCENT_DIM,
  },
  toggleText: {
    fontFamily: SLEEP_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
    color: SLEEP_THEME.textMuted1,
  },
  toggleTextActive: {
    color: PROGRESS_ACCENT,
    fontFamily: SLEEP_FONTS.semiBold,
  },
  mapCard: {
    backgroundColor: SLEEP_THEME.cardBg,
    borderRadius: SLEEP_LAYOUT.cardRadiusOuter,
    padding: SLEEP_LAYOUT.cardPadding,
    alignItems: 'center',
  },
  section: {
    backgroundColor: SLEEP_THEME.cardBg,
    borderRadius: SLEEP_LAYOUT.cardRadiusOuter,
    padding: SLEEP_LAYOUT.cardPadding,
    gap: 10,
  },
  sectionTitle: {
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 11,
    lineHeight: 14,
    color: SLEEP_THEME.textMuted1,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: SLEEP_THEME.elevatedBg,
  },
  tagDanger: {
    backgroundColor: PROGRESS_OVERTRAIN_BG,
  },
  tagText: {
    fontFamily: SLEEP_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
    color: SLEEP_THEME.textSecondary,
  },
  tagTextDanger: {
    color: SLEEP_THEME.danger,
  },
});
