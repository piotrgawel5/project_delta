// components/onboarding/OnboardingScreen.tsx
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Dimensions,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useProfileStore } from '@store/profileStore';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const ACCENT = '#30D158';

const Colors = {
  background: '#000000',
  cardPrimary: 'rgba(28, 28, 30, 0.8)',
  border: 'rgba(255, 255, 255, 0.1)',
  accent: ACCENT,
  textPrimary: '#FFFFFF',
  textSecondary: '#8E8E93',
};

interface OnboardingScreenProps {
  step: number;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onContinue: () => void;
  onBack?: () => void;
  canContinue?: boolean;
  loading?: boolean;
  showSkip?: boolean;
  onSkip?: () => void;
}

export default function OnboardingScreen({
  step,
  title,
  subtitle,
  children,
  onContinue,
  onBack,
  canContinue = true,
  loading = false,
  showSkip = false,
  onSkip,
}: OnboardingScreenProps) {
  const { totalSteps } = useProfileStore();

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Animated gradient orbs
  const orb1X = useRef(new Animated.Value(0)).current;
  const orb1Y = useRef(new Animated.Value(0)).current;
  const orb2X = useRef(new Animated.Value(0)).current;
  const orb2Y = useRef(new Animated.Value(0)).current;
  const orb3X = useRef(new Animated.Value(0)).current;
  const orb3Y = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        damping: 20,
        stiffness: 90,
        useNativeDriver: true,
      }),
    ]).start();

    // Progress animation
    Animated.timing(progressAnim, {
      toValue: step / totalSteps,
      duration: 300,
      useNativeDriver: false,
    }).start();

    // Animated orbs - floating motion
    const animateOrb = (animX: Animated.Value, animY: Animated.Value, delay: number) => {
      const createLoop = () => {
        Animated.loop(
          Animated.sequence([
            Animated.parallel([
              Animated.timing(animX, {
                toValue: Math.random() * 60 - 30,
                duration: 4000 + Math.random() * 2000,
                useNativeDriver: true,
              }),
              Animated.timing(animY, {
                toValue: Math.random() * 60 - 30,
                duration: 4000 + Math.random() * 2000,
                useNativeDriver: true,
              }),
            ]),
            Animated.parallel([
              Animated.timing(animX, {
                toValue: Math.random() * 60 - 30,
                duration: 4000 + Math.random() * 2000,
                useNativeDriver: true,
              }),
              Animated.timing(animY, {
                toValue: Math.random() * 60 - 30,
                duration: 4000 + Math.random() * 2000,
                useNativeDriver: true,
              }),
            ]),
          ])
        ).start();
      };
      setTimeout(createLoop, delay);
    };

    animateOrb(orb1X, orb1Y, 0);
    animateOrb(orb2X, orb2Y, 500);
    animateOrb(orb3X, orb3Y, 1000);
  }, [step]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* Smooth Animated Gradient Background */}
      <View style={styles.orbsContainer} pointerEvents="none">
        <Animated.View
          style={[
            styles.orb,
            styles.orb1,
            {
              transform: [{ translateX: orb1X }, { translateY: orb1Y }],
            },
          ]}>
          <LinearGradient
            colors={[
              'rgba(48, 209, 88, 0.25)',
              'rgba(48, 209, 88, 0.08)',
              'rgba(48, 209, 88, 0.02)',
              'transparent',
            ]}
            locations={[0, 0.3, 0.6, 1]}
            style={styles.orbGradient}
            start={{ x: 0.5, y: 0.5 }}
            end={{ x: 1, y: 1 }}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.orb,
            styles.orb2,
            {
              transform: [{ translateX: orb2X }, { translateY: orb2Y }],
            },
          ]}>
          <LinearGradient
            colors={[
              'rgba(34, 197, 94, 0.18)',
              'rgba(34, 197, 94, 0.06)',
              'rgba(34, 197, 94, 0.01)',
              'transparent',
            ]}
            locations={[0, 0.35, 0.65, 1]}
            style={styles.orbGradient}
            start={{ x: 0.5, y: 0.5 }}
            end={{ x: 0, y: 1 }}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.orb,
            styles.orb3,
            {
              transform: [{ translateX: orb3X }, { translateY: orb3Y }],
            },
          ]}>
          <LinearGradient
            colors={['rgba(52, 211, 153, 0.12)', 'rgba(52, 211, 153, 0.04)', 'transparent']}
            locations={[0, 0.4, 1]}
            style={styles.orbGradient}
            start={{ x: 0.5, y: 0.5 }}
            end={{ x: 0.5, y: 1 }}
          />
        </Animated.View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          {/* Back Button */}
          {step > 1 && (
            <Pressable style={styles.backButton} onPress={onBack || (() => router.back())}>
              <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.textPrimary} />
            </Pressable>
          )}

          {/* Skip Button */}
          {showSkip && (
            <Pressable style={styles.skipButton} onPress={onSkip}>
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
          )}
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressBar, { width: progressWidth }]} />
          </View>
          <Text style={styles.stepText}>
            {step} of {totalSteps}
          </Text>
        </View>

        {/* Content */}
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

          <View style={styles.inputContainer}>{children}</View>
        </Animated.View>
      </ScrollView>

      {/* Continue Button */}
      <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
        <Pressable
          style={({ pressed }) => [
            styles.continueButton,
            !canContinue && styles.continueButtonDisabled,
            pressed && canContinue && styles.continueButtonPressed,
          ]}
          onPress={onContinue}
          disabled={!canContinue || loading}>
          {loading ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <>
              <Text style={[styles.continueText, !canContinue && styles.continueTextDisabled]}>
                Continue
              </Text>
              <View style={[styles.continueArrow, !canContinue && styles.continueArrowDisabled]}>
                <MaterialCommunityIcons
                  name="arrow-right"
                  size={18}
                  color={canContinue ? '#000' : 'rgba(0,0,0,0.3)'}
                />
              </View>
            </>
          )}
        </Pressable>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  orbsContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    zIndex: 0,
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
  orb1: {
    width: SCREEN_WIDTH * 1.2,
    height: SCREEN_WIDTH * 1.2,
    top: -SCREEN_WIDTH * 0.4,
    right: -SCREEN_WIDTH * 0.3,
  },
  orb2: {
    width: SCREEN_WIDTH * 0.9,
    height: SCREEN_WIDTH * 0.9,
    bottom: SCREEN_HEIGHT * 0.15,
    left: -SCREEN_WIDTH * 0.4,
  },
  orb3: {
    width: SCREEN_WIDTH * 0.7,
    height: SCREEN_WIDTH * 0.7,
    bottom: -SCREEN_WIDTH * 0.2,
    right: -SCREEN_WIDTH * 0.1,
  },
  orbGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
  },
  scrollView: {
    flex: 1,
    zIndex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    minHeight: 44,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.cardPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  skipButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  skipText: {
    color: Colors.textSecondary,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 40,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: ACCENT,
    borderRadius: 2,
  },
  stepText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
    fontFamily: 'Poppins-Bold',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 32,
    lineHeight: 24,
    fontFamily: 'Inter-Regular',
  },
  inputContainer: {
    flex: 1,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 16,
    zIndex: 1,
  },
  continueButton: {
    backgroundColor: ACCENT,
    height: 60,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  continueButtonDisabled: {
    backgroundColor: 'rgba(48, 209, 88, 0.3)',
  },
  continueButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  continueText: {
    color: '#000',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
    fontFamily: 'Inter-SemiBold',
  },
  continueTextDisabled: {
    color: 'rgba(0, 0, 0, 0.3)',
  },
  continueArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  continueArrowDisabled: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
});
