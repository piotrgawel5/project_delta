import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { WorkoutSession } from '@shared';
import { SLEEP_FONTS, WORKOUT_THEME, tabularStyle } from '@constants';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Props {
  sessions: WorkoutSession[];
  limit?: number;
}

function totalSets(s: WorkoutSession): number {
  return s.exercises.reduce((acc, ex) => acc + ex.sets.length, 0);
}

function totalVolumeKg(s: WorkoutSession): number {
  let v = 0;
  for (const ex of s.exercises) {
    for (const set of ex.sets) {
      if (set.weightKg && set.reps) v += set.weightKg * set.reps;
    }
  }
  return Math.round(v);
}

function formatDuration(sec: number | null): string {
  if (!sec || sec <= 0) return '—';
  const m = Math.floor(sec / 60);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h > 0) return `${h}:${String(mm).padStart(2, '0')}`;
  return `0:${String(mm).padStart(2, '0')}`;
}

function formatVolume(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(kg >= 10000 ? 0 : 1)} t`;
  return `${kg.toLocaleString('en-US')} kg`;
}

function formatWeekday(date: string): string {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  return WEEKDAYS[d.getDay()];
}

function HistoryListComponent({ sessions, limit = 5 }: Props) {
  const rows = sessions.slice(0, limit);

  if (rows.length === 0) {
    return null;
  }

  return (
    <View>
      <Text style={styles.eyebrow}>History</Text>
      <View style={styles.card}>
        {rows.map((s, i) => {
          const sets = totalSets(s);
          const vol = totalVolumeKg(s);
          const isLast = i === rows.length - 1;
          return (
            <View
              key={s.id}
              style={[
                styles.row,
                !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: WORKOUT_THEME.border },
              ]}>
              <View style={styles.topLine}>
                <Text style={styles.name} numberOfLines={1}>
                  {s.name ?? 'Workout'}
                </Text>
                <Text style={styles.duration}>{formatDuration(s.durationSeconds)}</Text>
              </View>
              <View style={styles.metaRow}>
                <Mini value={String(sets)} unit="sets" />
                <Mini value={vol > 0 ? formatVolume(vol) : '—'} unit="vol" />
                <Mini value={formatWeekday(s.date)} unit="" />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function Mini({ value, unit }: { value: string; unit: string }) {
  return (
    <View style={styles.mini}>
      <Text style={styles.miniValue}>{value}</Text>
      {unit ? <Text style={styles.miniUnit}>{unit}</Text> : null}
    </View>
  );
}

export default memo(HistoryListComponent);

const styles = StyleSheet.create({
  eyebrow: {
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 11,
    color: WORKOUT_THEME.fg3,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 10,
    paddingLeft: 2,
  },
  card: {
    backgroundColor: WORKOUT_THEME.surface2,
    borderRadius: 22,
    overflow: 'hidden',
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  topLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  name: {
    flex: 1,
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 14,
    color: WORKOUT_THEME.fg,
  },
  duration: {
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 12,
    color: WORKOUT_THEME.fg3,
    marginLeft: 12,
    ...tabularStyle,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 4,
  },
  mini: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  miniValue: {
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 11,
    color: WORKOUT_THEME.fg2,
    ...tabularStyle,
  },
  miniUnit: {
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 11,
    color: WORKOUT_THEME.fg3,
    ...tabularStyle,
  },
});
