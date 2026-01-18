// app/onboarding/activity.tsx
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import { router } from 'expo-router';
import OnboardingScreen from '@components/onboarding/OnboardingScreen';
import { useProfileStore, ActivityLevel } from '@store/profileStore';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ACCENT = '#30D158';

const ACTIVITY_LEVELS: {
  id: ActivityLevel;
  label: string;
  description: string;
  icon: string;
  example: string;
}[] = [
  {
    id: 'sedentary',
    label: 'Sedentary',
    description: 'Little to no exercise',
    icon: 'seat-recline-normal',
    example: 'Desk job, minimal walking',
  },
  {
    id: 'light',
    label: 'Lightly Active',
    description: 'Light exercise 1-3 days/week',
    icon: 'walk',
    example: '30 min walks, light stretching',
  },
  {
    id: 'moderate',
    label: 'Moderately Active',
    description: 'Moderate exercise 3-5 days/week',
    icon: 'run',
    example: 'Jogging, gym workouts',
  },
  {
    id: 'active',
    label: 'Very Active',
    description: 'Hard exercise 6-7 days/week',
    icon: 'run-fast',
    example: 'Daily training, sports',
  },
  {
    id: 'very_active',
    label: 'Extremely Active',
    description: 'Athlete or physical job + exercise',
    icon: 'weight-lifter',
    example: 'Pro athlete, construction + gym',
  },
];

export default function ActivityScreen() {
  const { formData, setFormField, setStep } = useProfileStore();
  const [selected, setSelected] = useState<ActivityLevel | null>(formData.activity_level || null);

  const handleSelect = (level: ActivityLevel) => {
    setSelected(level);
  };

  const handleContinue = () => {
    if (!selected) return;
    setFormField('activity_level', selected);
    setStep(8);
    router.push('/onboarding/goal');
  };

  return (
    <OnboardingScreen
      step={7}
      title="How active are you?"
      subtitle="This helps us calculate your daily calorie needs."
      onContinue={handleContinue}
      canContinue={!!selected}>
      <View style={styles.container}>
        {ACTIVITY_LEVELS.map((level) => {
          const isSelected = selected === level.id;

          return (
            <Pressable
              key={level.id}
              style={({ pressed }) => [
                styles.card,
                isSelected && styles.cardActive,
                pressed && styles.cardPressed,
              ]}
              onPress={() => handleSelect(level.id)}>
              {/* Icon */}
              <View style={[styles.iconContainer, isSelected && styles.iconContainerActive]}>
                <MaterialCommunityIcons
                  name={level.icon as any}
                  size={26}
                  color={isSelected ? ACCENT : 'rgba(255, 255, 255, 0.6)'}
                />
              </View>

              {/* Content */}
              <View style={styles.cardContent}>
                <Text style={[styles.cardLabel, isSelected && styles.cardLabelActive]}>
                  {level.label}
                </Text>
                <Text style={styles.cardDescription}>{level.description}</Text>
                <Text style={styles.cardExample}>{level.example}</Text>
              </View>

              {/* Radio */}
              <View style={[styles.radio, isSelected && styles.radioActive]}>
                {isSelected && <View style={styles.radioInner} />}
              </View>
            </Pressable>
          );
        })}
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(28, 28, 30, 0.8)',
    borderRadius: 18,
    padding: 14,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 12,
  },
  cardActive: {
    borderColor: ACCENT,
    backgroundColor: 'rgba(48, 209, 88, 0.12)',
  },
  cardPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainerActive: {
    backgroundColor: 'rgba(48, 209, 88, 0.2)',
  },
  cardContent: {
    flex: 1,
  },
  cardLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.85)',
    marginBottom: 2,
    fontFamily: 'Inter-SemiBold',
  },
  cardLabelActive: {
    color: '#fff',
  },
  cardDescription: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 2,
    fontFamily: 'Inter-Regular',
  },
  cardExample: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.35)',
    fontStyle: 'italic',
    fontFamily: 'Inter-Regular',
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioActive: {
    borderColor: ACCENT,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: ACCENT,
  },
});
