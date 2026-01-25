// app/onboarding/weight.tsx
import React, { useState, useRef, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import OnboardingScreen from '@components/onboarding/OnboardingScreen';
import { useProfileStore, WeightUnit } from '@store/profileStore';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ACCENT = '#30D158';

const WEIGHT_RANGES = {
  kg: { min: 30, max: 200, default: 70 },
  lbs: { min: 66, max: 440, default: 154 },
};

export default function WeightScreen() {
  const { formData, setFormField, setStep } = useProfileStore();

  const initialUnit = (formData.weight_unit || 'kg') as WeightUnit;
  const initialValue = formData.weight_value || WEIGHT_RANGES[initialUnit].default;

  const [unit, setUnit] = useState<WeightUnit>(initialUnit);
  const [weight, setWeight] = useState(initialValue);

  const range = WEIGHT_RANGES[unit];
  const sliderWidth = SCREEN_WIDTH - 48 - 56 * 2 - 32; // Account for padding and buttons

  // Animated scale for value display
  const scaleAnim = useSharedValue(1);

  // Slider position
  const sliderProgress = useSharedValue((weight - range.min) / (range.max - range.min));

  const updateWeight = useCallback((newWeight: number) => {
    setWeight(newWeight);
  }, []);

  const animateScale = useCallback(() => {
    scaleAnim.value = withSpring(1.05, { damping: 10, stiffness: 300 }, () => {
      scaleAnim.value = withSpring(1, { damping: 10, stiffness: 300 });
    });
  }, []);

  // Convert weight when switching units
  const handleUnitChange = (newUnit: WeightUnit) => {
    if (newUnit === unit) return;

    let newWeight: number;
    if (newUnit === 'lbs') {
      newWeight = Math.round(weight * 2.20462);
    } else {
      newWeight = Math.round(weight / 2.20462);
    }

    const newRange = WEIGHT_RANGES[newUnit];
    newWeight = Math.max(newRange.min, Math.min(newRange.max, newWeight));

    setUnit(newUnit);
    setWeight(newWeight);
    sliderProgress.value = (newWeight - newRange.min) / (newRange.max - newRange.min);
  };

  const adjustWeight = (delta: number) => {
    const newWeight = Math.max(range.min, Math.min(range.max, weight + delta));
    setWeight(newWeight);
    sliderProgress.value = withSpring((newWeight - range.min) / (range.max - range.min));
    animateScale();
  };

  // Gesture handler for slider
  const sliderGesture = Gesture.Pan()
    .onUpdate((event) => {
      const progress = Math.max(0, Math.min(1, event.x / sliderWidth));
      sliderProgress.value = progress;
      const newWeight = Math.round(range.min + progress * (range.max - range.min));
      runOnJS(updateWeight)(newWeight);
    })
    .onEnd(() => {
      runOnJS(animateScale)();
    });

  const handleContinue = () => {
    setFormField('weight_value', weight);
    setFormField('weight_unit', unit);
    setStep(4);
    router.push('/onboarding/height');
  };

  const animatedScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleAnim.value }],
  }));

  const animatedFillStyle = useAnimatedStyle(() => ({
    width: `${sliderProgress.value * 100}%`,
  }));

  const animatedThumbStyle = useAnimatedStyle(() => ({
    left: `${sliderProgress.value * 100}%`,
    transform: [{ translateX: -12 }],
  }));

  return (
    <OnboardingScreen
      step={3}
      title="What's your weight?"
      subtitle="This helps us calculate accurate calorie burns and health metrics."
      onContinue={handleContinue}
      canContinue={true}>
      <View style={styles.container}>
        {/* Unit Toggle */}
        <View style={styles.unitToggle}>
          <Pressable
            style={[styles.unitButton, unit === 'kg' && styles.unitButtonActive]}
            onPress={() => handleUnitChange('kg')}>
            <Text style={[styles.unitText, unit === 'kg' && styles.unitTextActive]}>kg</Text>
          </Pressable>
          <Pressable
            style={[styles.unitButton, unit === 'lbs' && styles.unitButtonActive]}
            onPress={() => handleUnitChange('lbs')}>
            <Text style={[styles.unitText, unit === 'lbs' && styles.unitTextActive]}>lbs</Text>
          </Pressable>
        </View>

        {/* Weight Display */}
        <Animated.View style={[styles.weightContainer, animatedScaleStyle]}>
          <Text style={styles.weightValue}>{weight}</Text>
          <Text style={styles.weightUnit}>{unit}</Text>
        </Animated.View>

        {/* Draggable Slider */}
        <View style={styles.sliderContainer}>
          <Pressable
            style={({ pressed }) => [styles.adjustButton, pressed && styles.adjustButtonPressed]}
            onPress={() => adjustWeight(-1)}>
            <MaterialCommunityIcons name="minus" size={28} color="#fff" />
          </Pressable>

          <GestureDetector gesture={sliderGesture}>
            <View style={styles.sliderTrackContainer}>
              <View style={styles.sliderTrack}>
                <Animated.View style={[styles.sliderFill, animatedFillStyle]} />
              </View>
              <Animated.View style={[styles.sliderThumb, animatedThumbStyle]}>
                <View style={styles.sliderThumbInner} />
              </Animated.View>
            </View>
          </GestureDetector>

          <Pressable
            style={({ pressed }) => [styles.adjustButton, pressed && styles.adjustButtonPressed]}
            onPress={() => adjustWeight(1)}>
            <MaterialCommunityIcons name="plus" size={28} color="#fff" />
          </Pressable>
        </View>

        {/* Quick Adjustments */}
        <View style={styles.quickAdjust}>
          <Pressable style={styles.quickButton} onPress={() => adjustWeight(-5)}>
            <Text style={styles.quickText}>-5</Text>
          </Pressable>
          <Pressable style={styles.quickButton} onPress={() => adjustWeight(-1)}>
            <Text style={styles.quickText}>-1</Text>
          </Pressable>
          <Pressable style={styles.quickButton} onPress={() => adjustWeight(1)}>
            <Text style={styles.quickText}>+1</Text>
          </Pressable>
          <Pressable style={styles.quickButton} onPress={() => adjustWeight(5)}>
            <Text style={styles.quickText}>+5</Text>
          </Pressable>
        </View>

        {/* Range indicator */}
        <View style={styles.rangeContainer}>
          <Text style={styles.rangeText}>
            {range.min} {unit}
          </Text>
          <Text style={styles.rangeText}>
            {range.max} {unit}
          </Text>
        </View>
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginTop: 24,
  },
  unitToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(28, 28, 30, 0.8)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 48,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  unitButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 10,
  },
  unitButtonActive: {
    backgroundColor: ACCENT,
  },
  unitText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
    fontFamily: 'Inter-SemiBold',
  },
  unitTextActive: {
    color: '#000',
  },
  weightContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  weightValue: {
    fontSize: 96,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Poppins-Bold',
    lineHeight: 100,
  },
  weightUnit: {
    fontSize: 24,
    color: ACCENT,
    fontWeight: '600',
    marginTop: -8,
    fontFamily: 'Inter-SemiBold',
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    width: '100%',
    paddingHorizontal: 0,
    marginBottom: 24,
  },
  adjustButton: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(28, 28, 30, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  adjustButtonPressed: {
    backgroundColor: 'rgba(48, 48, 52, 0.8)',
    transform: [{ scale: 0.95 }],
  },
  sliderTrackContainer: {
    flex: 1,
    height: 48,
    justifyContent: 'center',
    position: 'relative',
  },
  sliderTrack: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  sliderFill: {
    height: '100%',
    backgroundColor: ACCENT,
    borderRadius: 4,
  },
  sliderThumb: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  sliderThumbInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: ACCENT,
  },
  quickAdjust: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  quickButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(28, 28, 30, 0.8)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  quickText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  rangeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 56 + 16,
  },
  rangeText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.4)',
    fontFamily: 'Inter-Regular',
  },
});
