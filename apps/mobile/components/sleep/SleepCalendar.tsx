import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Dimensions,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
  FadeIn,
  FadeOut,
  Layout,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSleepStore } from '@store/sleepStore';
import { useAuthStore } from '@store/authStore';
import { getSleepScoreGrade } from '@lib/sleepColors';

// Colors & Visual Constants
const CARD_BG = '#000000';
const POPUP_BG = '#0B0B0D';
const TEXT_PRIMARY = '#F5F6F7';
const TEXT_SECONDARY = 'rgba(255, 255, 255, 0.7)';
const TEXT_DISABLED = 'rgba(255, 255, 255, 0.35)';
const ACCENT_COLOR = '#818CF8'; // Indigo 400 - Brighter accent

// Neon Colors for OLED Contrast
const NEON_COLORS = {
  Excellent: '#D8B4FE', // Lavender
  Great: '#4ADE80', // Green 400
  Good: '#A3E635', // Lime 400
  Fair: '#FACC15', // Yellow 400
  Poor: '#FB7185', // Rose 400
  Bad: '#F87171', // Red 400
  Terrible: '#EF4444', // Red 500
  NA: '#52525B', // Zinc 600
};

const BORDER_RADIUS = 30;
const STROKE = 'rgba(255,255,255,0.08)';
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface SleepCalendarProps {
  isVisible: boolean;
  onClose: () => void;
  onDateSelect: (date: Date) => void;
  selectedDate: Date;
  history?: any[];
}

type ViewMode = 'week' | 'month';

