import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SingleMetricProps {
  label: string;
  value: string;
  subValue?: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

const MetricCard = ({ label, value, subValue, icon, color }: SingleMetricProps) => (
  <View style={styles.card}>
    <View style={styles.header}>
      <View style={[styles.iconContainer, { backgroundColor: `${color}20` }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.label}>{label}</Text>
    </View>
    <View style={styles.valueContainer}>
      <Text style={styles.value}>{value}</Text>
      {subValue && <Text style={styles.subValue}>{subValue}</Text>}
    </View>
  </View>
);

interface SleepMetricsBentoProps {
  durationHours: number;
  quality: number;
  deepMin: number;
  remMin: number;
}

export const SleepMetricsBento = ({
  durationHours,
  quality,
  deepMin,
  remMin,
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
        />
        <MetricCard
          label="Quality"
          value={`${quality}%`}
          subValue="Sleep Score"
          icon="ribbon"
          color="#A78BFA" // Purple
        />
      </View>
      <View style={styles.row}>
        <MetricCard
          label="Deep Sleep"
          value={formatMin(deepMin)}
          subValue="Restorative"
          icon="battery-charging"
          color="#34D399" // Green
        />
        <MetricCard
          label="REM Sleep"
          value={formatMin(remMin)}
          subValue="Mental Recovery"
          icon="eye"
          color="#F472B6" // Pink
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
    borderRadius: 16,
    padding: 16,
    height: 110,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: '#8E8E93',
    fontSize: 13,
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
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
});
