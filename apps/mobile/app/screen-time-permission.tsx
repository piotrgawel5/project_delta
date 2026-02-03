// app/screen-time-permission.tsx
// Permission request screen for screen time (usage stats) access

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Path,
  G,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
} from 'react-native-svg';
import {
  hasScreenTimePermission,
  requestScreenTimePermission,
  isScreenTimeAvailable,
} from '../modules/screen-time';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ACCENT_PURPLE = '#7C3AED';
const ACCENT_GREEN = '#34D399';
const ACCENT_BLUE = '#38BDF8';
const BG_PRIMARY = '#000000';

export default function ScreenTimePermissionScreen() {
  const insets = useSafeAreaInsets();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  const pulseAnim = useSharedValue(0);

  useEffect(() => {
    checkPermission();

    pulseAnim.value = withRepeat(
      withSequence(withTiming(1, { duration: 1500 }), withTiming(0, { duration: 1500 })),
      -1,
      true
    );
  }, []);

  const checkPermission = async () => {
    if (!isScreenTimeAvailable) {
      setHasPermission(null);
      return;
    }

    const granted = await hasScreenTimePermission();
    setHasPermission(granted);

    // If already granted, navigate back or to next screen
    if (granted) {
      router.back();
    }
  };

  const handleRequestPermission = async () => {
    setLoading(true);
    try {
      await requestScreenTimePermission();
      // Re-check after coming back from settings
      setTimeout(checkPermission, 500);
    } catch (error) {
      console.error('[ScreenTimePermission] Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    router.back();
  };

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulseAnim.value * 0.05 }],
    opacity: 0.6 + pulseAnim.value * 0.4,
  }));

  if (Platform.OS !== 'android') {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={styles.notAvailableText}>
          Screen time tracking is only available on Android.
        </Text>
        <Pressable style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['rgba(124, 58, 237, 0.2)', 'transparent']}
        style={styles.gradient}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.5 }}
      />

      {/* Header */}
      <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.header}>
        <Pressable style={styles.backButton} onPress={handleSkip}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Screen Time Access</Text>
        <View style={{ width: 40 }} />
      </Animated.View>

      {/* Illustration */}
      <Animated.View
        entering={FadeIn.delay(300).duration(600)}
        style={styles.illustrationContainer}>
        <Animated.View style={[styles.iconGlow, pulseStyle]}>
          <LinearGradient
            colors={['rgba(124, 58, 237, 0.4)', 'transparent']}
            style={styles.iconGlowGradient}
          />
        </Animated.View>
        <View style={styles.iconCircle}>
          <Ionicons name="phone-portrait-outline" size={64} color={ACCENT_PURPLE} />
          <View style={styles.sleepIconOverlay}>
            <Ionicons name="moon" size={24} color={ACCENT_BLUE} />
          </View>
        </View>
      </Animated.View>

      {/* Content */}
      <Animated.View entering={FadeInDown.delay(400).duration(500)} style={styles.content}>
        <Text style={styles.title}>Improve Sleep Tracking</Text>
        <Text style={styles.description}>
          Allow Delta to analyze when you use your phone to estimate your bedtime and wake-up time.
          This helps us provide accurate sleep data even without a wearable.
        </Text>

        {/* Benefits */}
        <View style={styles.benefitsContainer}>
          <BenefitItem
            icon="bed-outline"
            title="Bedtime Detection"
            description="Knows when you put your phone down for the night"
            delay={500}
          />
          <BenefitItem
            icon="sunny-outline"
            title="Wake-up Tracking"
            description="Detects when you first pick up your phone"
            delay={600}
          />
          <BenefitItem
            icon="analytics-outline"
            title="Better Accuracy"
            description="Supplements Health Connect data for higher confidence"
            delay={700}
          />
        </View>

        {/* Privacy note */}
        <Animated.View entering={FadeInUp.delay(800).duration(400)} style={styles.privacyNote}>
          <Ionicons name="shield-checkmark" size={16} color={ACCENT_GREEN} />
          <Text style={styles.privacyText}>
            Your data stays on your device. We only analyze screen on/off events.
          </Text>
        </Animated.View>
      </Animated.View>

      {/* Actions */}
      <Animated.View
        entering={FadeInUp.delay(900).duration(400)}
        style={[styles.actions, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={[styles.primaryButton, loading && styles.buttonDisabled]}
          onPress={handleRequestPermission}
          disabled={loading}>
          <LinearGradient
            colors={[ACCENT_PURPLE, '#9333EA']}
            style={styles.buttonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}>
            <Ionicons name="settings-outline" size={20} color="#fff" />
            <Text style={styles.primaryButtonText}>
              {loading ? 'Opening Settings...' : 'Open Settings'}
            </Text>
          </LinearGradient>
        </Pressable>

        <Pressable style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipButtonText}>Maybe Later</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

interface BenefitItemProps {
  icon: string;
  title: string;
  description: string;
  delay: number;
}

function BenefitItem({ icon, title, description, delay }: BenefitItemProps) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(400)} style={styles.benefitItem}>
      <View style={styles.benefitIcon}>
        <Ionicons name={icon as any} size={22} color={ACCENT_PURPLE} />
      </View>
      <View style={styles.benefitContent}>
        <Text style={styles.benefitTitle}>{title}</Text>
        <Text style={styles.benefitDescription}>{description}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_PRIMARY,
  },
  gradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 400,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  illustrationContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 180,
    marginVertical: 20,
  },
  iconGlow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    overflow: 'hidden',
  },
  iconGlowGradient: {
    flex: 1,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    borderWidth: 2,
    borderColor: 'rgba(124, 58, 237, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sleepIconOverlay: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0A0A12',
    borderWidth: 2,
    borderColor: 'rgba(56, 189, 248, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  benefitsContainer: {
    gap: 16,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  benefitIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitContent: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  benefitDescription: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 18,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 28,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.2)',
  },
  privacyText: {
    flex: 1,
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 17,
  },
  actions: {
    paddingHorizontal: 24,
    gap: 12,
  },
  primaryButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  skipButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
  },
  notAvailableText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    paddingHorizontal: 32,
    marginTop: 100,
  },
});
