import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface WeeklyData {
  date: string;
  day: string;
  durationHours: number;
  quality: number; // 0-100
  isToday: boolean;
}

interface WeeklyBarChartProps {
  data: WeeklyData[];
  selectedIndex: number;
  onSelectDay: (index: number) => void;
}

const CHART_PADDING = 20;
const CHART_INNER_RADIUS = 4;
const CHART_RADIUS = CHART_INNER_RADIUS + CHART_PADDING;
const BAR_TRACK_RADIUS = 10;

export const WeeklyBarChart = ({ data, selectedIndex, onSelectDay }: WeeklyBarChartProps) => {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>This Week</Text>
      <View style={styles.chartRow}>
        {data.map((item, index) => {
          const isSelected = index === selectedIndex;
          // Scale max to 10 hours for bar height
          const barHeightPct = Math.min((item.durationHours / 10) * 100, 100);

          return (
            <Pressable key={item.date} style={styles.dayColumn} onPress={() => onSelectDay(index)}>
              <View style={styles.barTrack}>
                <LinearGradient
                  colors={isSelected ? ['#34D399', '#34D399'] : ['#3F3F46', '#27272A']}
                  style={[styles.barFill, { height: `${Math.max(barHeightPct, 5)}%` }]}
                />
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.labelsRow}>
        {data.map((item, index) => {
          const isSelected = index === selectedIndex;
          return (
            <Text key={`${item.date}-label`} style={[styles.dayLabel, isSelected && styles.dayLabelSelected]}>
              {item.day[0]}
            </Text>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  chartRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    height: 120,
    backgroundColor: '#1C1C1E',
    borderRadius: CHART_RADIUS,
    padding: CHART_PADDING,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  dayColumn: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1,
    gap: 4,
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: CHART_PADDING,
    marginTop: 6,
  },
  barTrack: {
    flex: 1,
    width: '65%',
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: BAR_TRACK_RADIUS,
  },
  barFill: {
    width: '100%',
    borderTopLeftRadius: BAR_TRACK_RADIUS,
    borderTopRightRadius: BAR_TRACK_RADIUS,
  },
  dayLabel: {
    color: 'rgba(235,235,245,0.6)',
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
    textAlign: 'center',
  },
  dayLabelSelected: {
    color: '#fff',
    fontWeight: '700',
  },
});
