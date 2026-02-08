import React from 'react';
import { View, StyleSheet } from 'react-native';
import MetricCard, { MetricCardProps } from '@components/sleep/MetricCard';
import { MetricInsight, MetricRecommendation } from '@components/sleep/MetricDetailSheet';

export type MetricSheetRow = {
  label: string;
  value: string;
};

export type MetricSheetData = {
  id: string;
  title: string;
  value: string;
  unit?: string;
  subtitle?: string;
  analysis?: string;
  accent: string;
  chartType?: MetricCardProps['chartType'];
  dotThreshold?: number;
  trend?: Array<number | null | undefined>;
  rows?: MetricSheetRow[];
  insights?: MetricInsight[];
  recommendations?: MetricRecommendation[];
};

export type SleepMetricItem = MetricCardProps & {
  id: string;
  sheet: MetricSheetData;
};

interface SleepMetricsListProps {
  metrics: SleepMetricItem[];
  onMetricPress?: (metric: MetricSheetData) => void;
}

export const SleepMetricsList = ({ metrics, onMetricPress }: SleepMetricsListProps) => (
  <View style={styles.container}>
    {metrics.map(({ id, sheet, ...cardProps }) => (
      <MetricCard
        key={id}
        {...cardProps}
        onPress={() => onMetricPress?.(sheet)}
      />
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
