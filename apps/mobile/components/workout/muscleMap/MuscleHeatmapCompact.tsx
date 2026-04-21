import { memo, useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { MuscleGroup, MuscleIntensity } from '@shared';
import { SLEEP_LAYOUT, SLEEP_THEME, WORKOUT_THEME } from '@constants';
import MuscleHeatmapSVG from './MuscleHeatmapSVG';

// Compact: fits in the 100×180 hero placeholder (with 20px right column width=120)
const COMPACT_WIDTH = 100;

interface MuscleHeatmapCompactProps {
  heatmap: Record<MuscleGroup, MuscleIntensity>;
  onPress?: () => void;
}

function MuscleHeatmapCompactComponent({ heatmap, onPress }: MuscleHeatmapCompactProps) {
  // 0 = front visible, 1 = back visible
  const side = useSharedValue(0);
  const frontOpacity = useAnimatedStyle(() => ({ opacity: 1 - side.value }));
  const backOpacity = useAnimatedStyle(() => ({ opacity: side.value }));

  const handleToggle = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    side.value = withTiming(side.value > 0.5 ? 0 : 1, { duration: 250 });
  }, [side]);

  const handlePress = useCallback(() => {
    if (onPress) {
      void Haptics.selectionAsync();
      onPress();
    } else {
      handleToggle();
    }
  }, [onPress, handleToggle]);

  return (
    <Pressable onPress={handlePress} onLongPress={onPress ? handleToggle : undefined}>
      <View style={styles.container}>
        {/* Front view — fades out when side flips */}
        <Animated.View style={[StyleSheet.absoluteFill, frontOpacity]} pointerEvents="none">
          <MuscleHeatmapSVG
            heatmap={heatmap}
            view="front"
            width={COMPACT_WIDTH}
          />
        </Animated.View>

        {/* Back view — fades in when side flips */}
        <Animated.View style={[StyleSheet.absoluteFill, backOpacity]} pointerEvents="none">
          <MuscleHeatmapSVG
            heatmap={heatmap}
            view="back"
            width={COMPACT_WIDTH}
          />
        </Animated.View>

        {/* Invisible spacer to hold container size */}
        <View style={styles.spacer} />
      </View>
    </Pressable>
  );
}

export default memo(MuscleHeatmapCompactComponent);

// COMPACT_WIDTH:180 → 100:180 aspect ratio
const COMPACT_HEIGHT = Math.round((COMPACT_WIDTH * 180) / 100);

const styles = StyleSheet.create({
  container: {
    width: COMPACT_WIDTH,
    height: COMPACT_HEIGHT,
    borderRadius: SLEEP_LAYOUT.cardRadiusInner,
    backgroundColor: WORKOUT_THEME.accentSubtle,
    borderWidth: 1,
    borderColor: 'rgba(48,209,88,0.12)',
    overflow: 'hidden',
  },
  spacer: {
    width: COMPACT_WIDTH,
    height: COMPACT_HEIGHT,
  },
});
