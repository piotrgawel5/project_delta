import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const CARD_PADDING = 20;
const CARD_INNER_RADIUS = 4;
const CARD_RADIUS = CARD_INNER_RADIUS + CARD_PADDING;
const ICON_SIZE = 28;
const ICON_RADIUS = ICON_SIZE / 2;

interface SingleMetricProps {
  label: string;
  value: string;
  subValue?: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  dataDate?: Date | string | null;
  selectedDate?: Date | string | null;
}

const toDateKey = (value?: Date | string | null) => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
};

const formatShortDate = (value: Date | string) => {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d);
};

const getRelativeDateLabel = (
  value?: Date | string | null,
  selected?: Date | string | null
) => {
  const key = toDateKey(value);
  if (!key) return null;
  const selectedKey = toDateKey(selected);
  if (selectedKey && selectedKey === key) return null;
  const todayKey = toDateKey(new Date());
  if (todayKey === key) return 'Today';
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = toDateKey(yesterday);
  if (yesterdayKey === key) return 'Yesterday';
  return formatShortDate(value as Date | string);
};

const MetricCard = ({
  label,
  value,
  subValue,
  icon,
  color,
  dataDate,
  selectedDate,
}: SingleMetricProps) => {
  const dateLabel = useMemo(
    () => getRelativeDateLabel(dataDate, selectedDate),
    [dataDate, selectedDate]
  );

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={[styles.iconContainer, { backgroundColor: `${color}20` }]}>
            <Ionicons name={icon} size={18} color={color} />
          </View>
          <Text style={styles.label}>{label}</Text>
        </View>
        {dateLabel ? <Text style={styles.dateLabel}>{dateLabel}</Text> : null}
      </View>
      <View style={styles.valueContainer}>
        <Text style={styles.value}>{value}</Text>
        {subValue && <Text style={styles.subValue}>{subValue}</Text>}
      </View>
    </View>
  );
};

interface SleepMetricsBentoProps {
  durationHours: number;
  quality: number;
  deepMin: number;
  remMin: number;
  dataDate?: Date | string | null;
  selectedDate?: Date | string | null;
}

export const SleepMetricsBento = ({
  durationHours,
  quality,
  deepMin,
  remMin,
  dataDate,
  selectedDate,
}: SleepMetricsBentoProps) => {
  const formatMin = (m: number) => {
    const h = Math.floor(m / 60);
    const min = Math.round(m % 60);
    return h > 0 ? `${h}h ${min}m` : `${min}m`;
  };

  const formatDuration = (h: number) => {
    const hours = Math.floor(h);
    const mins = Math.round((h - hours) * 60);
    return `${hours}h ${mins}m`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <MetricCard
          label="Duration"
          value={formatDuration(durationHours)}
          subValue="Total Sleep"
          icon="time"
          color="#60A5FA" // Blue
          dataDate={dataDate}
          selectedDate={selectedDate}
        />
        <MetricCard
          label="Quality"
          value={`${quality}%`}
          subValue="Sleep Score"
          icon="ribbon"
          color="#A78BFA" // Purple
          dataDate={dataDate}
          selectedDate={selectedDate}
        />
      </View>
      <View style={styles.row}>
        <MetricCard
          label="Deep Sleep"
          value={formatMin(deepMin)}
          subValue="Restorative"
          icon="battery-charging"
          color="#34D399" // Green
          dataDate={dataDate}
          selectedDate={selectedDate}
        />
        <MetricCard
          label="REM Sleep"
          value={formatMin(remMin)}
          subValue="Mental Recovery"
          icon="eye"
          color="#F472B6" // Pink
          dataDate={dataDate}
          selectedDate={selectedDate}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  card: {
    flex: 1,
    backgroundColor: '#1C1C1E',
    borderRadius: CARD_RADIUS,
    padding: CARD_PADDING,
    height: 110,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconContainer: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: 'rgba(235,235,245,0.6)',
    fontSize: 13,
    fontWeight: '600',
  },
  dateLabel: {
    color: 'rgba(235,235,245,0.4)',
    fontSize: 11,
    fontWeight: '600',
  },
  valueContainer: {
    marginTop: 8,
  },
  value: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  subValue: {
    color: 'rgba(235,235,245,0.6)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
});
