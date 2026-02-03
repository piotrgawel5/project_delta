import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

// Colors
const BG_PRIMARY = '#000000';
const ACCENT_PURPLE = '#A855F7';
const TEXT_PRIMARY = '#FFFFFF';
const TEXT_SECONDARY = 'rgba(255, 255, 255, 0.5)';
const TEXT_DISABLED = 'rgba(255, 255, 255, 0.2)';

// Simple type for history data we need
interface CalendarSleepData {
  date: string;
  quality_score: number;
}

interface SleepCalendarProps {
  isVisible: boolean;
  onClose: () => void;
  onDateSelect: (date: Date) => void;
  selectedDate: Date;
  history?: CalendarSleepData[];
}

// Helper to get color based on score (mock logic for now if score missing)
const getScoreColor = (score?: number) => {
  if (!score) return 'transparent';
  if (score >= 80) return '#22C55E'; // Green
  if (score >= 60) return '#EAB308'; // Yellow
  return '#EF4444'; // Red
};

export const SleepCalendar = ({
  isVisible,
  onClose,
  onDateSelect,
  selectedDate,
  history = [],
}: SleepCalendarProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date(selectedDate));

  const daysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const firstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const calendarDays = useMemo(() => {
    const days = [];
    const totalDays = daysInMonth(currentMonth);
    const startDay = firstDayOfMonth(currentMonth);

    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }
    for (let i = 1; i <= totalDays; i++) {
      days.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i));
    }
    return days;
  }, [currentMonth]);

  const changeMonth = (increment: number) => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() + increment);
    setCurrentMonth(newMonth);
  };

  const isSameDay = (d1: Date, d2: Date) => {
    return (
      d1.getDate() === d2.getDate() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getFullYear() === d2.getFullYear()
    );
  };

  const isToday = (date: Date) => {
    return isSameDay(date, new Date());
  };

  const getDayScore = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return history.find((h) => h.date === dateStr)?.quality_score;
  };

  const handleDatePress = (date: Date) => {
    onDateSelect(date);
    onClose();
  };

  return (
    <Modal animationType="fade" transparent={true} visible={isVisible} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <BlurView intensity={30} style={StyleSheet.absoluteFill} tint="dark" />

        <View style={styles.calendarContainer}>
          <BlurView intensity={40} tint="dark" style={styles.glassContainer}>
            {/* Header */}
            <View style={styles.header}>
              <Pressable onPress={() => changeMonth(-1)} style={styles.arrowBtn}>
                <Ionicons name="chevron-back" size={20} color={TEXT_PRIMARY} />
              </Pressable>

              <View style={styles.headerTitleContainer}>
                <Text style={styles.monthTitle}>
                  {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </Text>
                <Text style={styles.monthSubtitle}>Target reached 12/30 days</Text>
              </View>

              <Pressable onPress={() => changeMonth(1)} style={styles.arrowBtn}>
                <Ionicons name="chevron-forward" size={20} color={TEXT_PRIMARY} />
              </Pressable>
            </View>

            {/* Weekday Names */}
            <View style={styles.weekRow}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                <Text
                  key={index}
                  style={[
                    styles.weekDayText,
                    index === 6 || index === 0 ? styles.weekendText : null,
                  ]}>
                  {day}
                </Text>
              ))}
            </View>

            {/* Days Grid */}
            <View style={styles.daysGrid}>
              {calendarDays.map((date, index) => {
                if (!date) {
                  return <View key={`empty-${index}`} style={styles.dayCell} />;
                }

                const isSelected = isSameDay(date, selectedDate);
                const isCurrentDay = isToday(date);
                const score = getDayScore(date);
                // Mocking random score if missing for visual demo as user requested "how samsung has done it" implies seeing the rings
                // But we should try to use real data first. If none, maybe don't show or show gray ring?
                // User said "put sleep score under day icon".
                // I'll stick to real score if available, else standard color or hidden.
                // Actually user said "replace icon adjust with + button and make add record UI as fancy as you could... dont bother with backend".
                // So purely UI focus. I will add random scores to *demonstrate* the UI if no history.
                const visualScore = score || Math.random() * 40 + 60;
                const scoreColor = getScoreColor(visualScore);

                return (
                  <Pressable
                    key={index}
                    onPress={() => handleDatePress(date)}
                    style={styles.dayCellWrapper}>
                    {/* Ring Visualization */}
                    <View style={styles.ringContainer}>
                      {/* Simulating half-ring with borders */}
                      <View style={[styles.ring, { borderColor: scoreColor, opacity: 0.8 }]} />
                    </View>

                    <View
                      style={[
                        styles.dayCellContent,
                        isSelected && styles.selectedDayCell,
                        isCurrentDay && !isSelected && styles.todayCell,
                      ]}>
                      <Text
                        style={[
                          styles.dayText,
                          isSelected && styles.selectedDayText,
                          isCurrentDay && !isSelected && styles.todayText,
                        ]}>
                        {date.getDate()}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {/* Close Button Area */}
            <Pressable onPress={onClose} style={styles.closeArea}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </BlurView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarContainer: {
    width: Dimensions.get('window').width * 0.92,
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.6,
    shadowRadius: 40,
    elevation: 20,
    backgroundColor: 'rgba(20, 20, 20, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  glassContainer: {
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  monthTitle: {
    color: TEXT_PRIMARY,
    fontSize: 20,
    fontWeight: '700',
  },
  monthSubtitle: {
    color: TEXT_SECONDARY,
    fontSize: 12,
    marginTop: 2,
  },
  arrowBtn: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  weekDayText: {
    color: TEXT_SECONDARY,
    width: 32,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
  weekendText: {
    color: '#F87171', // Redish for weekend
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 0.85,
  },
  dayCellWrapper: {
    width: `${100 / 7}%`,
    aspectRatio: 0.85,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  ringContainer: {
    position: 'absolute',
    width: 36,
    height: 36,
    top: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ring: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 3,
    borderLeftColor: 'transparent', // Create gap for visual flair
    transform: [{ rotate: '45deg' }],
  },
  dayCellContent: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    marginTop: 0,
  },
  selectedDayCell: {
    backgroundColor: ACCENT_PURPLE,
  },
  todayCell: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  dayText: {
    color: TEXT_PRIMARY,
    fontSize: 13,
    fontWeight: '500',
  },
  selectedDayText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  todayText: {
    color: ACCENT_PURPLE,
    fontWeight: '700',
  },
  closeArea: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 12,
  },
  closeText: {
    color: TEXT_SECONDARY,
    fontSize: 15,
  },
});
