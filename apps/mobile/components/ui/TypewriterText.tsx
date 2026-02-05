import React, { useMemo } from 'react';
import { View, StyleSheet, Text, StyleProp, TextStyle, ViewStyle } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

interface TypewriterTextProps {
  text: string;
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  trigger?: boolean;
  wordDelay?: number;
}

export function TypewriterText({
  text,
  style,
  containerStyle,
  trigger = true,
  wordDelay = 30,
}: TypewriterTextProps) {
  const words = useMemo(() => {
    return text.split(' ');
  }, [text]);

  // Reserve space with invisible text when not triggered
  if (!trigger) {
    return (
      <View style={[styles.container, containerStyle]}>
        <Text style={[style, styles.placeholder]}>{text}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, containerStyle]}>
      {words.map((word, index) => (
        <Animated.Text
          key={`${word}-${index}`}
          entering={FadeIn.duration(400).delay(index * wordDelay)}
          style={[style, styles.word]}>
          {word}{' '}
        </Animated.Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  word: {
    // Ensure words don't get cut off vertically if line height is tight
  },
  placeholder: {
    opacity: 0, // Invisible but takes up space
  },
});
