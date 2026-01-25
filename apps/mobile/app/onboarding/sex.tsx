// app/onboarding/sex.tsx
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { router } from 'expo-router';
import OnboardingScreen from '@components/onboarding/OnboardingScreen';
import { useProfileStore, Sex } from '@store/profileStore';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const ACCENT = '#30D158';

export default function SexScreen() {
  const { formData, setFormField, setStep } = useProfileStore();
  const [selected, setSelected] = useState<Sex | null>(formData.sex || null);

  const maleAnim = useRef(new Animated.Value(0)).current;
  const femaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(selected === 'male' ? maleAnim : femaleAnim, {
      toValue: selected === 'male' || selected === 'female' ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();

    Animated.timing(selected === 'male' ? femaleAnim : maleAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [selected]);

  const handleSelect = (sex: Sex) => {
    setSelected(sex);
  };

  const handleContinue = () => {
    if (!selected) return;
    setFormField('sex', selected);
    setStep(6);
    router.push('/onboarding/sport');
  };

  const getMaleStyle = () => ({
    borderColor: maleAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['rgba(255, 255, 255, 0.1)', ACCENT],
    }),
    backgroundColor: maleAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['rgba(28, 28, 30, 0.8)', 'rgba(48, 209, 88, 0.15)'],
    }),
  });

  const getFemaleStyle = () => ({
    borderColor: femaleAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['rgba(255, 255, 255, 0.1)', ACCENT],
    }),
    backgroundColor: femaleAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['rgba(28, 28, 30, 0.8)', 'rgba(48, 209, 88, 0.15)'],
    }),
  });

  return (
    <OnboardingScreen
      step={5}
      title="What's your sex?"
      subtitle="This helps us provide accurate calorie calculations and health recommendations."
      onContinue={handleContinue}
      canContinue={!!selected}>
      <View style={styles.container}>
        {/* Male Card */}
        <Pressable onPress={() => handleSelect('male')}>
          <Animated.View style={[styles.card, getMaleStyle()]}>
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons
                name="gender-male"
                size={64}
                color={selected === 'male' ? ACCENT : 'rgba(255, 255, 255, 0.6)'}
              />
            </View>
            <Text style={[styles.cardLabel, selected === 'male' && styles.cardLabelActive]}>
              Male
            </Text>
            {selected === 'male' && (
              <View style={styles.checkmark}>
                <MaterialCommunityIcons name="check" size={20} color="#000" />
              </View>
            )}
          </Animated.View>
        </Pressable>

        {/* Female Card */}
        <Pressable onPress={() => handleSelect('female')}>
          <Animated.View style={[styles.card, getFemaleStyle()]}>
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons
                name="gender-female"
                size={64}
                color={selected === 'female' ? ACCENT : 'rgba(255, 255, 255, 0.6)'}
              />
            </View>
            <Text style={[styles.cardLabel, selected === 'female' && styles.cardLabelActive]}>
              Female
            </Text>
            {selected === 'female' && (
              <View style={styles.checkmark}>
                <MaterialCommunityIcons name="check" size={20} color="#000" />
              </View>
            )}
          </Animated.View>
        </Pressable>
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 32,
  },
  card: {
    flex: 1,
    aspectRatio: 0.9,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    minWidth: 150,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardLabel: {
    fontSize: 20,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
    fontFamily: 'Inter-SemiBold',
  },
  cardLabelActive: {
    color: '#fff',
  },
  checkmark: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: ACCENT,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
