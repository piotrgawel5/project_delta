// app/(tabs)/sleep.tsx
import React from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ACCENT = '#30D158';

export default function SleepScreen() {
  return (
    <View style={styles.container}>
      {/* Background */}
      <View style={styles.backgroundGradient}>
        <LinearGradient
          colors={['rgba(147, 51, 234, 0.1)', 'transparent']}
          style={styles.gradientOrb}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Sleep</Text>
          <Text style={styles.subtitle}>Monitor your rest quality</Text>
        </View>

        {/* Placeholder Content */}
        <View style={styles.placeholder}>
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name="power-sleep" size={48} color="#A78BFA" />
          </View>
          <Text style={styles.placeholderTitle}>Coming Soon</Text>
          <Text style={styles.placeholderText}>
            Track sleep patterns, set bedtime reminders, and improve your rest.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  backgroundGradient: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  gradientOrb: {
    position: 'absolute',
    width: SCREEN_WIDTH * 1.5,
    height: SCREEN_WIDTH,
    borderRadius: SCREEN_WIDTH,
    top: -SCREEN_WIDTH * 0.3,
    right: -SCREEN_WIDTH * 0.25,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Poppins-Bold',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
    fontFamily: 'Inter-Regular',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(147, 51, 234, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  placeholderTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
    fontFamily: 'Poppins-Bold',
  },
  placeholderText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 40,
    fontFamily: 'Inter-Regular',
  },
});
