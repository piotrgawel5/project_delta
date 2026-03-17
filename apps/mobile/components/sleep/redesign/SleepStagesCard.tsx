import { StyleSheet, Text, View } from 'react-native';
import { SLEEP_FONTS, SLEEP_LAYOUT, SLEEP_THEME } from '@constants';
import { CardSkeleton } from './SleepSkeletons';

// TODO(Card C): Wire to SleepHypnogram once Card C design is finalized.
// The existing SleepHypnogram component (components/sleep/SleepHypnogram.tsx) is premium-gated.
// Current task: render placeholder only.
export default function SleepStagesCard() {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>SLEEP STAGES</Text>
      <View style={styles.placeholder}>
        <CardSkeleton />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: SLEEP_THEME.cardBg,
    borderRadius: SLEEP_LAYOUT.cardRadiusOuter,
    padding: SLEEP_LAYOUT.cardPadding,
    minHeight: 250,
  },
  title: {
    marginBottom: 18,
    color: SLEEP_THEME.textMuted1,
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  placeholder: {
    opacity: 0.9,
  },
});
