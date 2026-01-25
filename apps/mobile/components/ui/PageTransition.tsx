// components/ui/PageTransition.tsx
import React, { useCallback } from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';

interface PageTransitionProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export default function PageTransition({ children, style }: PageTransitionProps) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.95);
  const translateY = useSharedValue(10);

  useFocusEffect(
    useCallback(() => {
      // Reset first (optional, but ensures animation plays every time if desirable)
      // opacity.value = 0;
      // scale.value = 0.95;

      // Animate In
      opacity.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.quad) });
      scale.value = withSpring(1, { damping: 20, stiffness: 200 });
      translateY.value = withSpring(0, { damping: 20, stiffness: 200 });

      return () => {
        // Cleanup or Animate Out (optional)
        // For tabs, keeping state is usually better/faster, but reset if you want "fresh" feel
        opacity.value = 0;
        scale.value = 0.95;
        translateY.value = 10;
      };
    }, [])
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  return <Animated.View style={[styles.container, style, animatedStyle]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
