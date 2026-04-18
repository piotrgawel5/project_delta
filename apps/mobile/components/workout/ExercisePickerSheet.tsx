import { memo, useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import BottomSheet, { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { SLEEP_FONTS, SLEEP_LAYOUT, SLEEP_THEME, WORKOUT_THEME } from '@constants';
import {
  EXERCISE_CATEGORIES,
  EXERCISES,
  getExercisesByCategory,
} from '@lib/workoutFixtures';
import type { Exercise, MuscleGroup } from '@shared';

const MUSCLE_LABEL: Partial<Record<MuscleGroup, string>> = {
  chest: 'Chest',
  front_delts: 'Front Delts',
  side_delts: 'Side Delts',
  rear_delts: 'Rear Delts',
  biceps: 'Biceps',
  triceps: 'Triceps',
  lats: 'Lats',
  upper_back: 'Upper Back',
  lower_back: 'Lower Back',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  abs: 'Abs',
  calves: 'Calves',
};

function muscleLabel(m: MuscleGroup): string {
  return MUSCLE_LABEL[m] ?? m.replace('_', ' ');
}

const ExerciseRow = memo(function ExerciseRow({
  exercise,
  onAdd,
}: {
  exercise: Exercise;
  onAdd: (id: string) => void;
}) {
  return (
    <Pressable
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onAdd(exercise.id);
      }}
      style={({ pressed }) => [styles.exerciseRow, pressed && styles.exerciseRowPressed]}>
      <View style={styles.exerciseInfo}>
        <Text style={styles.exerciseName}>{exercise.name}</Text>
        <View style={styles.muscleBadges}>
          {exercise.primaryMuscles.slice(0, 2).map((m) => (
            <View key={m} style={styles.muscleBadge}>
              <Text style={styles.muscleBadgeText}>{muscleLabel(m)}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.addIconWrap}>
        <Ionicons name="add" size={22} color={WORKOUT_THEME.accent} />
      </View>
    </Pressable>
  );
});

interface ExercisePickerSheetProps {
  sheetRef: React.RefObject<BottomSheet | null>;
  onAdd: (exerciseId: string) => void;
}

export default function ExercisePickerSheet({ sheetRef, onAdd }: ExercisePickerSheetProps) {
  const snapPoints = useMemo(() => ['60%', '92%'], []);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const inputRef = useRef<TextInput>(null);

  const filtered = useMemo(() => {
    const byCategory = getExercisesByCategory(activeCategory);
    if (!query.trim()) return byCategory;
    const q = query.toLowerCase();
    return byCategory.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.primaryMuscles.some((m) => m.includes(q))
    );
  }, [activeCategory, query]);

  const handleAdd = useCallback(
    (id: string) => {
      onAdd(id);
      sheetRef.current?.close();
    },
    [onAdd, sheetRef]
  );

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.handle}>
      <View style={styles.inner}>
        {/* Search */}
        <View style={styles.searchRow}>
          <Ionicons name="search" size={16} color={SLEEP_THEME.textMuted1} style={styles.searchIcon} />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search exercises..."
            placeholderTextColor={SLEEP_THEME.textMuted2}
            clearButtonMode="while-editing"
            returnKeyType="search"
          />
        </View>

        {/* Category filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categories}>
          {EXERCISE_CATEGORIES.map((cat) => (
            <Pressable
              key={cat.id}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveCategory(cat.id);
              }}
              style={[
                styles.categoryPill,
                activeCategory === cat.id && styles.categoryPillActive,
              ]}>
              <Text
                style={[
                  styles.categoryPillText,
                  activeCategory === cat.id && styles.categoryPillTextActive,
                ]}>
                {cat.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Exercise list */}
        <BottomSheetFlatList<Exercise>
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ExerciseRow exercise={item} onAdd={handleAdd} />}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text style={styles.emptyText}>No exercises found</Text>
          }
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetBg: { backgroundColor: SLEEP_THEME.bottomSheetBg },
  handle: { backgroundColor: SLEEP_THEME.border },
  inner: { flex: 1 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SLEEP_LAYOUT.screenPaddingH,
    marginBottom: 12,
    backgroundColor: SLEEP_THEME.cardBg,
    borderRadius: SLEEP_LAYOUT.cardRadiusInner,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 16,
    color: SLEEP_THEME.textPrimary,
    padding: 0,
  },
  categories: {
    paddingHorizontal: SLEEP_LAYOUT.screenPaddingH,
    paddingBottom: 12,
    gap: 8,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: SLEEP_THEME.cardBg,
  },
  categoryPillActive: {
    backgroundColor: WORKOUT_THEME.accentDim,
    borderWidth: 1,
    borderColor: WORKOUT_THEME.accent,
  },
  categoryPillText: {
    fontFamily: SLEEP_FONTS.medium,
    fontSize: 13,
    lineHeight: 16,
    color: SLEEP_THEME.textMuted1,
  },
  categoryPillTextActive: {
    color: WORKOUT_THEME.accent,
  },
  listContent: {
    paddingHorizontal: SLEEP_LAYOUT.screenPaddingH,
    paddingBottom: 40,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SLEEP_THEME.border,
  },
  exerciseRowPressed: {
    opacity: 0.6,
  },
  exerciseInfo: { flex: 1 },
  exerciseName: {
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 16,
    lineHeight: 20,
    color: SLEEP_THEME.textPrimary,
    marginBottom: 4,
  },
  muscleBadges: {
    flexDirection: 'row',
    gap: 6,
  },
  muscleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: SLEEP_THEME.elevatedBg,
  },
  muscleBadgeText: {
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 11,
    lineHeight: 14,
    color: SLEEP_THEME.textMuted1,
  },
  addIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: WORKOUT_THEME.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 15,
    color: SLEEP_THEME.textMuted2,
    textAlign: 'center',
    marginTop: 40,
  },
});
