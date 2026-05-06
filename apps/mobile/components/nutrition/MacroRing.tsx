// components/nutrition/MacroRing.tsx
//
// SCAFFOLDING — placeholder UI for the nutrition pillar.
// The production design will use react-native-svg with a real ring shape, animated
// progress arcs, and macro-color-coded segments. For now this renders a flat card
// that surfaces the four totals so the data flow is testable end-to-end.
//
// When you replace this:
//   - Keep the prop shape (`macros`, `targets`).
//   - Use SLEEP_THEME tokens; no raw hex.
//   - Use react-native-svg <Circle> with strokeDasharray for ring progress.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SLEEP_FONTS, SLEEP_LAYOUT, SLEEP_THEME } from '../../constants/theme';
import type { Macros } from '@shared';

interface MacroRingProps {
  macros: Macros;
  targets?: Macros;
}

export function MacroRing({ macros, targets }: MacroRingProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Today</Text>

      <View style={styles.row}>
        <Stat label="kcal" value={Math.round(macros.calories)} target={targets?.calories} />
      </View>

      <View style={styles.macroRow}>
        <Stat label="protein" value={Math.round(macros.protein)} target={targets?.protein} suffix="g" small />
        <Stat label="carbs" value={Math.round(macros.carbs)} target={targets?.carbs} suffix="g" small />
        <Stat label="fats" value={Math.round(macros.fats)} target={targets?.fats} suffix="g" small />
      </View>
    </View>
  );
}

interface StatProps {
  label: string;
  value: number;
  target?: number;
  suffix?: string;
  small?: boolean;
}

function Stat({ label, value, target, suffix = '', small }: StatProps) {
  return (
    <View style={[styles.stat, small && styles.statSmall]}>
      <Text style={[styles.value, small && styles.valueSmall]}>
        {value}
        {suffix}
      </Text>
      {target !== undefined && (
        <Text style={styles.target}>
          / {Math.round(target)}
          {suffix}
        </Text>
      )}
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: SLEEP_THEME.cardBg,
    padding: SLEEP_LAYOUT.cardPadding,
    borderRadius: SLEEP_LAYOUT.cardRadiusOuter,
    gap: 12,
  },
  title: {
    fontFamily: SLEEP_FONTS.semiBold,
    color: SLEEP_THEME.textPrimary,
    fontSize: 18,
  },
  row: {
    flexDirection: 'row',
  },
  macroRow: {
    flexDirection: 'row',
    gap: 12,
  },
  stat: {
    flex: 1,
  },
  statSmall: {
    alignItems: 'flex-start',
  },
  value: {
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 28,
    color: SLEEP_THEME.textPrimary,
  },
  valueSmall: {
    fontSize: 18,
  },
  target: {
    fontFamily: SLEEP_FONTS.regular,
    color: SLEEP_THEME.textMuted1,
    fontSize: 12,
  },
  label: {
    fontFamily: SLEEP_FONTS.regular,
    color: SLEEP_THEME.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
});
