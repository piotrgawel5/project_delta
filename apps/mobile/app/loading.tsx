// app/loading.tsx - Transition screen after auth
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated, Easing, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useAuthStore } from '@store/authStore';
import { useProfileStore } from '@store/profileStore';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const ACCENT = '#30D158';

export default function LoadingScreen() {
  const { user, session } = useAuthStore();
  const { fetchProfile, profile, loading, error } = useProfileStore();

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        damping: 15,
        stiffness: 100,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Subtle rotation
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  useEffect(() => {
    const checkProfileAndRoute = async () => {
      if (!user || !session) {
        // Not authenticated, go to home
        router.replace('/');
        return;
      }

      // Fetch profile
      const result = await fetchProfile(user.id);

      const { error: fetchError } = useProfileStore.getState();

      if (fetchError && !result) {
        // If error occurred and no profile returned, DO NOT redirect to onboarding
        // Stay here (or show retry UI - for now just console log and maybe redirect home?)
        console.warn('Profile fetch failed:', fetchError);
        // Ideally we show a retry button in the UI, but for now let's just NOT redirect to Onboarding
        // Maybe redirect to home or stay on loading?
        // Let's try to reload?
        // For now, if we fail, we assume it might be a temporary network glitch.
        // But the user reported *sometimes* it happens.
        // If we don't redirect, they get stuck on loading.
        // Let's alert? But we can't alert easily on splash.
        // Minimal fix: Don't assume Onboarding if result is null due to error.
        return;
      }

      // Small delay for smooth transition
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Get updated profile (result contains it)
      const currentProfile = useProfileStore.getState().profile;

      // Fade out before navigating
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        if (currentProfile?.onboarding_completed) {
          router.replace('/(tabs)/nutrition');
        } else {
          // Double check: if we have NO profile and NO error, it's a new user.
          // If we had an error, we returned early above.
          router.replace('/onboarding/username');
        }
      });
    };

    if (user && session) {
      checkProfileAndRoute();
    }
  }, [user, session]);

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      {/* Background gradient */}
      <LinearGradient
        colors={['rgba(48, 209, 88, 0.15)', 'transparent']}
        style={styles.backgroundGradient}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.5 }}
      />

      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}>
        {/* Logo with pulse */}
        <Animated.View style={[styles.logoContainer, { transform: [{ scale: pulseAnim }] }]}>
          <Animated.View style={[styles.logoRing, { transform: [{ rotate: rotation }] }]}>
            <LinearGradient
              colors={[ACCENT, '#22C55E', '#10B981']}
              style={styles.logoGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
          </Animated.View>
          <View style={styles.logoInner}>
            <Text style={styles.logoText}>Δ</Text>
          </View>
        </Animated.View>

        <Text style={styles.title}>
          {loading ? 'Setting up...' : error ? 'Connection Error' : 'Just a moment...'}
        </Text>
        <Text style={styles.subtitle}>
          {error ? 'Please check your internet' : 'Setting up your experience'}
        </Text>
        {error && (
          <Pressable
            onPress={() => fetchProfile(user!.id)}
            style={{
              marginTop: 20,
              padding: 10,
              backgroundColor: 'rgba(255,255,255,0.1)',
              borderRadius: 8,
            }}>
            <Text style={{ color: '#fff' }}>Retry</Text>
          </Pressable>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.5,
  },
  content: {
    alignItems: 'center',
  },
  logoContainer: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  logoRing: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    opacity: 0.3,
  },
  logoGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
  },
  logoInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(48, 209, 88, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: ACCENT,
  },
  logoText: {
    fontSize: 36,
    fontWeight: '800',
    color: ACCENT,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    fontFamily: 'Poppins-Bold',
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.6)',
    fontFamily: 'Inter-Regular',
  },
});
