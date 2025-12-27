import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  Animated,
  PanResponder,
  Dimensions,
  AccessibilityInfo,
  StyleSheet,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { AntDesign, MaterialIcons } from '@expo/vector-icons';

const { height: WINDOW_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = Math.round(WINDOW_HEIGHT * 0.37);
const DRAG_THRESHOLD = SHEET_HEIGHT * 0.25;

interface AuthSheetProps {
  setStarted: (value: boolean) => void;
}

export default function AuthSheet({ setStarted }: AuthSheetProps) {
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const lastOffset = useRef(0);

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
  }, [translateY]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 6,
      onPanResponderGrant: () => {
        translateY.stopAnimation((v) => {
          lastOffset.current = v;
        });
      },
      onPanResponderMove: (_, gesture) => {
        const newPos = Math.max(0, lastOffset.current + gesture.dy);
        translateY.setValue(newPos);
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > DRAG_THRESHOLD || (gesture.vy > 1 && gesture.dy > 10)) {
          Animated.timing(translateY, {
            toValue: SHEET_HEIGHT,
            duration: 220,
            useNativeDriver: true,
          }).start(() => {
            lastOffset.current = SHEET_HEIGHT;
            AccessibilityInfo.announceForAccessibility('Login sheet closed');
            setStarted(false);
          });
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 80,
            friction: 12,
          }).start(() => {
            lastOffset.current = 0;
            AccessibilityInfo.announceForAccessibility('Login sheet opened');
          });
        }
      },
    })
  ).current;

  return (
    <Animated.View
      style={{
        transform: [{ translateY }],
        position: 'absolute',
        bottom: 0,
        width: '100%',
        height: SHEET_HEIGHT,
      }}
      accessibilityLabel="Authentication sheet">
      <View className="flex-1 overflow-hidden rounded-t-3xl" {...panResponder.panHandlers}>
        <BlurView
          intensity={100}
          style={[StyleSheet.absoluteFill]}
          tint="dark"
          className="absolute inset-0"
        />
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.30)' }]}
        />
        <View className="absolute inset-0 rounded-t-3xl border border-white/10" />

        <View className="flex-1 items-center justify-start px-6 pt-3">
          <View
            className="mb-3 h-1.5 w-14 rounded-full bg-white/70"
            accessible
            accessibilityRole="adjustable"
          />
          <Text className="font-brand mt-1 mb-3 text-3xl font-bold text-white">
            Create Delta ID
          </Text>
          <Text className="mb-3 max-w-[85%] text-center text-sm text-white/70">
            Build discipline. Track progress. Stay consistent. =
          </Text>

          <View className="mb-3 flex w-full gap-5">
            <Pressable
              className="flex-row items-center justify-center gap-3 rounded-xl border border-white/30 bg-white/20 py-3"
              onPress={() => console.log('Google auth')}
              accessibilityRole="button"
              accessibilityLabel="Continue with Google">
              <AntDesign name="google" size={20} color="white" />
              <Text className="text-base font-semibold text-white">Continue with Google</Text>
            </Pressable>
            <Pressable
              className="flex-row items-center justify-center gap-3 rounded-xl border border-white/20 bg-white/10 py-3"
              onPress={() => console.log('Email auth')}
              accessibilityRole="button"
              accessibilityLabel="Continue with Email">
              <MaterialIcons name="alternate-email" size={20} color="white" />
              <Text className="text-base text-white">Continue with Email </Text>
            </Pressable>
          </View>

          <View className="flex-row items-center justify-center gap-3 pt-1">
            <View className="h-0.5 w-1/3 rounded-full bg-white/20" />
            <Text className="text-xs text-white/30">or </Text>
            <View className="h-0.5 w-1/3 rounded-full bg-white/20" />
          </View>

          <Text className="text-md mt-4 text-white/70">
            Already have an account? <Text className="font-black text-white">Sign in </Text>
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}
