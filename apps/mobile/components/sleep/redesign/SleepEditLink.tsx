import { Pressable, StyleSheet, Text } from 'react-native';
import * as Haptics from 'expo-haptics';
import { SLEEP_FONTS, SLEEP_THEME } from '@constants';
import type { SleepEditLinkProps } from '../../../types/sleep-ui';

export default function SleepEditLink({ onPress }: SleepEditLinkProps) {
  return (
    <Pressable
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={styles.button}>
      <Text style={styles.text}>edit sleep data</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'center',
    paddingVertical: 8,
  },
  text: {
    color: SLEEP_THEME.textDisabled,
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});
