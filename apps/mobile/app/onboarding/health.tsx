// app/onboarding/health.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Linking,
  Animated,
  Dimensions,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import OnboardingScreen from '@components/onboarding/OnboardingScreen';
import { useProfileStore } from '@store/profileStore';
import { useAuthStore } from '@store/authStore';
import HealthConnect, {
  isAvailable,
  requestPermissions,
  checkPermissions,
} from '../../modules/health-connect';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ACCENT = '#30D158';

export default function HealthOnboardingScreen() {
  const { setStep, completeOnboarding, loading: profileLoading } = useProfileStore();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [healthConnectAvailable, setHealthConnectAvailable] = useState<boolean | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [checkingAvailability, setCheckingAvailability] = useState(true);

  // Animation for the health icon
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    setStep(9); // This is the 9th step
    checkHealthConnect();

    // Pulse animation for the icon
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const checkHealthConnect = async () => {
    setCheckingAvailability(true);
    try {
      if (Platform.OS === 'android') {
        const availability = await isAvailable();
        setHealthConnectAvailable(availability.available);

        if (availability.available) {
          const permissions = await checkPermissions();
          const sleepPermission = permissions.find((p) => p.permission === 'READ_SLEEP');
          setPermissionGranted(sleepPermission?.granted ?? false);
        }
      } else {
        setHealthConnectAvailable(false);
      }
    } catch (error) {
      console.error('Error checking Health Connect:', error);
      setHealthConnectAvailable(false);
    } finally {
      setCheckingAvailability(false);
    }
  };

  const handleConnectHealth = async () => {
    if (Platform.OS !== 'android') {
      // iOS - just continue for now
      handleContinue();
      return;
    }

    setLoading(true);
    try {
      if (!healthConnectAvailable) {
        // Open Play Store to install Health Connect
        await Linking.openURL(
          'https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata'
        );
        setLoading(false);
        return;
      }

      // Request permissions - this shows the native Android 14+ UI
      const permissions = await requestPermissions();
      const sleepPermission = permissions.find((p) => p.permission === 'READ_SLEEP');
      setPermissionGranted(sleepPermission?.granted ?? false);

      if (sleepPermission?.granted) {
        // Small delay to show success state before continuing
        setTimeout(() => {
          handleContinue();
        }, 500);
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = async () => {
    if (!user) {
      router.replace('/(tabs)/nutrition');
      return;
    }

    setLoading(true);
    const result = await completeOnboarding(user.id);
    setLoading(false);

    if (result.success) {
      router.replace('/(tabs)/nutrition');
    } else {
      Alert.alert('Error', result.error || 'Failed to save profile');
    }
  };

  const handleSkip = () => {
    handleContinue();
  };

  const renderContent = () => {
    if (Platform.OS !== 'android') {
      // iOS content - coming soon
      return (
        <View style={styles.contentContainer}>
          <Animated.View style={[styles.iconContainer, { transform: [{ scale: pulseAnim }] }]}>
            <LinearGradient
              colors={['rgba(255, 59, 48, 0.2)', 'rgba(255, 45, 85, 0.1)']}
              style={styles.iconGradient}>
              <MaterialCommunityIcons name="apple" size={48} color="#FF3B30" />
            </LinearGradient>
          </Animated.View>

          <Text style={styles.platformTitle}>Apple Health</Text>
          <Text style={styles.platformSubtitle}>Coming Soon</Text>

          <View style={styles.featureCard}>
            <MaterialCommunityIcons name="clock-outline" size={24} color={ACCENT} />
            <View style={styles.featureTextContainer}>
              <Text style={styles.featureTitle}>HealthKit Integration</Text>
              <Text style={styles.featureDescription}>
                We're working on Apple HealthKit support to sync your health data on iOS.
              </Text>
            </View>
          </View>
        </View>
      );
    }

    // Android content
    return (
      <View style={styles.contentContainer}>
        <Animated.View style={[styles.iconContainer, { transform: [{ scale: pulseAnim }] }]}>
          <LinearGradient
            colors={['rgba(48, 209, 88, 0.25)', 'rgba(52, 199, 89, 0.1)']}
            style={styles.iconGradient}>
            <MaterialCommunityIcons name="heart-pulse" size={48} color={ACCENT} />
          </LinearGradient>
        </Animated.View>

        <Text style={styles.platformTitle}>Health Connect</Text>
        <Text style={styles.platformSubtitle}>
          {healthConnectAvailable === null
            ? 'Checking availability...'
            : healthConnectAvailable
              ? 'Sync your health data'
              : 'Install to get started'}
        </Text>

        {/* Features list */}
        <View style={styles.featuresContainer}>
          <View style={styles.featureCard}>
            <View style={styles.featureIconWrapper}>
              <MaterialCommunityIcons name="sleep" size={22} color={ACCENT} />
            </View>
            <View style={styles.featureTextContainer}>
              <Text style={styles.featureTitle}>Sleep Tracking</Text>
              <Text style={styles.featureDescription}>
                Automatically import sleep data from your favorite apps
              </Text>
            </View>
          </View>

          <View style={styles.featureCard}>
            <View style={styles.featureIconWrapper}>
              <MaterialCommunityIcons name="shield-check" size={22} color={ACCENT} />
            </View>
            <View style={styles.featureTextContainer}>
              <Text style={styles.featureTitle}>Privacy First</Text>
              <Text style={styles.featureDescription}>
                You control exactly what data Delta can access
              </Text>
            </View>
          </View>

          <View style={styles.featureCard}>
            <View style={styles.featureIconWrapper}>
              <MaterialCommunityIcons name="sync" size={22} color={ACCENT} />
            </View>
            <View style={styles.featureTextContainer}>
              <Text style={styles.featureTitle}>Stay in Sync</Text>
              <Text style={styles.featureDescription}>
                Works with Samsung Health, Google Fit, Fitbit & more
              </Text>
            </View>
          </View>
        </View>

        {/* Connection status */}
        {permissionGranted && (
          <View style={styles.successBadge}>
            <MaterialCommunityIcons name="check-circle" size={20} color={ACCENT} />
            <Text style={styles.successText}>Connected</Text>
          </View>
        )}

        {/* Connect button */}
        {!permissionGranted && !checkingAvailability && (
          <Pressable
            style={({ pressed }) => [styles.connectButton, pressed && styles.connectButtonPressed]}
            onPress={handleConnectHealth}
            disabled={loading}>
            <LinearGradient
              colors={[ACCENT, '#28C840']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.connectButtonGradient}>
              {loading ? (
                <Text style={styles.connectButtonText}>Connecting...</Text>
              ) : (
                <>
                  <MaterialCommunityIcons
                    name={healthConnectAvailable ? 'heart-plus' : 'download'}
                    size={22}
                    color="#000"
                  />
                  <Text style={styles.connectButtonText}>
                    {healthConnectAvailable ? 'Connect Health Data' : 'Get Health Connect'}
                  </Text>
                </>
              )}
            </LinearGradient>
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <OnboardingScreen
      step={9}
      title="Your Health Data"
      subtitle={
        Platform.OS === 'android'
          ? 'Connect to Health Connect to unlock personalized insights'
          : 'Health integration coming soon to iOS'
      }
      onContinue={handleContinue}
      canContinue={true}
      loading={loading}
      showSkip={!permissionGranted}
      onSkip={handleSkip}>
      {renderContent()}
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    alignItems: 'center',
    paddingTop: 20,
  },
  iconContainer: {
    marginBottom: 24,
  },
  iconGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  platformTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Poppins-Bold',
    marginBottom: 4,
  },
  platformSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.6)',
    fontFamily: 'Inter-Regular',
    marginBottom: 32,
  },
  featuresContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 24,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 14,
  },
  featureIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(48, 209, 88, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    fontFamily: 'Inter-SemiBold',
    marginBottom: 2,
  },
  featureDescription: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
    fontFamily: 'Inter-Regular',
    lineHeight: 18,
  },
  connectButton: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 8,
  },
  connectButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  connectButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  connectButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000',
    fontFamily: 'Inter-SemiBold',
  },
  successBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(48, 209, 88, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
    marginTop: 8,
  },
  successText: {
    fontSize: 15,
    fontWeight: '600',
    color: ACCENT,
    fontFamily: 'Inter-SemiBold',
  },
});
