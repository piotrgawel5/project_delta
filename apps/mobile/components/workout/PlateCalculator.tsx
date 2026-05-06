// components/workout/PlateCalculator.tsx
//
// Lightweight modal that visualizes how to load a barbell to hit `targetKg`.
// Pure render — math lives in `lib/plateCalc.ts`.

import { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SLEEP_FONTS, WORKOUT_THEME } from '@constants';
import { calcPlates } from '@lib/plateCalc';

interface Props {
  visible: boolean;
  targetKg: number;
  barKg?: number;
  onClose: () => void;
}

const PLATE_COLORS: Record<number, string> = {
  25: '#FF453A',   // red
  20: '#0A84FF',   // blue
  15: '#FFD60A',   // yellow
  10: '#30D158',   // green
  5: '#FFFFFF',    // white
  2.5: '#1C1C1E',  // black
  1.25: '#8E8E93', // grey
};

export default function PlateCalculator({ visible, targetKg, barKg = 20, onClose }: Props) {
  const breakdown = useMemo(() => calcPlates(targetKg, barKg), [targetKg, barKg]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <BlurView intensity={30} tint="dark" style={styles.scrimBlur} />
      </Pressable>
      <View style={styles.sheet} pointerEvents="box-none">
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Plate calculator</Text>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <MaterialCommunityIcons name="close" size={18} color={WORKOUT_THEME.fg2} />
            </Pressable>
          </View>

          <Text style={styles.target}>{targetKg} kg</Text>
          <Text style={styles.bar}>Bar: {barKg} kg</Text>

          <View style={styles.barbellRow}>
            <View style={styles.barShaft} />
            {breakdown.perSide.map((p, i) => (
              <View
                key={`${i}-${p}`}
                style={[
                  styles.plate,
                  {
                    backgroundColor: PLATE_COLORS[p] ?? WORKOUT_THEME.fg2,
                    height: 38 + (p / 25) * 24,
                  },
                ]}>
                <Text style={styles.plateLabel}>{p}</Text>
              </View>
            ))}
            <View style={styles.barCollar} />
          </View>

          <Text style={styles.legend}>
            Per side: {breakdown.perSide.length === 0 ? 'no plates' : breakdown.perSide.join(' · ')}
          </Text>

          {breakdown.remainderKg > 0 && (
            <Text style={styles.remainder}>
              Closest: {breakdown.achievedKg} kg ({breakdown.remainderKg} kg short)
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject },
  scrimBlur: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: WORKOUT_THEME.surface2,
    borderRadius: 22,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: WORKOUT_THEME.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 16,
    color: WORKOUT_THEME.fg,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WORKOUT_THEME.overlayWhite05,
  },
  target: {
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 36,
    color: WORKOUT_THEME.fg,
    marginTop: 12,
  },
  bar: {
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 12,
    color: WORKOUT_THEME.fg3,
    marginBottom: 16,
  },
  barbellRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    minHeight: 64,
    paddingVertical: 8,
  },
  barShaft: {
    flex: 1,
    height: 4,
    backgroundColor: WORKOUT_THEME.fg3,
    borderRadius: 2,
  },
  barCollar: {
    width: 8,
    height: 24,
    backgroundColor: WORKOUT_THEME.fg2,
    borderRadius: 2,
    marginLeft: 4,
  },
  plate: {
    width: 14,
    marginLeft: 2,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plateLabel: {
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 8,
    color: '#000000',
    transform: [{ rotate: '-90deg' }],
  },
  legend: {
    fontFamily: SLEEP_FONTS.medium,
    fontSize: 13,
    color: WORKOUT_THEME.fg2,
    marginTop: 12,
  },
  remainder: {
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 12,
    color: WORKOUT_THEME.fg3,
    marginTop: 4,
  },
});
