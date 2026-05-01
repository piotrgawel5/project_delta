import { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { WorkoutSession } from '@shared';
import { SLEEP_FONTS, WORKOUT_THEME, tabularStyle } from '@constants';
import { computeMonthPRs } from '@lib/workoutPRs';
import { computePushPullSplit } from '@lib/workoutBalance';

interface Props {
  sessions: WorkoutSession[];
}

function StatTwoUpComponent({ sessions }: Props) {
  const prs = useMemo(() => computeMonthPRs(sessions), [sessions]);
  const balance = useMemo(() => computePushPullSplit(sessions, 14), [sessions]);

  return (
    <View style={styles.row}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>PRs</Text>
        <Text style={styles.bigNumber}>{prs.count}</Text>
        <Text style={styles.subLabel}>this month</Text>
        <View style={styles.barRow}>
          {prs.weekBars.map((v, i) => (
            <View
              key={i}
              style={[
                styles.bar,
                { backgroundColor: v ? WORKOUT_THEME.fg : 'rgba(255,255,255,0.06)' },
              ]}
            />
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.eyebrow}>Balance</Text>
        <Text style={styles.balanceTitle}>Push {balance.pushPct}%</Text>
        <Text style={styles.subLabel}>vs Pull {balance.pullPct}%</Text>
        <View style={styles.splitTrack}>
          <View
            style={{
              width: `${balance.pushPct}%`,
              backgroundColor: WORKOUT_THEME.fg,
              height: '100%',
            }}
          />
          <View
            style={{
              width: `${balance.pullPct}%`,
              backgroundColor: WORKOUT_THEME.fg4,
              height: '100%',
            }}
          />
        </View>
      </View>
    </View>
  );
}

export default memo(StatTwoUpComponent);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  card: {
    flex: 1,
    backgroundColor: WORKOUT_THEME.surface2,
    borderRadius: 18,
    padding: 14,
  },
  eyebrow: {
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 10.5,
    color: WORKOUT_THEME.fg3,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  bigNumber: {
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 28,
    color: WORKOUT_THEME.fg,
    marginTop: 6,
    letterSpacing: -0.7,
    ...tabularStyle,
  },
  balanceTitle: {
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 14,
    color: WORKOUT_THEME.fg,
    marginTop: 6,
  },
  subLabel: {
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 11,
    color: WORKOUT_THEME.fg3,
    marginTop: 2,
  },
  barRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 10,
  },
  bar: {
    flex: 1,
    height: 18,
    borderRadius: 2,
  },
  splitTrack: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    marginTop: 10,
  },
});
