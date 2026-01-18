// app/onboarding/goal.tsx
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import OnboardingScreen from '@components/onboarding/OnboardingScreen';
import { useProfileStore, Goal } from '@store/profileStore';
import { useAuthStore } from '@store/authStore';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const ACCENT = '#30D158';

const GOALS: {
  id: Goal;
  label: string;
  description: string;
  icon: string;
}[] = [
  {
    id: 'lose_weight',
    label: 'Lose Weight',
    description: 'Burn fat and get leaner',
    icon: 'trending-down',
  },
  {
    id: 'maintain',
    label: 'Maintain Weight',
    description: 'Stay at your current weight',
    icon: 'equal',
  },
  {
    id: 'build_muscle',
    label: 'Build Muscle',
    description: 'Gain strength and muscle mass',
    icon: 'arm-flex',
  },
  {
    id: 'improve_endurance',
    label: 'Improve Endurance',
    description: 'Boost stamina and cardio fitness',
    icon: 'heart-pulse',
  },
  {
    id: 'stay_healthy',
    label: 'Stay Healthy',
    description: 'Overall wellness and balance',
    icon: 'leaf',
  },
];

export default function GoalScreen() {
  const { formData, setFormField, completeOnboarding, loading } = useProfileStore();
  const { user } = useAuthStore();
  const [selected, setSelected] = useState<Goal | null>(formData.goal || null);

  const handleSelect = (goal: Goal) => {
    setSelected(goal);
  };

  const handleComplete = async () => {
    if (!selected || !user) return;

    setFormField('goal', selected);

    const result = await completeOnboarding(user.id);

    if (result.success) {
      router.replace('/account');
    } else {
      Alert.alert('Error', result.error || 'Failed to save profile');
    }
  };

  return (
    <OnboardingScreen
      step={8}
      title="What's your goal?"
      subtitle="This is the final step! We'll tailor everything to help you achieve this."
      onContinue={handleComplete}
      canContinue={!!selected}
      loading={loading}>
      <View style={styles.container}>
        {GOALS.map((goal) => (
          <Pressable
            key={goal.id}
            style={({ pressed }) => [
              styles.goalCard,
              selected === goal.id && styles.goalCardActive,
              pressed && styles.goalCardPressed,
            ]}
            onPress={() => handleSelect(goal.id)}>
            {/* Icon */}
            <View
              style={[styles.iconContainer, selected === goal.id && styles.iconContainerActive]}>
              <MaterialCommunityIcons
                name={goal.icon as any}
                size={28}
                color={selected === goal.id ? ACCENT : 'rgba(255, 255, 255, 0.6)'}
              />
            </View>

            {/* Content */}
            <View style={styles.goalContent}>
              <Text style={[styles.goalLabel, selected === goal.id && styles.goalLabelActive]}>
                {goal.label}
              </Text>
              <Text style={styles.goalDescription}>{goal.description}</Text>
            </View>

            {/* Radio */}
            <View style={[styles.radio, selected === goal.id && styles.radioActive]}>
              {selected === goal.id && <View style={styles.radioInner} />}
            </View>
          </Pressable>
        ))}
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    marginTop: 8,
  },
  goalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(28, 28, 30, 0.8)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 16,
  },
  goalCardActive: {
    borderColor: ACCENT,
    backgroundColor: 'rgba(48, 209, 88, 0.15)',
  },
  goalCardPressed: {
    transform: [{ scale: 0.98 }],
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainerActive: {
    backgroundColor: 'rgba(48, 209, 88, 0.2)',
  },
  goalContent: {
    flex: 1,
  },
  goalLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
    fontFamily: 'Inter-SemiBold',
  },
  goalLabelActive: {
    color: '#fff',
  },
  goalDescription: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
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
