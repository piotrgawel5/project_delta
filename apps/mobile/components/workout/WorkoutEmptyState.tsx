import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SLEEP_FONTS, SLEEP_LAYOUT, WORKOUT_THEME } from '@constants';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface WorkoutEmptyStateProps {
  onStartWorkout: () => void;
}

export default function WorkoutEmptyState({ onStartWorkout }: WorkoutEmptyStateProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View entering={FadeIn.duration(300).delay(100)} style={styles.container}>
      <View style={styles.iconWrap}>
        <MaterialCommunityIcons name="dumbbell" size={32} color={WORKOUT_THEME.fg2} />
      </View>

      <Text style={styles.title}>No workouts yet</Text>
      <Text style={styles.body}>
        Start logging your training to track progress, muscle balance, and recovery.
      </Text>

      <AnimatedPressable
        onPressIn={() => {
          scale.value = withTiming(0.97, { duration: 100 });
        }}
        onPressOut={() => {
          scale.value = withTiming(1, { duration: 100 });
        }}
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onStartWorkout();
        }}
        style={[styles.cta, animatedStyle]}>
        <MaterialCommunityIcons name="plus" size={17} color={WORKOUT_THEME.bg} />
        <Text style={styles.ctaText}>Start first workout</Text>
      </AnimatedPressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: SLEEP_LAYOUT.screenPaddingH,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: WORKOUT_THEME.surface2,
    borderWidth: 1,
    borderColor: WORKOUT_THEME.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: {
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 22,
    lineHeight: 26,
    color: WORKOUT_THEME.fg,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  body: {
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    color: WORKOUT_THEME.fg3,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 24,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    paddingHorizontal: 22,
    borderRadius: 16,
    backgroundColor: WORKOUT_THEME.fg,
  },
  ctaText: {
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 15,
    color: WORKOUT_THEME.bg,
  },
});
