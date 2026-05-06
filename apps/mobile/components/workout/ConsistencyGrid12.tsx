import { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { WorkoutSession } from '@shared';
import { SLEEP_FONTS, WORKOUT_THEME, tabularStyle } from '@constants';
import { computeConsistencyGrid } from '@lib/workoutConsistency';

const WEEKS = 12;
const DAYS = 7;
const CARD_PAD_X = 18;

interface Props {
  sessions: WorkoutSession[];
}

function ConsistencyGrid12Component({ sessions }: Props) {
  const grid = useMemo(() => computeConsistencyGrid(sessions), [sessions]);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.eyebrow}>Consistency</Text>
          <Text style={styles.bigStat}>
            {grid.doneDays}
            <Text style={styles.bigStatSuffix}> / {grid.totalDays} days</Text>
          </Text>
        </View>
        <Text style={styles.metaRight}>last 12 weeks</Text>
      </View>

      <View style={styles.grid}>
        {Array.from({ length: WEEKS }).map((_, w) => (
          <View key={w} style={styles.col}>
            {Array.from({ length: DAYS }).map((__, d) => {
              const tone = grid.matrix[w][d];
              return (
                <View
                  key={d}
                  style={[styles.cell, { backgroundColor: WORKOUT_THEME.intensity[tone] }]}
                />
              );
            })}
          </View>
        ))}
      </View>

      <View style={styles.legend}>
        <Text style={styles.legendLabel}>Less</Text>
        <View style={styles.legendSwatches}>
          {WORKOUT_THEME.intensity.map((c, i) => (
            <View key={i} style={[styles.swatch, { backgroundColor: c }]} />
          ))}
        </View>
        <Text style={styles.legendLabel}>More</Text>
      </View>
    </View>
  );
}

export default memo(ConsistencyGrid12Component);

const styles = StyleSheet.create({
  card: {
    backgroundColor: WORKOUT_THEME.surface2,
    borderRadius: 22,
    paddingHorizontal: CARD_PAD_X,
    paddingVertical: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  eyebrow: {
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 11,
    color: WORKOUT_THEME.fg3,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  bigStat: {
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 22,
    color: WORKOUT_THEME.fg,
    marginTop: 6,
    letterSpacing: -0.5,
    ...tabularStyle,
  },
  bigStatSuffix: {
    fontFamily: SLEEP_FONTS.medium,
    fontSize: 13,
    color: WORKOUT_THEME.fg3,
    letterSpacing: 0,
  },
  metaRight: {
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 11,
    color: WORKOUT_THEME.fg3,
    ...tabularStyle,
  },
  grid: {
    flexDirection: 'row',
    gap: 4,
  },
  col: {
    flex: 1,
    gap: 4,
  },
  cell: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 3,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  legendLabel: {
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 10,
    color: WORKOUT_THEME.fg4,
    ...tabularStyle,
  },
  legendSwatches: {
    flexDirection: 'row',
    gap: 3,
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 2.5,
  },
});