export const SleepCalendar = ({
  isVisible,
  onClose,
  onDateSelect,
  selectedDate,
}: SleepCalendarProps) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { monthlyData, fetchMonthHistory } = useSleepStore();

  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [baseDate, setBaseDate] = useState(new Date(selectedDate));

  const translateY = useSharedValue(SCREEN_HEIGHT);

  // --- Synchronization & Data Fetching ---
  useEffect(() => {
    if (isVisible) {
      setBaseDate(new Date(selectedDate));
      translateY.value = withTiming(0, { duration: 350, easing: Easing.out(Easing.cubic) });
      // Removed redundant fetch here - baseDate update triggers the specific fetch below
    } else {
      translateY.value = SCREEN_HEIGHT;
    }
  }, [isVisible, selectedDate]); // Removed user?.id dependency as it's not used inside

  useEffect(() => {
    if (user?.id && isVisible) {
      fetchMonthHistory(user.id, baseDate.getFullYear(), baseDate.getMonth());
    }
  }, [baseDate.getFullYear(), baseDate.getMonth(), user?.id, isVisible]);

  // --- Animation Handlers ---
  const closeWithAnimation = useCallback(() => {
    translateY.value = withTiming(SCREEN_HEIGHT, {
      duration: 250,
      easing: Easing.in(Easing.cubic),
    });
    setTimeout(onClose, 260);
  }, [onClose]);

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
        translateY.value = withTiming(SCREEN_HEIGHT, { duration: 250 });
        runOnJS(closeWithAnimation)();
      } else {
        translateY.value = withTiming(0, { duration: 200 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  // --- Logic Helpers ---
  const getDayData = (date: Date) => {
    const key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    const monthRecords = monthlyData[key] || [];
    const dateStr = date.toISOString().split('T')[0];
    return monthRecords.find((r) => r.date === dateStr);
  };

  const getDayColor = (score: number | undefined) => {
    if (score === undefined) return NEON_COLORS.NA;
    const { grade } = getSleepScoreGrade(score);
    // @ts-ignore - Dynamic key access
    return NEON_COLORS[grade] || NEON_COLORS.NA;
  };

  const isSameDay = (d1: Date, d2: Date) =>
    d1.getDate() === d2.getDate() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getFullYear() === d2.getFullYear();

  const getWeekNumber = (d: Date) => {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return weekNo;
  };

  const isFutureDate = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date > today;
  };

  const handleNavigate = (direction: 'prev' | 'next') => {
    const newDate = new Date(baseDate);
    if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    } else {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    }
    setBaseDate(newDate);
  };

  const handleDatePress = (date: Date) => {
    onDateSelect(date);
    if (viewMode === 'month') {
      setBaseDate(date);
    }
  };

  // --- Content Renderers ---
  const renderSegmentedControl = () => (
    <View style={styles.segmentedContainer}>
      <Pressable
        style={[styles.segmentBtn, viewMode === 'week' && styles.segmentBtnActive]}
        onPress={() => setViewMode('week')}>
        <Text style={[styles.segmentText, viewMode === 'week' && styles.segmentTextActive]}>
          Weekly
        </Text>
      </Pressable>
      <Pressable
        style={[styles.segmentBtn, viewMode === 'month' && styles.segmentBtnActive]}
        onPress={() => setViewMode('month')}>
        <Text style={[styles.segmentText, viewMode === 'month' && styles.segmentTextActive]}>
          Monthly
        </Text>
      </Pressable>
    </View>
  );

  const renderMonthGrid = () => {
    const daysInMonth = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0).getDate();
    const startDay = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1).getDay();
    const cells = Array(startDay)
      .fill(null)
      .concat(
        Array.from(
          { length: daysInMonth },
          (_, i) => new Date(baseDate.getFullYear(), baseDate.getMonth(), i + 1)
        )
      );

    return (
      <Animated.View
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(300)}
        style={styles.gridContainer}>
        <View style={styles.weekRow}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
            <Text key={i} style={[styles.weekDayText, (i === 0 || i === 6) && styles.weekendText]}>
              {day}
            </Text>
          ))}
        </View>
        <View style={styles.daysGrid}>
          {cells.map((date, i) => {
            if (!date) return <View key={`empty-${i}`} style={styles.dayCell} />;
            const dayData = getDayData(date);
            const isSelected = isSameDay(date, selectedDate);
            const isToday = isSameDay(date, new Date());
            const dayColor = getDayColor(dayData?.sleep_score);
            const isFuture = isFutureDate(date);

            return (
              <Pressable
                key={i}
                style={styles.dayCellWrapper}
                disabled={isFuture}
                onPress={() => handleDatePress(date)}>
                <View
                  style={[
                    styles.dayCellContent,
                    isSelected && { backgroundColor: dayColor, transform: [{ scale: 1.1 }] },
                    !isSelected && isToday && styles.todayCell,
                    isFuture && styles.futureCell,
                  ]}>
                  <Text
                    style={[
                      styles.dayText,
                      isSelected && { color: 'white', fontWeight: '800' },
                      !isSelected && isToday && { color: 'white', fontWeight: '600' },
                      !isSelected && !isToday && !dayData && { color: TEXT_DISABLED },
                    ]}>
                    {date.getDate()}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </Animated.View>
    );
  };

  const renderWeekView = () => {
    // 1. Calculate dates for the displayed week
    const currentDay = baseDate.getDay();
    const startOfWeek = new Date(baseDate);
    startOfWeek.setDate(baseDate.getDate() - currentDay);
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      return d;
    });

    // 2. Data for Detail Card
    const dayData = getDayData(selectedDate);
    const dayColor = getDayColor(dayData?.sleep_score);
    const grade = dayData ? getSleepScoreGrade(dayData.sleep_score || 0) : null;
    const score = dayData?.sleep_score ?? dayData?.quality_score ?? 0;
    const durationH = dayData ? Math.floor((dayData.duration_minutes || 0) / 60) : 0;
    const durationM = dayData ? (dayData.duration_minutes || 0) % 60 : 0;
    const fullDateStr = selectedDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });

    return (
      <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(300)}>
        {/* Horizontal Strip */}
        <View style={styles.weekStripContainer}>
          <View style={styles.weekStripRow}>
            {days.map((date, i) => {
              const isSelected = isSameDay(date, selectedDate);
              const isToday = isSameDay(date, new Date());
              const dData = getDayData(date);
              const dColor = getDayColor(dData?.sleep_score);
              const isFuture = isFutureDate(date);

              return (
                <Pressable
                  key={i}
                  style={styles.stripDayWrapper}
                  disabled={isFuture}
                  onPress={() => handleDatePress(date)}>
                  <Text style={[styles.stripDayName, (i === 0 || i === 6) && styles.weekendText]}>
                    {date.toLocaleDateString('en-US', { weekday: 'narrow' })}
                  </Text>
                  <View
                    style={[
                      styles.stripDayCircle,
                      isSelected && {
                        backgroundColor: dColor,
                        transform: [{ scale: 1.15 }],
                      },
                      !isSelected && isToday && styles.todayCell,
                      isFuture && styles.futureCell,
                    ]}>
                    <Text
                      style={[
                        styles.stripDayDate,
                        isSelected && { color: 'white', fontWeight: '800' },
                        !isSelected && isToday && { color: 'white', fontWeight: '700' },
                        !isSelected && !isToday && !dData && { color: TEXT_DISABLED },
                      ]}>
                      {date.getDate()}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Detail Card */}
        <Animated.View
          key={selectedDate.toISOString()}
          entering={FadeIn.duration(200)}
          style={styles.detailCardContainer}>
          {dayData ? (
            <View style={styles.detailCard}>
              <View style={[styles.detailCardIndicator, { backgroundColor: dayColor }]} />

              <View style={styles.dcHeader}>
                <Text style={styles.dcTitle}>{fullDateStr}</Text>
                <View style={[styles.gradeBadge, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                  <Text style={[styles.gradeText, { color: dayColor }]}>{grade?.grade}</Text>
                </View>
              </View>

              <View style={styles.dcMetricsRow}>
                <View style={styles.dcMetric}>
                  <Ionicons name="bed" size={20} color={TEXT_SECONDARY} />
                  <Text style={styles.dcMetricValue}>
                    {durationH}
                    <Text style={styles.dcUnit}>h</Text> {durationM}
                    <Text style={styles.dcUnit}>m</Text>
                  </Text>
                  <Text style={styles.dcLabel}>Duration</Text>
                </View>

                <View style={styles.dcDivider} />

                <View style={styles.dcMetric}>
                  <Ionicons name="battery-charging" size={20} color={TEXT_SECONDARY} />
                  <Text style={styles.dcMetricValue}>{score}</Text>
                  <Text style={styles.dcLabel}>Sleep Score</Text>
                </View>
              </View>
            </View>
          ) : (
            <View
              style={[
                styles.detailCard,
                { alignItems: 'center', justifyContent: 'center', minHeight: 120 },
              ]}>
              <Text style={styles.dcTitle}>{fullDateStr}</Text>
              <Text style={styles.wcEmpty}>No sleep data recorded for this day.</Text>
            </View>
          )}
        </Animated.View>
      </Animated.View>
    );
  };

  const navTitle =
    viewMode === 'week'
      ? `Week ${getWeekNumber(baseDate)}, ${baseDate.getFullYear()}`
      : baseDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  if (!isVisible) return null;

  return (
    <Modal animationType="none" transparent visible={isVisible} onRequestClose={closeWithAnimation}>
      <Pressable style={styles.backdrop} onPress={closeWithAnimation}>
        <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />
        <View style={StyleSheet.absoluteFill} />
      </Pressable>

      <GestureHandlerRootView style={styles.gestureRoot} pointerEvents="box-none">
        <GestureDetector gesture={sheetGesture}>
          <Animated.View style={[styles.sheetWrapper, sheetStyle]}>
            <View style={styles.shadowContainer}>
              <View style={[styles.contentClipper]}>
                <View style={[styles.innerContent, { paddingBottom: insets.bottom + 20 }]}>
                  <View style={styles.handleContainer}>
                    <View style={styles.handle} />
                  </View>

                  <View style={styles.header}>
                    <Text style={styles.title}>Sleep History</Text>
                    <Pressable onPress={closeWithAnimation} style={styles.closeBtn}>
                      <Ionicons name="close" size={20} color="#8E8E93" />
                    </Pressable>
                  </View>

                  <View style={styles.controlsSection}>{renderSegmentedControl()}</View>

                  <View style={styles.navHeader}>
                    <Pressable onPress={() => handleNavigate('prev')} style={styles.arrowBtn}>
                      <Ionicons name="chevron-back" size={20} color={TEXT_PRIMARY} />
                    </Pressable>
                    <Text style={styles.navTitle}>{navTitle}</Text>
                    <Pressable onPress={() => handleNavigate('next')} style={styles.arrowBtn}>
                      <Ionicons name="chevron-forward" size={20} color={TEXT_PRIMARY} />
                    </Pressable>
                  </View>

                  <Animated.View layout={Layout.springify().damping(18).stiffness(120)}>
                    {viewMode === 'month' ? renderMonthGrid() : renderWeekView()}
                  </Animated.View>
                </View>
              </View>
            </View>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  gestureRoot: { flex: 1, justifyContent: 'flex-end', pointerEvents: 'box-none' },

  sheetWrapper: {
    width: '100%',
    justifyContent: 'flex-end',
  },
  shadowContainer: {
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.35,
    shadowRadius: 15,
    elevation: 30,
  },
  contentClipper: {
    backgroundColor: CARD_BG,
    borderTopLeftRadius: BORDER_RADIUS,
    borderTopRightRadius: BORDER_RADIUS,
    borderWidth: 1,
    borderColor: STROKE,
    overflow: 'hidden',
    width: '100%',
  },
  innerContent: {},

  handleContainer: { alignItems: 'center', paddingTop: 10, paddingBottom: 10 },
  handle: {
    width: 40,
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: BORDER_RADIUS,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  title: { color: 'white', fontSize: 20, fontWeight: '700' },
  closeBtn: {
    padding: 8,
    backgroundColor: '#0F1117',
    borderRadius: BORDER_RADIUS,
    borderWidth: 1,
    borderColor: STROKE,
  },

  controlsSection: { paddingHorizontal: 20, marginBottom: 20 },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: '#0F1117',
    borderRadius: BORDER_RADIUS,
    padding: 4,
    height: 48,
    borderWidth: 1,
    borderColor: STROKE,
  },
  segmentBtn: { flex: 1, borderRadius: BORDER_RADIUS, justifyContent: 'center', alignItems: 'center' },
  segmentBtnActive: {
    backgroundColor: '#1A1C22',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  segmentText: { color: '#8E8E93', fontSize: 15, fontWeight: '600' },
  segmentTextActive: { color: 'white', fontWeight: '700' },

  navHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  navTitle: { color: 'white', fontSize: 17, fontWeight: '600' },
  arrowBtn: {
    padding: 8,
    borderRadius: BORDER_RADIUS,
    backgroundColor: '#0F1117',
    borderWidth: 1,
    borderColor: STROKE,
  },

  // Month Grid
  gridContainer: { paddingHorizontal: 20, paddingBottom: 10 },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekRow: { flexDirection: 'row', marginBottom: 10 },
  weekDayText: {
    flex: 1,
    textAlign: 'center',
    color: TEXT_SECONDARY,
    fontSize: 13,
    fontWeight: '600',
  },
  weekendText: { color: '#F87171' },

  dayCell: { width: `${100 / 7}%`, aspectRatio: 1 },
  dayCellWrapper: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  dayCellContent: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    overflow: 'hidden',
  },
  futureCell: { opacity: 0.3 },
  todayCell: { backgroundColor: 'rgba(255,255,255,0.1)' },
  dayText: { fontSize: 15, fontWeight: '500', color: TEXT_PRIMARY },

  // Weekly View Styles
  weekStripContainer: { marginBottom: 20, paddingHorizontal: 20 },
  weekStripRow: { flexDirection: 'row', justifyContent: 'space-between' },
  stripDayWrapper: { alignItems: 'center', gap: 8 },
  stripDayName: {
    fontSize: 11,
    color: TEXT_SECONDARY,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  stripDayCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stripDayDate: { fontSize: 16, fontWeight: '600', color: TEXT_PRIMARY },

  // Detail Card Styles
  detailCardContainer: { paddingHorizontal: 20 },
  detailCard: {
    backgroundColor: '#0F1117',
    borderRadius: BORDER_RADIUS,
    padding: 24,
    borderWidth: 1,
    borderColor: STROKE,
  },
  detailCardIndicator: {
    position: 'absolute',
    top: 24,
    left: 0,
    width: 4,
    height: 32,
    borderTopRightRadius: BORDER_RADIUS,
    borderBottomRightRadius: BORDER_RADIUS,
  },
  dcHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  dcTitle: { fontSize: 18, fontWeight: '700', color: 'white', flex: 1 },
  gradeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: BORDER_RADIUS },
  gradeText: { fontWeight: '800', fontSize: 14 },

  dcMetricsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  dcMetric: { alignItems: 'center', gap: 4 },
  dcMetricValue: { fontSize: 24, fontWeight: '700', color: 'white' },
  dcUnit: { fontSize: 14, fontWeight: '500', color: TEXT_SECONDARY },
  dcLabel: { fontSize: 13, color: TEXT_SECONDARY, fontWeight: '500' },
  dcDivider: { width: 1, height: 40, backgroundColor: STROKE },

  wcEmpty: { color: TEXT_DISABLED, fontSize: 15, textAlign: 'center', marginTop: 10 },
});
