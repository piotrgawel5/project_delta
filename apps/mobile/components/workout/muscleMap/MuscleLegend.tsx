import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SLEEP_FONTS, SLEEP_THEME } from '@constants';
import { INTENSITY_COLORS, INTENSITY_LABELS, OVERTRAIN_COLOR } from './MuscleHeatmapSVG';

export default memo(function MuscleLegend() {
  return (
    <View style={styles.row}>
      {INTENSITY_LABELS.map((label, i) => (
        <View key={label} style={styles.item}>
          <View style={[styles.chip, { backgroundColor: INTENSITY_COLORS[i] }]} />
          <Text style={styles.label}>{label}</Text>
        </View>
      ))}
      <View style={styles.item}>
        <View style={[styles.chip, { backgroundColor: OVERTRAIN_COLOR }]} />
        <Text style={styles.label}>Overtrain</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  chip: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  label: {
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 11,
    lineHeight: 14,
    color: SLEEP_THEME.textMuted1,
  },
});
