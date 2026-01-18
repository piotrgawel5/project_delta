// app/onboarding/birthday.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDecay,
  runOnJS,
} from 'react-native-reanimated';
import OnboardingScreen from '@components/onboarding/OnboardingScreen';
import { useProfileStore } from '@store/profileStore';
import { useAuthStore } from '@store/authStore';
import { useDialog } from '@components/ui/Dialog';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ACCENT = '#30D158';
const ITEM_HEIGHT = 48;
const VISIBLE_ITEMS = 5;
const MIN_AGE = 13;

// Generate arrays for months and years
const months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const generateDays = (month: number, year: number): number[] => {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, i) => i + 1);
};

const currentYear = new Date().getFullYear();
const years = Array.from({ length: currentYear - 1920 - 12 }, (_, i) => currentYear - 13 - i);

export default function BirthdayScreen() {
  const { formData, setFormField, setStep } = useProfileStore();
  const { deleteAccount } = useAuthStore();
  const { showDialog } = useDialog();

  const initialDate = formData.date_of_birth
    ? new Date(formData.date_of_birth)
    : new Date(2000, 0, 15);

  const [selectedMonth, setSelectedMonth] = useState(initialDate.getMonth());
  const [selectedDay, setSelectedDay] = useState(initialDate.getDate());
  const [selectedYear, setSelectedYear] = useState(initialDate.getFullYear());

  const days = generateDays(selectedMonth, selectedYear);

  // Ensure day is valid when month/year changes
  useEffect(() => {
    if (selectedDay > days.length) {
      setSelectedDay(days.length);
    }
  }, [selectedMonth, selectedYear, days.length]);

  const calculateAge = useCallback(() => {
    const today = new Date();
    const birthDate = new Date(selectedYear, selectedMonth, selectedDay);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }, [selectedYear, selectedMonth, selectedDay]);

  const handleContinue = async () => {
    const age = calculateAge();

    if (age < MIN_AGE) {
      const confirmed = await showDialog({
        type: 'error',
        title: 'Age Requirement',
        message: `You must be at least ${MIN_AGE} years old to use this app. Your account will be deleted.`,
        buttons: [
          { text: 'Cancel', onPress: () => {}, style: 'cancel' },
          {
            text: 'I Understand',
            onPress: async () => {
              await deleteAccount();
              router.replace('/');
            },
            style: 'destructive',
          },
        ],
      });
      return;
    }

    const date = new Date(selectedYear, selectedMonth, selectedDay);
    setFormField('date_of_birth', date.toISOString().split('T')[0]);
    setStep(3);
    router.push('/onboarding/weight');
  };

  const age = calculateAge();
  const isAgeValid = age >= MIN_AGE;

  return (
    <OnboardingScreen
      step={2}
      title="When's your birthday?"
      subtitle="We use this to personalize your experience and ensure you meet age requirements."
      onContinue={handleContinue}
      canContinue={true}>
      <View style={styles.container}>
        {/* Age Display */}
        <View style={styles.ageContainer}>
          <Text style={[styles.ageValue, !isAgeValid && styles.ageValueInvalid]}>{age}</Text>
          <Text style={[styles.ageLabel, !isAgeValid && styles.ageLabelInvalid]}>
            {isAgeValid ? 'years old' : `must be ${MIN_AGE}+`}
          </Text>
        </View>

        {/* Custom Wheel Picker */}
        <View style={styles.pickerContainer}>
          {/* Month Picker */}
          <DraggableWheelPicker
            items={months}
            selectedIndex={selectedMonth}
            onSelect={setSelectedMonth}
            width={130}
          />

          {/* Day Picker */}
          <DraggableWheelPicker
            items={days.map((d) => d.toString())}
            selectedIndex={selectedDay - 1}
            onSelect={(i) => setSelectedDay(i + 1)}
            width={60}
          />

          {/* Year Picker */}
          <DraggableWheelPicker
            items={years.map((y) => y.toString())}
            selectedIndex={years.indexOf(selectedYear)}
            onSelect={(i) => setSelectedYear(years[i])}
            width={85}
          />
        </View>
      </View>
    </OnboardingScreen>
  );
}

