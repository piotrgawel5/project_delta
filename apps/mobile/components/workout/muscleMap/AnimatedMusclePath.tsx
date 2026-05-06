import { memo, useEffect } from 'react';
import Animated, {
  interpolateColor,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Path } from 'react-native-svg';
import type { MuscleIntensity } from '@shared';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const INTENSITY_COLORS = [
  'rgba(255,255,255,0.06)',
  '#1D8B41',
  '#30D158',
  '#FF9F0A',
] as const;
const HEAVY_COLOR = '#FF9F0A';
const OVERTRAIN_COLOR = '#FF453A';

interface AnimatedMusclePathProps {
  d: string;
  intensity: MuscleIntensity;
  isOvertrained: boolean;
  onPress?: () => void;
}

function AnimatedMusclePathComponent({
  d,
  intensity,
  isOvertrained,
  onPress,
}: AnimatedMusclePathProps) {
  const intensitySV = useSharedValue<number>(intensity);
  const overtrainPulse = useSharedValue<number>(0);

  useEffect(() => {
    intensitySV.value = withTiming(intensity, { duration: 400 });
  }, [intensity, intensitySV]);

  useEffect(() => {
    if (isOvertrained) {
      overtrainPulse.value = withRepeat(withTiming(1, { duration: 1500 }), -1, true);
    } else {
      overtrainPulse.value = withTiming(0, { duration: 300 });
    }
  }, [isOvertrained, overtrainPulse]);

  const animatedProps = useAnimatedProps(() => {
    const baseColor = interpolateColor(
      intensitySV.value,
      [0, 1, 2, 3],
      INTENSITY_COLORS as unknown as string[],
    );
    const color = isOvertrained
      ? interpolateColor(
          overtrainPulse.value,
          [0, 1],
          [HEAVY_COLOR, OVERTRAIN_COLOR],
        )
      : baseColor;

    return { fill: color };
  });

  return <AnimatedPath d={d} animatedProps={animatedProps} fillOpacity={1} onPress={onPress} />;
}

export default memo(AnimatedMusclePathComponent);
