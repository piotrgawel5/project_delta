import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import BottomSheet, {
  BottomSheetFooter,
  BottomSheetSectionList,
  BottomSheetTextInput,
  type BottomSheetFooterProps,
} from '@gorhom/bottom-sheet';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SLEEP_FONTS, WORKOUT_THEME, tabularStyle } from '@constants';
import { EXERCISES } from '@lib/workoutFixtures';
import type { Exercise, MuscleGroup } from '@shared';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props {
  sheetRef: React.RefObject<BottomSheet | null>;
  onAdd: (exerciseIds: string[]) => void;
}

interface Section {
  title: string;
  data: Exercise[];
}

function muscleLabel(m: MuscleGroup): string {
  return m
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function recentLabel(ex: Exercise): string {
  // Placeholder until exercise-history integration; show muscle group instead.
  return ex.primaryMuscles.slice(0, 1).map(muscleLabel).join(' ');
}

const PRIMARY_GROUPS: { title: string; match: (m: MuscleGroup) => boolean }[] = [
  { title: 'Chest', match: (m) => m === 'chest' },
  { title: 'Back', match: (m) => m === 'lats' || m === 'upper_back' || m === 'lower_back' },
  { title: 'Shoulders', match: (m) => m === 'front_delts' || m === 'side_delts' || m === 'rear_delts' },
  { title: 'Arms', match: (m) => m === 'biceps' || m === 'triceps' },
  { title: 'Legs', match: (m) => m === 'quads' || m === 'hamstrings' || m === 'glutes' || m === 'calves' },
  { title: 'Core', match: (m) => m === 'abs' || m === 'obliques' },
];

function buildSections(query: string): Section[] {
  const q = query.trim().toLowerCase();
  const filter = (e: Exercise) =>
    !q ||
    e.name.toLowerCase().includes(q) ||
    e.primaryMuscles.some((m) => muscleLabel(m).toLowerCase().includes(q));

  const sections: Section[] = [];
  for (const group of PRIMARY_GROUPS) {
    const items = EXERCISES.filter(
      (e) => e.primaryMuscles.some(group.match) && filter(e),
    );
    if (items.length > 0) sections.push({ title: group.title, data: items });
  }
  return sections;
}

export default function ExercisePickerSheet({ sheetRef, onAdd }: Props) {
  const snapPoints = useMemo(() => ['85%'], []);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  const sections = useMemo(() => buildSections(query), [query]);

  const toggle = useCallback((id: string) => {
    void Haptics.selectionAsync();
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const handleClear = useCallback(() => {
    if (selected.length === 0) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected([]);
  }, [selected.length]);

  const handleCancel = useCallback(() => {
    sheetRef.current?.close();
    setSelected([]);
    setQuery('');
  }, [sheetRef]);

  const handleAdd = useCallback(() => {
    if (selected.length === 0) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onAdd(selected);
    setSelected([]);
    setQuery('');
    sheetRef.current?.close();
  }, [selected, onAdd, sheetRef]);

  const ctaScale = useSharedValue(1);
  const ctaStyle = useAnimatedStyle(() => ({ transform: [{ scale: ctaScale.value }] }));

  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => (
      <BottomSheetFooter {...props} bottomInset={0}>
        <View style={styles.ctaWrap}>
          <LinearGradient
            colors={['rgba(14,14,16,0)', 'rgba(14,14,16,0.96)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 0.4 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <AnimatedPressable
            onPressIn={() => {
              ctaScale.value = withTiming(0.97, { duration: 100 });
            }}
            onPressOut={() => {
              ctaScale.value = withTiming(1, { duration: 100 });
            }}
            onPress={handleAdd}
            disabled={selected.length === 0}
            style={[
              styles.cta,
              selected.length === 0 && styles.ctaDisabled,
              ctaStyle,
            ]}>
            <View style={styles.ctaLeft}>
              <View style={styles.ctaCount}>
                <Text style={styles.ctaCountText}>{selected.length}</Text>
              </View>
              <Text style={styles.ctaText}>Add to workout</Text>
            </View>
            <MaterialCommunityIcons name="arrow-right" size={17} color={WORKOUT_THEME.bg} />
          </AnimatedPressable>
        </View>
      </BottomSheetFooter>
    ),
    [selected.length, handleAdd, ctaScale, ctaStyle],
  );

  const renderItem = useCallback(
    ({ item }: { item: Exercise }) => {
      const idx = selected.indexOf(item.id);
      const isSelected = idx !== -1;
      const order = isSelected ? idx + 1 : null;
      return (
        <Pressable
          onPress={() => toggle(item.id)}
          style={[styles.row, isSelected && styles.rowSelected]}>
          <View style={[styles.selector, isSelected && styles.selectorOn]}>
            {isSelected ? (
              <Text style={styles.orderText}>{order}</Text>
            ) : (
              <MaterialCommunityIcons name="plus" size={14} color={WORKOUT_THEME.fg3} />
            )}
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.rowMeta} numberOfLines={1}>
              {recentLabel(item)}
            </Text>
          </View>
          <MaterialCommunityIcons name="dots-horizontal" size={18} color={WORKOUT_THEME.fg4} />
        </Pressable>
      );
    },
    [selected, toggle],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: { title: string } }) => (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>{section.title}</Text>
      </View>
    ),
    [],
  );

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.handleIndicator}
      footerComponent={renderFooter}>
      <View style={styles.headerBar}>
        <Pressable onPress={handleCancel} hitSlop={6}>
          <Text style={styles.headerSide}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Build session</Text>
        <Pressable onPress={handleClear} hitSlop={6} disabled={selected.length === 0}>
          <Text
            style={[
              styles.headerSide,
              styles.headerClear,
              selected.length === 0 && styles.headerClearDisabled,
            ]}>
            Clear
          </Text>
        </Pressable>
      </View>

      <Text style={styles.subCopy}>Pick exercises to add. Drag to reorder before starting.</Text>

      <View style={styles.searchWrap}>
        <View style={styles.searchInner}>
          <MaterialCommunityIcons name="magnify" size={17} color={WORKOUT_THEME.fg3} />
          <BottomSheetTextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search 4,200+ exercises…"
            placeholderTextColor={WORKOUT_THEME.fg4}
            style={styles.searchInput}
            autoCorrect={false}
          />
          <View style={styles.filterChip}>
            <MaterialCommunityIcons name="tune-variant" size={12} color={WORKOUT_THEME.fg3} />
          </View>
        </View>
      </View>

      <BottomSheetSectionList
        sections={sections}
        keyExtractor={(item: Exercise) => item.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetBg: {
    backgroundColor: WORKOUT_THEME.surface1,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  handleIndicator: {
    width: 38,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.20)',
  },
  headerBar: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerSide: {
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 14,
    color: WORKOUT_THEME.fg3,
    minWidth: 50,
  },
  headerClear: {
    color: WORKOUT_THEME.fg2,
    textAlign: 'right',
  },
  headerClearDisabled: {
    opacity: 0.4,
  },
  headerTitle: {
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 16,
    color: WORKOUT_THEME.fg,
  },
  subCopy: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 12.5,
    color: WORKOUT_THEME.fg3,
    lineHeight: 18,
  },
  searchWrap: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  searchInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: WORKOUT_THEME.surface3,
  },
  searchInput: {
    flex: 1,
    fontFamily: SLEEP_FONTS.medium,
    fontSize: 14.5,
    color: WORKOUT_THEME.fg,
    paddingVertical: 0,
  },
  filterChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: WORKOUT_THEME.surface4,
  },
  listContent: {
    paddingBottom: 24,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 8,
    backgroundColor: WORKOUT_THEME.surface1,
  },
  sectionLabel: {
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 10.5,
    color: WORKOUT_THEME.fg3,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  row: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowSelected: {
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  selector: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: WORKOUT_THEME.surface3,
    borderWidth: 1,
    borderColor: WORKOUT_THEME.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectorOn: {
    backgroundColor: WORKOUT_THEME.fg,
    borderColor: WORKOUT_THEME.fg,
  },
  orderText: {
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 12,
    color: WORKOUT_THEME.bg,
    ...tabularStyle,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 14.5,
    color: WORKOUT_THEME.fg,
  },
  rowMeta: {
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 11.5,
    color: WORKOUT_THEME.fg3,
    marginTop: 1,
    ...tabularStyle,
  },
  ctaWrap: {
    paddingHorizontal: 16,
    paddingTop: 22,
    paddingBottom: 22,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 52,
    borderRadius: 16,
    backgroundColor: WORKOUT_THEME.fg,
  },
  ctaDisabled: {
    opacity: 0.4,
  },
  ctaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ctaCount: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: WORKOUT_THEME.bg,
    minWidth: 24,
    alignItems: 'center',
  },
  ctaCountText: {
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 12,
    color: WORKOUT_THEME.fg,
    ...tabularStyle,
  },
  ctaText: {
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 15,
    color: WORKOUT_THEME.bg,
  },
});
