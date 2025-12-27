import React, { useState } from 'react';
import { View, StatusBar, StyleSheet, Text, Pressable } from 'react-native';
// Blur handled inside AuthSheet
import { Image } from 'expo-image';
import AuthSheet from '../components/AuthSheet';

export default function IndexScreen() {
  const [started, setStarted] = useState(false);
  return (
    <View className="flex-1 bg-black">
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <Image
        source={require('../assets/bgImage.jpg')}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        priority="high"
      />
      <View className="absolute inset-0 bg-black/20" pointerEvents="none" />
      <View className="flex-1 items-center justify-end px-8 pb-20">
        {/* The Big Header */}
        <View className="mb-4">
          <Text className="font-brand tracking-tightest text-center text-6xl leading-[64px] text-white uppercase shadow-[0_4px_10px_rgba(0,0,0,0.3)]">
            SPRING {'\n'} VIBES.
          </Text>
        </View>

        {/* Subtitle */}
        <Text className="mb-10 px-4 text-center text-base leading-6 font-medium text-white/90">
          Get ready to explore new{'\n'}season goals and consistency.
        </Text>

        {/* The "Pill" Button */}
        <Pressable
          className="w-full max-w-[280px] rounded-full bg-white py-5 shadow-xl active:opacity-90"
          onPress={() => setStarted(true)}>
          <Text className="text-center text-2xl font-bold text-black">Let&apos;s get started!</Text>
        </Pressable>
      </View>
      {started && (
        <>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => setStarted(false)}
            accessibilityLabel="Close auth sheet"
            className="z-40"
          />

          <AuthSheet setStarted={setStarted} />
        </>
      )}
    </View>
  );
}
