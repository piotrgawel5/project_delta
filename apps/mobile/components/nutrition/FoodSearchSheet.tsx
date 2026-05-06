// components/nutrition/FoodSearchSheet.tsx
//
// SCAFFOLDING — minimal modal for searching foods and logging a meal.
// The production version will be a `@gorhom/bottom-sheet` with snap points,
// debounced search, recent foods, favorites, barcode shortcut, and grams
// stepper. Keep the prop signature so the swap is painless.
//
// Wire-up:
//   - `onClose` is called for both confirmed log and cancel.
//   - `onLog` is called with `(food, grams, mealType)` after the user confirms.
//   - Search hits the live nutrition store action `searchFoods`.

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SLEEP_FONTS, SLEEP_LAYOUT, SLEEP_THEME } from '../../constants/theme';
import type { Food, MealType } from '@shared';

interface FoodSearchSheetProps {
  visible: boolean;
  onClose: () => void;
  onLog: (food: Food, grams: number, meal: MealType) => Promise<void> | void;
  searchFoods: (q: string) => Promise<Food[]>;
}

const MEAL_OPTIONS: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export function FoodSearchSheet({ visible, onClose, onLog, searchFoods }: FoodSearchSheetProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Food[]>([]);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Food | null>(null);
  const [grams, setGrams] = useState('100');
  const [meal, setMeal] = useState<MealType>('snack');

  const runSearch = useCallback(async () => {
    if (!query.trim()) return;
    setBusy(true);
    try {
      const res = await searchFoods(query);
      setResults(res);
    } finally {
      setBusy(false);
    }
  }, [query, searchFoods]);

  const reset = () => {
    setQuery('');
    setResults([]);
    setSelected(null);
    setGrams('100');
    setMeal('snack');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleConfirm = async () => {
    if (!selected) return;
    const g = Number(grams);
    if (!Number.isFinite(g) || g <= 0) return;
    await onLog(selected, g, meal);
    handleClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Add food</Text>
            <Pressable onPress={handleClose} hitSlop={12}>
              <Text style={styles.close}>Close</Text>
            </Pressable>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Search by name or brand"
            placeholderTextColor={SLEEP_THEME.textMuted1}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={runSearch}
            returnKeyType="search"
          />

          {busy && <ActivityIndicator color={SLEEP_THEME.textPrimary} />}

          {!selected && (
            <View style={styles.results}>
              {results.map((f) => (
                <Pressable key={f.id} style={styles.resultRow} onPress={() => setSelected(f)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultName} numberOfLines={1}>
                      {f.name}
                    </Text>
                    <Text style={styles.resultSub}>
                      {f.brand ?? f.source} • {Math.round(f.kcalPer100g)} kcal/100g
                    </Text>
                  </View>
                </Pressable>
              ))}
              {!busy && results.length === 0 && query.length > 0 && (
                <Text style={styles.empty}>No results. Try another search.</Text>
              )}
            </View>
          )}

          {selected && (
            <View style={styles.detail}>
              <Text style={styles.detailName}>{selected.name}</Text>
              <Text style={styles.detailSub}>
                {Math.round(selected.kcalPer100g)} kcal · P {Math.round(selected.proteinPer100g)} ·
                C {Math.round(selected.carbsPer100g)} · F {Math.round(selected.fatsPer100g)} (per 100g)
              </Text>

              <Text style={styles.fieldLabel}>Grams</Text>
              <TextInput
                style={styles.input}
                value={grams}
                onChangeText={setGrams}
                keyboardType="numeric"
              />

              <Text style={styles.fieldLabel}>Meal</Text>
              <View style={styles.mealRow}>
                {MEAL_OPTIONS.map((m) => (
                  <Pressable
                    key={m}
                    style={[styles.mealChip, meal === m && styles.mealChipActive]}
                    onPress={() => setMeal(m)}>
                    <Text
                      style={[styles.mealChipText, meal === m && styles.mealChipTextActive]}>
                      {m}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Pressable style={styles.confirm} onPress={handleConfirm}>
                <Text style={styles.confirmText}>Log meal</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: SLEEP_THEME.bottomSheetBg,
    padding: SLEEP_LAYOUT.cardPadding,
    borderTopLeftRadius: SLEEP_LAYOUT.cardRadiusOuter,
    borderTopRightRadius: SLEEP_LAYOUT.cardRadiusOuter,
    minHeight: '70%',
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: SLEEP_THEME.textPrimary,
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 18,
  },
  close: {
    color: SLEEP_THEME.textSecondary,
    fontFamily: SLEEP_FONTS.medium,
    fontSize: 14,
  },
  input: {
    backgroundColor: SLEEP_THEME.elevatedBg,
    color: SLEEP_THEME.textPrimary,
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 15,
    padding: 12,
    borderRadius: SLEEP_LAYOUT.cardRadiusInner,
  },
  results: {
    gap: 8,
  },
  resultRow: {
    paddingVertical: 10,
    borderBottomColor: SLEEP_THEME.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  resultName: {
    color: SLEEP_THEME.textPrimary,
    fontFamily: SLEEP_FONTS.medium,
    fontSize: 15,
  },
  resultSub: {
    color: SLEEP_THEME.textMuted1,
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 12,
    marginTop: 2,
  },
  empty: {
    color: SLEEP_THEME.textMuted1,
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 16,
  },
  detail: {
    gap: 8,
  },
  detailName: {
    color: SLEEP_THEME.textPrimary,
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 16,
  },
  detailSub: {
    color: SLEEP_THEME.textMuted1,
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 12,
  },
  fieldLabel: {
    color: SLEEP_THEME.textSecondary,
    fontFamily: SLEEP_FONTS.medium,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 8,
  },
  mealRow: {
    flexDirection: 'row',
    gap: 8,
  },
  mealChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: SLEEP_THEME.elevatedBg,
  },
  mealChipActive: {
    backgroundColor: SLEEP_THEME.success,
  },
  mealChipText: {
    color: SLEEP_THEME.textSecondary,
    fontFamily: SLEEP_FONTS.medium,
    fontSize: 12,
    textTransform: 'capitalize',
  },
  mealChipTextActive: {
    color: '#000000',
  },
  confirm: {
    backgroundColor: SLEEP_THEME.success,
    paddingVertical: 14,
    borderRadius: SLEEP_LAYOUT.cardRadiusInner,
    alignItems: 'center',
    marginTop: 12,
  },
  confirmText: {
    color: '#000000',
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 15,
  },
});
