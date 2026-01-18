// app/onboarding/sport.tsx
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import OnboardingScreen from '@components/onboarding/OnboardingScreen';
import { useProfileStore } from '@store/profileStore';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const ACCENT = '#30D158';
const MAX_SELECTIONS = 3;

const SPORTS = [
  { id: 'running', label: 'Running', icon: 'run' },
  { id: 'walking', label: 'Walking', icon: 'walk' },
  { id: 'cycling', label: 'Cycling', icon: 'bike' },
  { id: 'swimming', label: 'Swimming', icon: 'swim' },
  { id: 'gym', label: 'Gym', icon: 'dumbbell' },
  { id: 'yoga', label: 'Yoga', icon: 'yoga' },
  { id: 'hiking', label: 'Hiking', icon: 'hiking' },
  { id: 'basketball', label: 'Basketball', icon: 'basketball' },
  { id: 'football', label: 'Football', icon: 'football' },
  { id: 'tennis', label: 'Tennis', icon: 'tennis' },
  { id: 'martial_arts', label: 'Martial Arts', icon: 'karate' },
  { id: 'dance', label: 'Dance', icon: 'dance-ballroom' },
] as const;

export default function SportScreen() {
  const { formData, setFormField, setStep } = useProfileStore();

  // Parse stored sports (comma-separated) or empty array
  const storedSports = formData.preferred_sport ? formData.preferred_sport.split(',') : [];
  const [selected, setSelected] = useState<string[]>(storedSports);

  const handleSelect = (sportId: string) => {
    setSelected((prev) => {
      if (prev.includes(sportId)) {
        // Remove if already selected
        return prev.filter((id) => id !== sportId);
      } else if (prev.length < MAX_SELECTIONS) {
        // Add if under max
        return [...prev, sportId];
      }
      return prev; // At max, don't add
    });
  };

  const handleContinue = () => {
    if (selected.length === 0) return;
    // Store as comma-separated string
    setFormField('preferred_sport', selected.join(','));
    setStep(7);
    router.push('/onboarding/activity');
  };

  const isAtMax = selected.length >= MAX_SELECTIONS;

  return (
    <OnboardingScreen
      step={6}
      title="What sports do you love?"
      subtitle={`Select up to ${MAX_SELECTIONS} activities you enjoy most.`}
      onContinue={handleContinue}
      canContinue={selected.length > 0}>
      {/* Selection counter */}
      <View style={styles.counterContainer}>
        <Text style={styles.counterText}>
          {selected.length} / {MAX_SELECTIONS} selected
        </Text>
      </View>

      <View style={styles.grid}>
        {SPORTS.map((sport) => {
          const isSelected = selected.includes(sport.id);
          const isDisabled = !isSelected && isAtMax;

          return (
            <Pressable
              key={sport.id}
              style={({ pressed }) => [
                styles.sportCard,
                isSelected && styles.sportCardActive,
                isDisabled && styles.sportCardDisabled,
                pressed && !isDisabled && styles.sportCardPressed,
              ]}
              onPress={() => !isDisabled && handleSelect(sport.id)}>
              <View style={[styles.iconContainer, isSelected && styles.iconContainerActive]}>
                <MaterialCommunityIcons
                  name={sport.icon as any}
                  size={28}
                  color={
                    isSelected
                      ? ACCENT
                      : isDisabled
                        ? 'rgba(255, 255, 255, 0.2)'
                        : 'rgba(255, 255, 255, 0.6)'
                  }
                />
              </View>
              <Text
                style={[
                  styles.sportLabel,
                  isSelected && styles.sportLabelActive,
                  isDisabled && styles.sportLabelDisabled,
                ]}>
                {sport.label}
              </Text>
              {isSelected && (
                <View style={styles.checkmark}>
                  <Text style={styles.checkmarkNumber}>{selected.indexOf(sport.id) + 1}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  counterContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  counterText: {
    fontSize: 14,
    color: ACCENT,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sportCard: {
    width: '31%',
    aspectRatio: 0.95,
    borderRadius: 18,
    backgroundColor: 'rgba(28, 28, 30, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    position: 'relative',
  },
  sportCardActive: {
    borderColor: ACCENT,
    backgroundColor: 'rgba(48, 209, 88, 0.15)',
  },
  sportCardDisabled: {
    opacity: 0.4,
  },
  sportCardPressed: {
    transform: [{ scale: 0.95 }],
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  iconContainerActive: {
    backgroundColor: 'rgba(48, 209, 88, 0.2)',
  },
  sportLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    fontFamily: 'Inter-SemiBold',
  },
  sportLabelActive: {
    color: '#fff',
  },
  sportLabelDisabled: {
    color: 'rgba(255, 255, 255, 0.3)',
  },
  checkmark: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: ACCENT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000',
  },
});
