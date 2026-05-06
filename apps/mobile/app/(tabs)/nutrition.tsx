// app/(tabs)/nutrition.tsx
//
// SCAFFOLDING — minimal screen wiring the nutrition pillar end-to-end.
// All visuals here are placeholders; the production design will replace this
// file wholesale with the proper hero, ring, and meal sections per Figma.
//
// Wire-up in place:
//   1. Fetches today's logs from `nutritionStore.fetchLogs(userId)` on mount.
//   2. Renders `MacroRing` from selectMacrosForDate.
//   3. Renders `MealList` from selectLogsForDate.
//   4. Floating "+ Add" button opens `FoodSearchSheet` which calls
//      `nutritionStore.logFood({ ... })` — optimistic + queued sync.
//
// Replacement guidance:
//   - Keep the store action contract (logFood, fetchLogs, removeLog).
//   - Keep `useAuthStore(s => s.user)` as the userId source.
//   - If the production redesign needs a different layout, extract the data
//     plumbing (effect + selectors) into a hook so visuals are pure.

import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SLEEP_FONTS, SLEEP_LAYOUT, SLEEP_THEME } from '../../constants/theme';
import { useAuthStore } from '@store/authStore';
import {
  computeMacrosForLogs,
  selectLogsForDate,
  useNutritionStore,
} from '@store/nutritionStore';
import { MacroRing } from '../../components/nutrition/MacroRing';
import { MealList } from '../../components/nutrition/MealList';
import { FoodSearchSheet } from '../../components/nutrition/FoodSearchSheet';
import { MorningBriefCard } from '../../components/home/MorningBriefCard';
import { useMorningBrief } from '@lib/useMorningBrief';
import type { Food, MealType } from '@shared';

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function NutritionScreen() {
  const user = useAuthStore((s) => s.user);
  const today = useMemo(() => todayKey(), []);

  const fetchLogs = useNutritionStore((s) => s.fetchLogs);
  const logFood = useNutritionStore((s) => s.logFood);
  const removeLog = useNutritionStore((s) => s.removeLog);
  const searchFoods = useNutritionStore((s) => s.searchFoods);
  const isLoaded = useNutritionStore((s) => s.isLoaded);

  const logsSelector = useMemo(() => selectLogsForDate(today), [today]);
  const logs = useNutritionStore(logsSelector);
  const macros = useMemo(() => computeMacrosForLogs(logs), [logs]);

  const [sheetOpen, setSheetOpen] = useState(false);
  const morningBrief = useMorningBrief();

  useEffect(() => {
    if (user?.id) void fetchLogs(user.id);
  }, [user?.id, fetchLogs]);

  const handleLog = async (food: Food, grams: number, meal: MealType) => {
    if (!user?.id) return;
    await logFood({ userId: user.id, date: today, mealType: meal, food, grams });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Nutrition</Text>
        <Text style={styles.subtitle}>{today}</Text>

        <MorningBriefCard insight={morningBrief} />

        <MacroRing macros={macros} />

        <View style={styles.spacer} />

        <MealList logs={logs} onRemove={removeLog} />

        {!isLoaded && logs.length === 0 && (
          <Text style={styles.loading}>Loading…</Text>
        )}
      </ScrollView>

      <Pressable style={styles.fab} onPress={() => setSheetOpen(true)} accessibilityLabel="Add food">
        <Text style={styles.fabText}>+ Add</Text>
      </Pressable>

      <FoodSearchSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onLog={handleLog}
        searchFoods={searchFoods}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SLEEP_THEME.screenBg,
  },
  content: {
    paddingHorizontal: SLEEP_LAYOUT.screenPaddingH,
    paddingTop: 24,
    paddingBottom: 140,
    gap: 12,
  },
  title: {
    color: SLEEP_THEME.textPrimary,
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 32,
  },
  subtitle: {
    color: SLEEP_THEME.textMuted1,
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 14,
    marginBottom: 8,
  },
  spacer: {
    height: 8,
  },
  loading: {
    color: SLEEP_THEME.textMuted1,
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 13,
    textAlign: 'center',
    paddingTop: 24,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 100,
    backgroundColor: SLEEP_THEME.success,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 999,
  },
  fabText: {
    color: '#000000',
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 14,
  },
});
