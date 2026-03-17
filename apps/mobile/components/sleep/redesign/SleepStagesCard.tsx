import { StyleSheet, View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SLEEP_FONTS, SLEEP_LAYOUT, SLEEP_THEME } from '@constants';

// TODO(Card C): Wire to SleepHypnogram once Card C design is finalized.
// The existing SleepHypnogram component (components/sleep/SleepHypnogram.tsx) is premium-gated.
// Current task: render placeholder only.
export default function SleepStagesCard() {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>SLEEP STAGES</Text>
      <View style={styles.cavity}>
        <LinearGradient
          colors={['rgba(255,255,255,0.025)', 'rgba(255,255,255,0.01)', 'rgba(0,0,0,0.04)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cavityFill}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: SLEEP_THEME.cardBg,
    borderRadius: SLEEP_LAYOUT.cardRadiusOuter,
    padding: SLEEP_LAYOUT.cardPadding,
    minHeight: 188,
  },
  title: {
    marginBottom: 14,
    color: SLEEP_THEME.textMuted1,
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 11,
    letterSpacing: 0.7,
  },
  cavity: {
    flex: 1,
    minHeight: 120,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#17171A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  cavityFill: {
    flex: 1,
  },
});