// Draggable Wheel Picker Component with gesture handling
function DraggableWheelPicker({
  items,
  selectedIndex,
  onSelect,
  width,
}: {
  items: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  width: number;
}) {
  const translateY = useSharedValue(-selectedIndex * ITEM_HEIGHT);
  const lastIndex = useRef(selectedIndex);

  // Update position when selected index changes externally
  useEffect(() => {
    if (selectedIndex !== lastIndex.current) {
      translateY.value = withSpring(-selectedIndex * ITEM_HEIGHT, {
        damping: 20,
        stiffness: 150,
      });
      lastIndex.current = selectedIndex;
    }
  }, [selectedIndex]);

  const updateSelection = useCallback(
    (index: number) => {
      if (index !== lastIndex.current) {
        lastIndex.current = index;
        onSelect(index);
      }
    },
    [onSelect]
  );

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      const newY = -selectedIndex * ITEM_HEIGHT + event.translationY;
      const maxY = 0;
      const minY = -(items.length - 1) * ITEM_HEIGHT;
      translateY.value = Math.max(minY, Math.min(maxY, newY));
    })
    .onEnd((event) => {
      // Apply decay for momentum scrolling
      const minY = -(items.length - 1) * ITEM_HEIGHT;
      const maxY = 0;

      translateY.value = withDecay(
        {
          velocity: event.velocityY,
          clamp: [minY, maxY],
          deceleration: 0.995,
        },
        (finished) => {
          if (finished) {
            // Snap to nearest item
            const newIndex = Math.round(-translateY.value / ITEM_HEIGHT);
            const clampedIndex = Math.max(0, Math.min(items.length - 1, newIndex));
            translateY.value = withSpring(-clampedIndex * ITEM_HEIGHT, {
              damping: 20,
              stiffness: 150,
            });
            runOnJS(updateSelection)(clampedIndex);
          }
        }
      );
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <View style={[styles.wheelContainer, { width }]}>
      {/* Selection highlight */}
      <View style={styles.selectionHighlight} pointerEvents="none" />

      {/* Gradient overlays for fade effect */}
      <LinearGradient
        colors={['#000', 'transparent']}
        style={styles.gradientTop}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['transparent', '#000']}
        style={styles.gradientBottom}
        pointerEvents="none"
      />

      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            styles.wheelContent,
            { paddingTop: ITEM_HEIGHT * 2, paddingBottom: ITEM_HEIGHT * 2 },
            animatedStyle,
          ]}>
          {items.map((item, index) => {
            const isSelected = index === selectedIndex;
            return (
              <View key={index} style={styles.wheelItem}>
                <Text style={[styles.wheelText, isSelected && styles.wheelTextSelected]}>
                  {item}
                </Text>
              </View>
            );
          })}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginTop: 16,
  },
  ageContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  ageValue: {
    fontSize: 72,
    fontWeight: '700',
    color: ACCENT,
    fontFamily: 'Poppins-Bold',
  },
  ageValueInvalid: {
    color: '#FF453A',
  },
  ageLabel: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: -8,
    fontFamily: 'Inter-Regular',
  },
  ageLabelInvalid: {
    color: '#FF453A',
  },
  pickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(28, 28, 30, 0.6)',
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  wheelContainer: {
    height: ITEM_HEIGHT * VISIBLE_ITEMS,
    overflow: 'hidden',
    position: 'relative',
  },
  wheelContent: {
    width: '100%',
  },
  selectionHighlight: {
    position: 'absolute',
    top: ITEM_HEIGHT * 2,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    backgroundColor: 'rgba(48, 209, 88, 0.15)',
    borderRadius: 12,
    zIndex: 0,
  },
  gradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT * 1.5,
    zIndex: 10,
  },
  gradientBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT * 1.5,
    zIndex: 10,
  },
  wheelItem: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wheelText: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.4)',
    fontFamily: 'Inter-Regular',
  },
  wheelTextSelected: {
    fontSize: 20,
    color: '#fff',
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
});
