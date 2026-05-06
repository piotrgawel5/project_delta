// components/nutrition/MealList.tsx
//
// SCAFFOLDING — placeholder UI listing today's nutrition logs grouped by meal type.
// Production design will use grouped sections with custom rows, swipe-to-delete,
// and per-meal totals. Keep the prop shape stable when redesigning.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SLEEP_FONTS, SLEEP_LAYOUT, SLEEP_THEME } from '../../constants/theme';
import type { MealType, NutritionLog } from '@shared';

interface MealListProps {
  logs: NutritionLog[];
  onRemove?: (id: string) => void;
}

const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

export function MealList({ logs, onRemove }: MealListProps) {
  const grouped = groupByMeal(logs);
  return (
    <View style={styles.list}>
      {MEAL_ORDER.map((meal) => {
        const items = grouped[meal] ?? [];
        if (items.length === 0) return null;
        return (
          <View key={meal} style={styles.section}>
            <Text style={styles.sectionTitle}>{MEAL_LABELS[meal]}</Text>
            {items.map((log) => (
              <Pressable
                key={log.id}
                onLongPress={() => onRemove?.(log.id)}
                style={styles.row}>
                <View style={styles.rowMain}>
                  <Text style={styles.foodName} numberOfLines={1}>
                    {log.foodName}
                  </Text>
                  <Text style={styles.foodSub}>
                    {log.foodBrand ? `${log.foodBrand} • ` : ''}
                    {Math.round(log.grams)}g
                  </Text>
                </View>
                <Text style={styles.kcal}>{Math.round(log.kcal)} kcal</Text>
              </Pressable>
            ))}
          </View>
        );
      })}
      {logs.length === 0 && (
        <Text style={styles.empty}>No meals logged yet today.</Text>
      )}
    </View>
  );
}

function groupByMeal(logs: NutritionLog[]): Record<MealType, NutritionLog[]> {
  const out: Record<MealType, NutritionLog[]> = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: [],
  };
  for (const log of logs) out[log.mealType].push(log);
  return out;
}

const styles = StyleSheet.create({
  list: {
    gap: SLEEP_LAYOUT.cardGap,
  },
  section: {
    backgroundColor: SLEEP_THEME.cardBg,
    borderRadius: SLEEP_LAYOUT.cardRadiusOuter,
    padding: SLEEP_LAYOUT.cardPadding,
    gap: 8,
  },
  sectionTitle: {
    color: SLEEP_THEME.textSecondary,
    fontFamily: SLEEP_FONTS.medium,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 12,
  },
  rowMain: {
    flex: 1,
  },
  foodName: {
    color: SLEEP_THEME.textPrimary,
    fontFamily: SLEEP_FONTS.medium,
    fontSize: 15,
  },
  foodSub: {
    color: SLEEP_THEME.textMuted1,
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 12,
    marginTop: 2,
  },
  kcal: {
    color: SLEEP_THEME.textPrimary,
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 14,
  },
  empty: {
    color: SLEEP_THEME.textMuted1,
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 24,
  },
});
