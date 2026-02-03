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
              <Text style={[styles.dayLabel, isSelected && styles.dayLabelSelected]}>
                {item.day[0]}
              </Text>
            </Pressable>
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
    borderRadius: 16,
    padding: 16,
  },
  dayColumn: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1,
    gap: 8,
  },
  barTrack: {
    flex: 1,
    width: 6,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 3,
  },
  barFill: {
    width: '100%',
    borderRadius: 3,
  },
  dayLabel: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '500',
  },
  dayLabelSelected: {
    color: '#fff',
    fontWeight: '700',
  },
});
