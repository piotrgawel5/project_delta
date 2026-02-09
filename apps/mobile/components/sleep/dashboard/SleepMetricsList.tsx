import React from 'react';
import { View, StyleSheet } from 'react-native';
import MetricCard, { MetricCardProps } from '@components/sleep/MetricCard';

export type SleepMetricItem = MetricCardProps & {
  id: string;
};

interface SleepMetricsListProps {
  metrics: SleepMetricItem[];
}

export const SleepMetricsList = ({ metrics }: SleepMetricsListProps) => (
  <View style={styles.container}>
    {metrics.map(({ id, ...cardProps }) => (
      <MetricCard key={id} {...cardProps} />
    ))}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    gap: 12,
    alignSelf: 'stretch',
    width: '100%',
    marginBottom: 32,
  },
});
