import { StyleSheet, Text, View } from 'react-native';
import { SLEEP_FONTS, SLEEP_LAYOUT, SLEEP_THEME } from '@constants';
import type { SleepCardBedtimeProps } from '../../../types/sleep-ui';

function DotRow({
  values,
  todayIndex,
  color,
}: {
  values: readonly (number | null)[];
  todayIndex: number;
  color: string;
}) {
  return (
    <View style={styles.dotsRow}>
      {values.map((value, index) => {
        const isToday = index === todayIndex;
        const dotSize = isToday ? SLEEP_LAYOUT.dotSizeToday : SLEEP_LAYOUT.dotSize;

        return (
          <View key={`${index}-${value ?? 'empty'}`} style={styles.dotOuter}>
            {isToday ? (
              <View
                style={[
                  styles.dotGlow,
                  {
                    backgroundColor: color,
                    opacity: value === null ? 0.12 : 0.3,
                  },
                ]}
              />
            ) : null}
            <View
              style={[
                styles.dot,
                {
                  width: dotSize,
                  height: dotSize,
                  borderRadius: dotSize / 2,
                  backgroundColor: color,
                  opacity: value === null ? 0.4 : 1,
                },
              ]}
            />
          </View>
        );
      })}
    </View>
  );
}

function TimeDisplay({
  value,
}: {
  value: { time: string; meridiem: string } | null;
}) {
  return (
    <View style={styles.timeRow}>
      <Text style={[styles.timeValue, !value && styles.timeMissing]}>{value?.time ?? '--:--'}</Text>
      <Text style={[styles.timeMeridiem, !value && styles.timeMissing]}>{value?.meridiem ?? ''}</Text>
    </View>
  );
}

function TimePanel({
  title,
  time,
  values,
  todayIndex,
  color,
}: {
  title: string;
  time: { time: string; meridiem: string } | null;
  values: readonly (number | null)[];
  todayIndex: number;
  color: string;
}) {
  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>{title}</Text>
      <TimeDisplay value={time} />
      <DotRow values={values} todayIndex={todayIndex} color={color} />
    </View>
  );
}

export default function SleepCardBedtime({
  bedtime,
  wakeTime,
  weekBedtimes,
  weekWakeTimes,
  todayIndex,
}: SleepCardBedtimeProps) {
  return (
    <View style={styles.card}>
      <TimePanel
        title="FELL ASLEEP"
        time={bedtime}
        values={weekBedtimes}
        todayIndex={todayIndex}
        color={SLEEP_THEME.colorBedtime}
      />
      <View style={styles.divider} />
      <TimePanel
        title="WOKE UP"
        time={wakeTime}
        values={weekWakeTimes}
        todayIndex={todayIndex}
        color={SLEEP_THEME.warning}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: SLEEP_THEME.cardBg,
    borderRadius: SLEEP_LAYOUT.cardRadiusOuter,
    padding: SLEEP_LAYOUT.cardPadding,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  panel: {
    flex: 1,
    justifyContent: 'space-between',
  },
  panelTitle: {
    marginBottom: 14,
    color: SLEEP_THEME.textMuted1,
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  timeValue: {
    color: SLEEP_THEME.textPrimary,
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 36,
    lineHeight: 40,
  },
  timeMeridiem: {
    marginLeft: 4,
    marginBottom: 4,
    color: SLEEP_THEME.textSecondary,
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 18,
    lineHeight: 20,
  },
  timeMissing: {
    opacity: 0.4,
  },
  divider: {
    width: 1,
    height: `${SLEEP_LAYOUT.dividerHeightRatio * 100}%`,
    alignSelf: 'center',
    marginHorizontal: 18,
    backgroundColor: SLEEP_THEME.border,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dotOuter: {
    width: SLEEP_LAYOUT.dotGlowSize,
    height: SLEEP_LAYOUT.dotGlowSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotGlow: {
    position: 'absolute',
    width: SLEEP_LAYOUT.dotGlowSize,
    height: SLEEP_LAYOUT.dotGlowSize,
    borderRadius: SLEEP_LAYOUT.dotGlowSize / 2,
  },
  dot: {
    position: 'absolute',
  },
});
