import { memo, useMemo } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { MuscleGroup, MuscleIntensity } from '@shared';
import { SLEEP_FONTS, SLEEP_LAYOUT, SLEEP_THEME } from '@constants';
import MuscleHeatmapSVG from './MuscleHeatmapSVG';
import MuscleLegend from './MuscleLegend';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// Both-sides view: 200×180 ratio — constrain to screen width minus padding
const MAP_WIDTH = Math.min(SCREEN_WIDTH - SLEEP_LAYOUT.screenPaddingH * 2, 320);

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

interface MuscleHeatmapLargeProps {
  heatmap: Record<MuscleGroup, MuscleIntensity>;
  overtrainedMuscles?: readonly MuscleGroup[];
}

function MuscleHeatmapLargeComponent({
  heatmap,
  overtrainedMuscles = [],
}: MuscleHeatmapLargeProps) {
  const selectedMuscleInfo = useMemo(() => {
    // Pre-compute tooltip data — shown on press
    return (muscle: MuscleGroup): string => {
      const intensity = heatmap[muscle];
      const labels = ['not trained', 'light training', 'moderate training', 'heavy training'];
      return `${MUSCLE_DISPLAY_NAMES[muscle]} — ${labels[intensity]}`;
    };
  }, [heatmap]);

  const handleMusclePress = (muscle: MuscleGroup) => {
    void Haptics.selectionAsync();
    // tooltip display is handled by the parent screen via state if needed
    void selectedMuscleInfo(muscle);
  };

  return (
    <View style={styles.container}>
      <MuscleHeatmapSVG
        heatmap={heatmap}
        overtrainedMuscles={overtrainedMuscles}
        view="both"
        width={MAP_WIDTH}
        onMusclePress={handleMusclePress}
      />

      <View style={styles.viewLabels}>
        <Text style={styles.viewLabel}>Front</Text>
        <Text style={styles.viewLabel}>Back</Text>
      </View>

      <View style={styles.legendContainer}>
        <MuscleLegend />
      </View>
    </View>
  );
}

export default memo(MuscleHeatmapLargeComponent);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 8,
  },
  viewLabels: {
    width: MAP_WIDTH,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  viewLabel: {
    fontFamily: SLEEP_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    color: SLEEP_THEME.textMuted1,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  legendContainer: {
    paddingHorizontal: SLEEP_LAYOUT.screenPaddingH,
    paddingTop: 4,
  },
});
