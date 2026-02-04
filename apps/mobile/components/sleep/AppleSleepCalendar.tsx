import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Modal, Dimensions, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSleepStore } from '@store/sleepStore';
import { useAuthStore } from '@store/authStore';
import { getSleepScoreGrade } from '@lib/sleepColors';

// Colors
const CARD_BG = '#1C1C1E';
const POPUP_BG = '#2C2C2E';
const TEXT_PRIMARY = '#FFFFFF';
const TEXT_SECONDARY = 'rgba(255, 255, 255, 0.5)';
const TEXT_DISABLED = 'rgba(255, 255, 255, 0.3)';

// Visual Constants
const BORDER_RADIUS = 24;
const { height } = Dimensions.get('window');

interface SleepCalendarProps {
  isVisible: boolean;
  onClose: () => void;
  onDateSelect: (date: Date) => void;
  selectedDate: Date;
  history?: any[];
}

export const SleepCalendar = ({
  isVisible,
  onClose,
  onDateSelect,
  selectedDate,
}: SleepCalendarProps) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { monthlyData, fetchMonthHistory } = useSleepStore();

  const [currentMonth, setCurrentMonth] = useState(new Date(selectedDate));
  const [internalSelectedDate, setInternalSelectedDate] = useState(new Date(selectedDate));

  const translateY = useSharedValue(height);

  // Sync internal state when prop changes
  useEffect(() => {
    if (isVisible) {
      setInternalSelectedDate(new Date(selectedDate));
      setCurrentMonth(new Date(selectedDate));
      translateY.value = withTiming(0, { duration: 350, easing: Easing.out(Easing.cubic) });

      // Fetch data for initial month
      if (user?.id) {
        fetchMonthHistory(user.id, selectedDate.getFullYear(), selectedDate.getMonth());
      }
    } else {
      translateY.value = height;
    }
  }, [isVisible, selectedDate, user?.id]);

  // Fetch on month change
  useEffect(() => {
    if (user?.id && isVisible) {
      fetchMonthHistory(user.id, currentMonth.getFullYear(), currentMonth.getMonth());
    }
  }, [currentMonth.getFullYear(), currentMonth.getMonth(), user?.id, isVisible]);

  const closeWithAnimation = useCallback(() => {
    translateY.value = withTiming(height, { duration: 250, easing: Easing.in(Easing.cubic) });
    setTimeout(onClose, 260);
  }, [onClose]);

  // Gesture
  const sheetGesture = Gesture.Pan()
    .onUpdate((e) => {
      'worklet';
      if (e.translationY > 0) {
        translateY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      'worklet';
      if (translateY.value > 120 || e.velocityY > 600) {
        translateY.value = withTiming(height, { duration: 250 });
        runOnJS(closeWithAnimation)();
      } else {
        translateY.value = withTiming(0, { duration: 200 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

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

  const getDayData = (date: Date) => {
    const key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    const monthRecords = monthlyData[key] || [];
    const dateStr = date.toISOString().split('T')[0];
    return monthRecords.find((r) => r.date === dateStr);
  };

  const isSameDay = (d1: Date, d2: Date) => {
    return (
      d1.getDate() === d2.getDate() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getFullYear() === d2.getFullYear()
    );
  };

  const handleDayPress = (date: Date) => {
    setInternalSelectedDate(date);
  };

  const handleConfirmSelection = () => {
    onDateSelect(internalSelectedDate);
    closeWithAnimation();
  };

  // Get data for the selected card
  const selectedData = getDayData(internalSelectedDate);
  const grade = selectedData
    ? getSleepScoreGrade(selectedData.sleep_score || selectedData.quality_score || 0)
    : null;

  // Format stats
  const durationH = selectedData ? Math.floor((selectedData.duration_minutes || 0) / 60) : 0;
  const durationM = selectedData ? (selectedData.duration_minutes || 0) % 60 : 0;
  const deepMin = selectedData?.deep_sleep_minutes || 0;
  const remMin = selectedData?.rem_sleep_minutes || 0;

  if (!isVisible) return null;

  return (
    <Modal animationType="none" transparent visible={isVisible} onRequestClose={closeWithAnimation}>
      <Pressable style={styles.backdrop} onPress={closeWithAnimation}>
        <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />
      </Pressable>

      <GestureHandlerRootView style={styles.gestureRoot} pointerEvents="box-none">
        <GestureDetector gesture={sheetGesture}>
          <Animated.View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }, sheetStyle]}>
            <View style={styles.headerZone}>
              <View style={styles.handleContainer}>
                <View style={styles.handle} />
              </View>

              <View style={styles.header}>
                <Text style={styles.title}>Sleep History</Text>
                <Pressable onPress={closeWithAnimation} style={styles.closeBtn}>
                  <Ionicons name="close" size={20} color="#8E8E93" />
                </Pressable>
              </View>
            </View>

            <View style={styles.content}>
              {/* Calendar Navigation */}
              <View style={styles.calNavHeader}>
                <Pressable onPress={() => changeMonth(-1)} style={styles.arrowBtn}>
                  <Ionicons name="chevron-back" size={20} color={TEXT_PRIMARY} />
                </Pressable>

                <View style={styles.monthTitleCoords}>
                  <Text style={styles.monthTitle}>
                    {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </Text>
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

                  const isSelected = isSameDay(date, internalSelectedDate);
                  const isCurrentDay = isSameDay(date, new Date());
                  const dayData = getDayData(date);
                  const dayGrade = dayData ? getSleepScoreGrade(dayData.sleep_score || 0) : null;
                  const dayColor = dayGrade ? dayGrade.color : '#666666';

                  return (
                    <Pressable
                      key={index}
                      onPress={() => handleDayPress(date)}
                      style={styles.dayCellWrapper}>
                      <View
                        style={[
                          styles.dayCellContent,
                          isSelected &&
                            dayGrade && {
                              backgroundColor: dayGrade.color,
                            },
                          !isSelected && isCurrentDay && styles.todayCell,
                        ]}>
                        <Text
                          style={[
                            styles.dayText,
                            isSelected && { color: '#FFFFFF', fontWeight: '800' },
                            !isSelected && isCurrentDay && { color: '#FFFFFF', fontWeight: '600' },
                            !isSelected &&
                              !isCurrentDay &&
                              dayData && { color: dayColor, fontWeight: '600' },
                            !isSelected && !isCurrentDay && !dayData && { color: TEXT_DISABLED },
                          ]}>
                          {date.getDate()}
                        </Text>

                        {/* Dot indicator for data if not selected */}
                        {!isSelected && dayData && (
                          <View style={[styles.dataDot, { backgroundColor: dayColor }]} />
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              {/* Apple Fitness-Style Summary Card */}
              <View style={styles.cardContainer}>
                <Pressable
                  style={styles.summaryCard}
                  onPress={handleConfirmSelection}
                  android_ripple={{ color: 'rgba(255,255,255,0.05)' }}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardDate}>
                      {internalSelectedDate.toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color={TEXT_SECONDARY} />
                  </View>

                  {selectedData && grade ? (
                    <View style={styles.cardContent}>
                      <View style={styles.statsColumn}>
                        <View style={styles.statRow}>
                          <View style={[styles.statIcon, { backgroundColor: '#10B981' }]}>
                            <Ionicons name="bed" size={14} color="#FFFFFF" />
                          </View>
                          <View style={styles.statTextContainer}>
                            <Text style={styles.statValue}>
                              {durationH * 60 + durationM}{' '}
                              <Text style={styles.statUnit}>/{Math.floor(8 * 60)} mins</Text>
                            </Text>
                          </View>
                        </View>

                        <View style={styles.statRow}>
                          <View style={[styles.statIcon, { backgroundColor: '#3B82F6' }]}>
                            <Ionicons name="time" size={14} color="#FFFFFF" />
                          </View>
                          <View style={styles.statTextContainer}>
                            <Text style={styles.statValue}>
                              {deepMin}{' '}
                              <Text style={styles.statUnit}>
                                /{Math.floor(durationH * 60 * 0.2)} mins
                              </Text>
                            </Text>
                          </View>
                        </View>

                        <View style={styles.statRow}>
                          <View style={[styles.statIcon, { backgroundColor: '#EC4899' }]}>
                            <Ionicons name="flame" size={14} color="#FFFFFF" />
                          </View>
                          <View style={styles.statTextContainer}>
                            <Text style={styles.statValue}>
                              {remMin}{' '}
                              <Text style={styles.statUnit}>
                                /{Math.floor(durationH * 60 * 0.25)} mins
                              </Text>
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.emptyCardContent}>
                      <Ionicons
                        name="moon-outline"
                        size={32}
                        color={TEXT_DISABLED}
                        style={{ marginBottom: 8 }}
                      />
                      <Text style={styles.emptyText}>No sleep data recorded</Text>
                    </View>
                  )}
                </Pressable>
              </View>
            </View>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  gestureRoot: { flex: 1, justifyContent: 'flex-end', pointerEvents: 'box-none' },
  sheet: {
    backgroundColor: CARD_BG,
    borderTopLeftRadius: BORDER_RADIUS,
    borderTopRightRadius: BORDER_RADIUS,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
    maxHeight: '90%',
  },
  headerZone: {
    width: '100%',
    paddingBottom: 4,
    backgroundColor: 'transparent',
    paddingTop: 16,
  },
  handleContainer: { alignItems: 'center', marginBottom: 8 },
  handle: { width: 36, height: 5, backgroundColor: '#48484A', borderRadius: 3 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  title: { color: 'white', fontSize: 19, fontWeight: '700' },
  closeBtn: { padding: 6, backgroundColor: POPUP_BG, borderRadius: 14 },

  content: { paddingHorizontal: 20, paddingBottom: 20 },

  calNavHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 4,
  },
  monthTitleCoords: { alignItems: 'center' },
  arrowBtn: {
    padding: 8,
    backgroundColor: POPUP_BG,
    borderRadius: 12,
  },
  monthTitle: {
    color: TEXT_PRIMARY,
    fontSize: 18,
    fontWeight: '700',
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  weekDayText: {
    color: TEXT_SECONDARY,
    width: 40,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
  },
  weekendText: { color: '#F87171' },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
  },
  dayCellWrapper: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  dayCellContent: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  todayCell: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  dayText: {
    color: TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: '500',
  },
  dataDot: {
    position: 'absolute',
    bottom: 6,
    width: 4,
    height: 4,
    borderRadius: 2,
  },

  // Card
  cardContainer: {
    marginTop: 8,
  },
  summaryCard: {
    backgroundColor: POPUP_BG,
    borderRadius: 20,
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardDate: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  statsColumn: {
    flex: 1,
    gap: 12,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  statTextContainer: {
    flex: 1,
  },
  statValue: {
    color: 'white',
    fontSize: 17,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  statUnit: {
    fontSize: 15,
    fontWeight: '500',
    color: TEXT_SECONDARY,
  },
  emptyCardContent: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: TEXT_DISABLED,
    fontSize: 15,
  },
});
