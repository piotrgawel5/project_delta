// app/onboarding/height.tsx
import React, { useState, useCallback } from 'react';
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
import { useProfileStore, HeightUnit } from '@store/profileStore';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ACCENT = '#30D158';

const HEIGHT_RANGES = {
  cm: { min: 100, max: 250, default: 170 },
  ft: { min: 3, max: 8, default: 5 },
};

export default function HeightScreen() {
  const { formData, setFormField, setStep } = useProfileStore();

  const initialUnit = (formData.height_unit || 'cm') as HeightUnit;
  const initialValue = formData.height_value || HEIGHT_RANGES[initialUnit].default;
  const initialInches = formData.height_inches || 7;

  const [unit, setUnit] = useState<HeightUnit>(initialUnit);
  const [height, setHeight] = useState(initialValue);
  const [inches, setInches] = useState(initialInches);

  const range = HEIGHT_RANGES[unit];
  const sliderWidth = SCREEN_WIDTH - 48 - 56 * 2 - 32;

  const scaleAnim = useSharedValue(1);
  const sliderProgress = useSharedValue((height - range.min) / (range.max - range.min));

  const updateHeight = useCallback((newHeight: number) => {
    setHeight(newHeight);
  }, []);

  const animateScale = useCallback(() => {
    scaleAnim.value = withSpring(1.05, { damping: 10, stiffness: 300 }, () => {
      scaleAnim.value = withSpring(1, { damping: 10, stiffness: 300 });
    });
  }, []);

  const handleUnitChange = (newUnit: HeightUnit) => {
    if (newUnit === unit) return;

    if (newUnit === 'ft') {
      const totalInches = Math.round(height / 2.54);
      const feet = Math.floor(totalInches / 12);
      const remainingInches = totalInches % 12;
      setHeight(Math.max(3, Math.min(8, feet)));
      setInches(remainingInches);
      sliderProgress.value = (feet - 3) / (8 - 3);
    } else {
      const totalInches = height * 12 + inches;
      const cm = Math.round(totalInches * 2.54);
      const clampedCm = Math.max(100, Math.min(250, cm));
      setHeight(clampedCm);
      sliderProgress.value = (clampedCm - 100) / (250 - 100);
    }

    setUnit(newUnit);
  };

  const adjustHeight = (delta: number) => {
    const newHeight = Math.max(range.min, Math.min(range.max, height + delta));
    setHeight(newHeight);
    sliderProgress.value = withSpring((newHeight - range.min) / (range.max - range.min));
    animateScale();
  };

  const adjustInches = (delta: number) => {
    let newInches = inches + delta;
    if (newInches < 0) {
      if (height > HEIGHT_RANGES.ft.min) {
        setHeight(height - 1);
        newInches = 11;
      } else {
        newInches = 0;
      }
    } else if (newInches > 11) {
      if (height < HEIGHT_RANGES.ft.max) {
        setHeight(height + 1);
        newInches = 0;
      } else {
        newInches = 11;
      }
    }
    setInches(newInches);
    animateScale();
  };

  // Gesture handler for CM slider
  const sliderGesture = Gesture.Pan()
    .onUpdate((event) => {
      const progress = Math.max(0, Math.min(1, event.x / sliderWidth));
      sliderProgress.value = progress;
      const newHeight = Math.round(range.min + progress * (range.max - range.min));
      runOnJS(updateHeight)(newHeight);
    })
    .onEnd(() => {
      runOnJS(animateScale)();
    });

  const handleContinue = () => {
    setFormField('height_value', height);
    setFormField('height_unit', unit);
    if (unit === 'ft') {
      setFormField('height_inches', inches);
    }
    setStep(5);
    router.push('/onboarding/sex');
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
      step={4}
      title="How tall are you?"
      subtitle="Your height helps us calculate your BMI and personalize workout recommendations."
      onContinue={handleContinue}
      canContinue={true}>
      <View style={styles.container}>
        {/* Unit Toggle */}
        <View style={styles.unitToggle}>
          <Pressable
            style={[styles.unitButton, unit === 'cm' && styles.unitButtonActive]}
            onPress={() => handleUnitChange('cm')}>
            <Text style={[styles.unitText, unit === 'cm' && styles.unitTextActive]}>cm</Text>
          </Pressable>
          <Pressable
            style={[styles.unitButton, unit === 'ft' && styles.unitButtonActive]}
            onPress={() => handleUnitChange('ft')}>
            <Text style={[styles.unitText, unit === 'ft' && styles.unitTextActive]}>ft/in</Text>
          </Pressable>
        </View>

        {/* Height Display */}
        <Animated.View style={[styles.heightContainer, animatedScaleStyle]}>
          {unit === 'cm' ? (
            <>
              <Text style={styles.heightValue}>{height}</Text>
              <Text style={styles.heightUnit}>cm</Text>
            </>
          ) : (
            <View style={styles.feetInchesContainer}>
              <View style={styles.feetInchesGroup}>
                <Text style={styles.heightValue}>{height}</Text>
                <Text style={styles.heightUnit}>ft</Text>
              </View>
              <View style={styles.feetInchesGroup}>
                <Text style={styles.heightValue}>{inches}</Text>
                <Text style={styles.heightUnit}>in</Text>
              </View>
            </View>
          )}
        </Animated.View>

        {/* Controls */}
        {unit === 'cm' ? (
          <>
            {/* Draggable Slider for CM */}
            <View style={styles.sliderContainer}>
              <Pressable
                style={({ pressed }) => [
                  styles.adjustButton,
                  pressed && styles.adjustButtonPressed,
                ]}
                onPress={() => adjustHeight(-1)}>
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
                style={({ pressed }) => [
                  styles.adjustButton,
                  pressed && styles.adjustButtonPressed,
                ]}
                onPress={() => adjustHeight(1)}>
                <MaterialCommunityIcons name="plus" size={28} color="#fff" />
              </Pressable>
            </View>

            {/* Range indicator */}
            <View style={styles.rangeContainer}>
              <Text style={styles.rangeText}>{range.min} cm</Text>
              <Text style={styles.rangeText}>{range.max} cm</Text>
            </View>
          </>
        ) : (
          <View style={styles.dualAdjust}>
            {/* Feet controls */}
            <View style={styles.adjustColumn}>
              <Text style={styles.adjustLabel}>Feet</Text>
              <View style={styles.adjustRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.smallAdjustButton,
                    pressed && styles.adjustButtonPressed,
                  ]}
                  onPress={() => adjustHeight(-1)}>
                  <MaterialCommunityIcons name="minus" size={24} color="#fff" />
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.smallAdjustButton,
                    pressed && styles.adjustButtonPressed,
                  ]}
                  onPress={() => adjustHeight(1)}>
                  <MaterialCommunityIcons name="plus" size={24} color="#fff" />
                </Pressable>
              </View>
            </View>

            {/* Inches controls */}
            <View style={styles.adjustColumn}>
              <Text style={styles.adjustLabel}>Inches</Text>
              <View style={styles.adjustRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.smallAdjustButton,
                    pressed && styles.adjustButtonPressed,
                  ]}
                  onPress={() => adjustInches(-1)}>
                  <MaterialCommunityIcons name="minus" size={24} color="#fff" />
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.smallAdjustButton,
                    pressed && styles.adjustButtonPressed,
                  ]}
                  onPress={() => adjustInches(1)}>
                  <MaterialCommunityIcons name="plus" size={24} color="#fff" />
                </Pressable>
              </View>
            </View>
          </View>
        )}
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
  heightContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  heightValue: {
    fontSize: 96,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Poppins-Bold',
    lineHeight: 100,
  },
  heightUnit: {
    fontSize: 24,
    color: ACCENT,
    fontWeight: '600',
    marginTop: -8,
    fontFamily: 'Inter-SemiBold',
  },
  feetInchesContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 24,
  },
  feetInchesGroup: {
    alignItems: 'center',
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    width: '100%',
    paddingHorizontal: 0,
    marginBottom: 16,
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
  dualAdjust: {
    flexDirection: 'row',
    gap: 32,
  },
  adjustColumn: {
    alignItems: 'center',
    gap: 12,
  },
  adjustLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    fontFamily: 'Inter-Regular',
  },
  adjustRow: {
    flexDirection: 'row',
    gap: 12,
  },
  smallAdjustButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(28, 28, 30, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
});
