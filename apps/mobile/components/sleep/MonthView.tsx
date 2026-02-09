import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const CELL_SIZE = 40;
const SPACING = 8;
const CONTAINER_PADDING = 16;
const CONTAINER_INNER_RADIUS = 8;
const CONTAINER_RADIUS = CONTAINER_INNER_RADIUS + CONTAINER_PADDING;
const TODAY_CELL_RADIUS = Math.round(CELL_SIZE * 0.2 + SPACING);
const INDICATOR_SIZE = 6;
const INDICATOR_RADIUS = INDICATOR_SIZE / 2;

interface DayData {
  date: string;
  score: number;
  hasData: boolean;
}

interface MonthViewProps {
  currentDate: Date;
  onChangeMonth: (increment: number) => void;
  onSelectDay: (date: Date) => void;
  data: Record<string, number>; // date "YYYY-MM-DD" -> sleepScore
}

export function MonthView({ currentDate, onChangeMonth, onSelectDay, data }: MonthViewProps) {
  const days = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // First day of month
    const firstDay = new Date(year, month, 1);
    // Last day of month
    const lastDay = new Date(year, month + 1, 0);

    // Days in previous month to fill grid
    const startPadding = firstDay.getDay(); // 0 = Sunday

    const result = [];

    // Previous month padding
    for (let i = 0; i < startPadding; i++) {
      result.push(null);
    }

    // Days of current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      result.push(new Date(year, month, i));
    }

    return result;
  }, [currentDate]);

  const getScoreColor = (score: number) => {
    if (score >= 85) return '#34D399'; // Green
    if (score >= 70) return '#38BDF8'; // Blue
    if (score >= 50) return '#FBBF24'; // Yellow
    return '#EC4899'; // Pink
  };

  const monthLabel = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => onChangeMonth(-1)} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color="#FFF" />
        </Pressable>
        <Text style={styles.monthTitle}>{monthLabel}</Text>
        <Pressable onPress={() => onChangeMonth(1)} hitSlop={10}>
          <Ionicons name="chevron-forward" size={24} color="#FFF" />
        </Pressable>
      </View>

      {/* Weekday Headers */}
      <View style={styles.weekRow}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <Text key={i} style={styles.weekDayText}>
            {d}
          </Text>
        ))}
      </View>

      {/* Grid */}
      <View style={styles.grid}>
        {days.map((date, i) => {
          if (!date || !(date instanceof Date)) {
            return <View key={`empty-${i}`} style={styles.cell} />;
          }

          const dateKey = date.toISOString().split('T')[0];
          const score = (data || {})[dateKey];
          const hasData = typeof score === 'number';
          const isToday = new Date().toDateString() === date.toDateString();

          return (
            <Pressable
              key={dateKey}
              style={[styles.cell, isToday && styles.todayCell]}
              onPress={() => onSelectDay(date)}>
              <Text style={[styles.dayText, isToday && styles.todayText]}>{date.getDate()}</Text>
              {hasData && (
                <View style={[styles.indicator, { backgroundColor: getScoreColor(score) }]} />
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: CONTAINER_PADDING,
    backgroundColor: '#1A1A1A',
    borderRadius: CONTAINER_RADIUS,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  monthTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 10,
    justifyContent: 'space-between',
  },
  weekDayText: {
    width: CELL_SIZE,
    textAlign: 'center',
    color: '#666',
    fontSize: 12,
    fontWeight: '500',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING,
  },
  todayCell: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: TODAY_CELL_RADIUS,
  },
  dayText: {
    color: '#E0E0E0',
    fontSize: 14,
    fontWeight: '500',
  },
  todayText: {
    color: '#FFF',
    fontWeight: '700',
  },
  indicator: {
    width: INDICATOR_SIZE,
    height: INDICATOR_SIZE,
    borderRadius: INDICATOR_RADIUS,
    marginTop: 4,
  },
});
