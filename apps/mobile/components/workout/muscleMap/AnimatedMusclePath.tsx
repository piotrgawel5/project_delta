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
import { WORKOUT_THEME } from '@constants';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const INTENSITY_COLORS = [
  WORKOUT_THEME.muscleUntrained,
  WORKOUT_THEME.muscleLight,
  WORKOUT_THEME.muscleModerate,
  WORKOUT_THEME.muscleHeavy,
] as const;

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
          [WORKOUT_THEME.muscleHeavy, WORKOUT_THEME.muscleOvertrain],
        )
      : baseColor;

    return { fill: color };
  });

  return <AnimatedPath d={d} animatedProps={animatedProps} fillOpacity={1} onPress={onPress} />;
}

export default memo(AnimatedMusclePathComponent);
