import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SLEEP_FONTS, SLEEP_LAYOUT, SLEEP_THEME, WORKOUT_THEME } from '@constants';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const SPRING = { damping: 15, stiffness: 200 } as const;

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
        <MaterialCommunityIcons name="dumbbell" size={36} color={WORKOUT_THEME.accent} />
      </View>

      <Text style={styles.title}>No workouts yet</Text>
      <Text style={styles.body}>
        Start logging your training to track progress, muscle balance, and recovery.
      </Text>

      <AnimatedPressable
        onPressIn={() => {
          scale.value = withSpring(0.96, SPRING);
        }}
        onPressOut={() => {
          scale.value = withSpring(1, SPRING);
        }}
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onStartWorkout();
        }}
        style={[styles.cta, animatedStyle]}>
        <Text style={styles.ctaText}>Start First Workout</Text>
      </AnimatedPressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: SLEEP_LAYOUT.screenPaddingH,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: WORKOUT_THEME.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 24,
    lineHeight: 28,
    color: SLEEP_THEME.textPrimary,
    marginBottom: 10,
  },
  body: {
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 15,
    lineHeight: 22,
    color: SLEEP_THEME.textDisabled,
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 12,
  },
  cta: {
    width: '100%',
    maxWidth: 320,
    height: 56,
    borderRadius: SLEEP_LAYOUT.cardRadiusOuter,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WORKOUT_THEME.accent,
  },
  ctaText: {
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 17,
    lineHeight: 22,
    color: SLEEP_THEME.screenBg,
  },
});
