import React, { useEffect, useRef, useState } from 'react';
import { View, StatusBar, Text, Pressable, Animated, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import AuthSheet from '../components/auth/AuthSheet';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const ACCENT = '#30D158';

export default function IndexScreen() {
  const [started, setStarted] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const logoAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Staggered entrance animation
    Animated.sequence([
      Animated.timing(logoAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 20,
          stiffness: 90,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Background Image */}
      <Image
        source={require('../assets/bgImage.jpg')}
        style={styles.backgroundImage}
        contentFit="cover"
        transition={400}
      />

      {/* Gradient Overlays */}
      <LinearGradient colors={['rgba(0,0,0,0.3)', 'transparent']} style={styles.topGradient} />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.95)', '#000']}
        locations={[0, 0.3, 0.6, 1]}
        style={styles.bottomGradient}
      />

      {/* Logo/Brand */}
      <Animated.View style={[styles.brandContainer, { opacity: logoAnim }]}>
        <View style={styles.logoMark}>
          <Text style={styles.logoLetter}>Δ</Text>
        </View>
      </Animated.View>

      {/* Main Content */}
      <View style={styles.content}>
        <Animated.View
          style={[
            styles.textContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}>
          {/* Tagline */}
          <Text style={styles.tagline}>YOUR LIMITS.</Text>
          <Text style={styles.taglineBold}>REDEFINED.</Text>

          {/* Description */}
          <Text style={styles.description}>
            Track every step. Crush every goal.{'\n'}
            The ultimate companion for athletes who never settle.
          </Text>

          {/* CTA Button */}
          <Pressable
            onPress={() => setStarted(true)}
            style={({ pressed }) => [styles.ctaButton, pressed && styles.ctaButtonPressed]}>
            <Text style={styles.ctaText}>START NOW</Text>
            <View style={styles.ctaArrow}>
              <Text style={styles.ctaArrowText}>→</Text>
            </View>
          </Pressable>

          {/* Secondary Link */}
          <Pressable onPress={() => setStarted(true)} style={styles.secondaryLink}>
            <Text style={styles.secondaryLinkText}>Already have an account?</Text>
          </Pressable>
        </Animated.View>
      </View>

      {/* Auth Sheet */}
      {started && (
        <>
          <Pressable style={styles.overlay} onPress={() => setStarted(false)} />
          <AuthSheet setStarted={setStarted} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 150,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.6,
  },
  brandContainer: {
    position: 'absolute',
    top: 60,
    left: 24,
    zIndex: 10,
  },
  logoMark: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  logoLetter: {
    fontSize: 24,
    fontWeight: '800',
    color: ACCENT,
  },
  content: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  textContainer: {},
  tagline: {
    fontSize: 42,
    fontWeight: '300',
    color: '#fff',
    letterSpacing: 3,
    lineHeight: 46,
  },
  taglineBold: {
    fontSize: 52,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -1,
    lineHeight: 54,
    marginBottom: 20,
  },
  description: {
    fontSize: 15,
    lineHeight: 24,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
    marginBottom: 36,
  },
  ctaButton: {
    backgroundColor: ACCENT,
    height: 60,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  ctaButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  ctaText: {
    color: '#000',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  ctaArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaArrowText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  secondaryLinkText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontWeight: '500',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 50,
  },
});
