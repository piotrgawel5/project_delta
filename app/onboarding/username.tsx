// app/onboarding/username.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Animated } from 'react-native';
import { router } from 'expo-router';
import OnboardingScreen from '@components/onboarding/OnboardingScreen';
import { useProfileStore } from '@store/profileStore';

const ACCENT = '#30D158';
const MAX_USERNAME_LENGTH = 20;

export default function UsernameScreen() {
  const { formData, setFormField, setStep } = useProfileStore();
  const [username, setUsername] = useState(formData.username || '');
  const [isFocused, setIsFocused] = useState(false);

  const isValid = username.trim().length >= 2;

  const handleContinue = () => {
    setFormField('username', username.trim());
    setStep(2);
    router.push('/onboarding/birthday');
  };

  return (
    <OnboardingScreen
      step={1}
      title="What should we call you?"
      subtitle="Pick a username that represents you. This is how you'll appear in the app."
      onContinue={handleContinue}
      canContinue={isValid}>
      <View style={styles.inputWrapper}>
        <View style={[styles.inputContainer, isFocused && styles.inputContainerFocused]}>
          <Text style={styles.atSymbol}>@</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={(text) => setUsername(text.replace(/[^a-zA-Z0-9_]/g, ''))}
            placeholder="username"
            placeholderTextColor="rgba(255, 255, 255, 0.3)"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={MAX_USERNAME_LENGTH}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
          />
        </View>
        <Text style={styles.charCount}>
          {username.length}/{MAX_USERNAME_LENGTH}
        </Text>
      </View>

      {/* Validation hint */}
      {username.length > 0 && username.length < 2 && (
        <Text style={styles.hint}>Username must be at least 2 characters</Text>
      )}
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  inputWrapper: {
    marginTop: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(28, 28, 30, 0.8)',
    borderRadius: 16,
    paddingHorizontal: 20,
    height: 64,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  inputContainerFocused: {
    borderColor: ACCENT,
  },
  atSymbol: {
    fontSize: 24,
    color: ACCENT,
    fontWeight: '600',
    marginRight: 4,
  },
  input: {
    flex: 1,
    fontSize: 24,
    color: '#fff',
    fontFamily: 'Inter-SemiBold',
  },
  charCount: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 14,
    textAlign: 'right',
    marginTop: 8,
    fontFamily: 'Inter-Regular',
  },
  hint: {
    color: '#FF453A',
    fontSize: 14,
    marginTop: 12,
    fontFamily: 'Inter-Regular',
  },
});
