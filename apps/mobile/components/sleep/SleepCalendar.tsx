import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Modal, Dimensions, Pressable } from 'react-native';
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
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSleepStore } from '@store/sleepStore';
import { useAuthStore } from '@store/authStore';
import { getSleepScoreGrade } from '@lib/sleepColors';

// Colors & Visual Constants
const CARD_BG = '#000000';
const TEXT_PRIMARY = '#F5F6F7';
const TEXT_SECONDARY = 'rgba(255, 255, 255, 0.7)';
const TEXT_DISABLED = 'rgba(255, 255, 255, 0.35)';

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

const SHEET_PADDING = 20;
const SHEET_INNER_RADIUS = 24;
const SHEET_RADIUS = SHEET_INNER_RADIUS + SHEET_PADDING;
const HANDLE_HEIGHT = 5;
const HANDLE_RADIUS = HANDLE_HEIGHT / 2;
const CLOSE_BTN_PADDING = 8;
const CLOSE_BTN_INNER_RADIUS = 10;
const CLOSE_BTN_RADIUS = CLOSE_BTN_INNER_RADIUS + CLOSE_BTN_PADDING;
const SEGMENT_PADDING = 4;
const SEGMENT_INNER_RADIUS = 24;
const SEGMENT_RADIUS = SEGMENT_INNER_RADIUS + SEGMENT_PADDING;
const DAY_CELL_SIZE = 36;
const DAY_CELL_RADIUS = DAY_CELL_SIZE / 2;
const STRIP_DAY_SIZE = 40;
const STRIP_DAY_RADIUS = STRIP_DAY_SIZE / 2;
const SELECTED_DAY_SIZE = 36;
const SELECTED_DAY_RADIUS = 12;
const DETAIL_CARD_PADDING = 20;
const DETAIL_CARD_INNER_RADIUS = 16;
const DETAIL_CARD_RADIUS = DETAIL_CARD_INNER_RADIUS + DETAIL_CARD_PADDING;
const INDICATOR_WIDTH = 4;
const INDICATOR_RADIUS = INDICATOR_WIDTH / 2;
const GRADE_BADGE_PADDING_Y = 4;
const GRADE_BADGE_INNER_RADIUS = 6;
const GRADE_BADGE_RADIUS = GRADE_BADGE_INNER_RADIUS + GRADE_BADGE_PADDING_Y;
const STROKE = 'rgba(255,255,255,0.08)';
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type SleepQuality = 'Excellent' | 'Good' | 'Fair' | 'Bad';

const QUALITY_BADGE: Record<SleepQuality, { bg: string; text: string }> = {
  Excellent: { bg: '#1A3A2A', text: '#4CD97B' },
  Good: { bg: '#1A2E3A', text: '#4AADDB' },
  Fair: { bg: '#3A2E1A', text: '#DBA84A' },
  Bad: { bg: '#3A1A1A', text: '#E05C5C' },
};

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
  }, [isVisible, selectedDate, translateY]); // Removed user?.id dependency as it's not used inside

  useEffect(() => {
    if (user?.id && isVisible) {
      fetchMonthHistory(user.id, baseDate.getFullYear(), baseDate.getMonth());
    }
  }, [user?.id, isVisible, fetchMonthHistory, baseDate]);

  // --- Animation Handlers ---
  const closeWithAnimation = useCallback(() => {
    translateY.value = withTiming(SCREEN_HEIGHT, {
      duration: 250,
      easing: Easing.in(Easing.cubic),
    });
    setTimeout(onClose, 260);
  }, [onClose, translateY]);

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

  const toSleepQuality = (grade: string): SleepQuality => {
    if (grade === 'Excellent') return 'Excellent';
    if (grade === 'Good' || grade === 'Great') return 'Good';
    if (grade === 'Fair') return 'Fair';
    return 'Bad';
  };

  const isSameDay = (d1: Date, d2: Date) =>
    d1.getDate() === d2.getDate() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getFullYear() === d2.getFullYear();

  const formatWeekRange = (startOfWeek: Date, endOfWeek: Date) => {
    const sameYear = startOfWeek.getFullYear() === endOfWeek.getFullYear();
    const formatDate = (d: Date) =>
      d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    return sameYear
      ? `${formatDate(startOfWeek)} – ${formatDate(endOfWeek)}`
      : `${formatDate(startOfWeek)}, ${startOfWeek.getFullYear()} – ${formatDate(endOfWeek)}, ${endOfWeek.getFullYear()}`;
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
            const dayScore = dayData?.sleep_score ?? dayData?.quality_score;
            const dayGrade = dayScore !== undefined ? getSleepScoreGrade(dayScore) : null;
            const dayBadgeColors = dayGrade ? QUALITY_BADGE[toSleepQuality(dayGrade.grade)] : null;
            const isFuture = isFutureDate(date);
            const hasSleepData = Boolean(dayData && !isFuture);

            return (
              <Pressable
                key={i}
                style={styles.dayCellWrapper}
                disabled={isFuture}
                onPress={() => handleDatePress(date)}>
                <View
                  style={[
                    styles.dayCellContent,
                    isSelected && styles.selectedDayIndicator,
                    !isSelected && isToday && styles.todayCell,
                    isFuture && styles.futureCell,
                  ]}>
                  <Text
                    style={[
                      styles.dayText,
                      isSelected && styles.selectedDayText,
                      !isSelected && isToday && { color: 'white', fontWeight: '600' },
                      !isSelected && !isToday && !dayData && { color: TEXT_DISABLED },
                    ]}>
                    {date.getDate()}
                  </Text>
                  {hasSleepData ? (
                    <View style={[styles.dayDataDot, { backgroundColor: dayBadgeColors?.text }]} />
                  ) : null}
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
    const badgeColors = grade ? QUALITY_BADGE[toSleepQuality(grade.grade)] : null;
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
                        ...styles.selectedDayIndicator,
                      },
                      !isSelected && isToday && styles.todayCell,
                      isFuture && styles.futureCell,
                    ]}>
                    <Text
                      style={[
                        styles.stripDayDate,
                        isSelected && styles.selectedDayText,
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
                <View
                  style={[
                    styles.gradeBadge,
                    { backgroundColor: badgeColors?.bg ?? 'rgba(255,255,255,0.1)' },
                  ]}>
                  <Text style={[styles.gradeText, { color: badgeColors?.text ?? dayColor }]}>
                    {grade?.grade}
                  </Text>
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

  const navTitle = (() => {
    if (viewMode !== 'week') {
      return baseDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }

    const startOfWeek = new Date(baseDate);
    startOfWeek.setDate(baseDate.getDate() - baseDate.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    return formatWeekRange(startOfWeek, endOfWeek);
  })();

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
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    borderWidth: 1,
    borderColor: STROKE,
    overflow: 'hidden',
    width: '100%',
  },
  innerContent: {},

  handleContainer: { alignItems: 'center', paddingTop: 10, paddingBottom: 10 },
  handle: {
    width: 40,
    height: HANDLE_HEIGHT,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: HANDLE_RADIUS,
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
    borderRadius: CLOSE_BTN_RADIUS,
    borderWidth: 1,
    borderColor: STROKE,
  },

  controlsSection: { paddingHorizontal: 20, marginBottom: 20 },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: '#0F1117',
    borderRadius: SEGMENT_RADIUS,
    padding: SEGMENT_PADDING,
    height: 48,
    borderWidth: 1,
    borderColor: STROKE,
  },
  segmentBtn: {
    flex: 1,
    borderRadius: SEGMENT_RADIUS,
    justifyContent: 'center',
    alignItems: 'center',
  },
  segmentBtnActive: {
    backgroundColor: '#2C2C2E',
    borderRadius: SEGMENT_RADIUS,
    paddingVertical: 6,
    paddingHorizontal: 20,
  },
  segmentText: { color: 'rgba(255,255,255,0.45)', fontSize: 15, fontWeight: '400' },
  segmentTextActive: { color: '#FFFFFF', fontWeight: '600' },

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
    borderRadius: CLOSE_BTN_RADIUS,
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
    width: DAY_CELL_SIZE,
    height: DAY_CELL_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: DAY_CELL_RADIUS,
    overflow: 'hidden',
  },
  futureCell: { opacity: 0.3 },
  todayCell: { backgroundColor: 'rgba(255,255,255,0.1)' },
  selectedDayIndicator: {
    width: SELECTED_DAY_SIZE,
    height: SELECTED_DAY_SIZE,
    borderRadius: SELECTED_DAY_RADIUS,
    backgroundColor: '#C0120F',
  },
  selectedDayText: { color: '#FFFFFF', fontWeight: '700' },
  dayText: { fontSize: 15, fontWeight: '500', color: TEXT_PRIMARY },
  dayDataDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 2,
  },

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
    width: STRIP_DAY_SIZE,
    height: STRIP_DAY_SIZE,
    borderRadius: STRIP_DAY_RADIUS,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stripDayDate: { fontSize: 16, fontWeight: '600', color: TEXT_PRIMARY },

  // Detail Card Styles
  detailCardContainer: { paddingHorizontal: 20 },
  detailCard: {
    backgroundColor: '#0F1117',
    borderRadius: DETAIL_CARD_RADIUS,
    padding: DETAIL_CARD_PADDING,
    borderWidth: 1,
    borderColor: STROKE,
  },
  detailCardIndicator: {
    position: 'absolute',
    top: 24,
    left: 0,
    width: INDICATOR_WIDTH,
    height: 32,
    borderTopRightRadius: INDICATOR_RADIUS,
    borderBottomRightRadius: INDICATOR_RADIUS,
  },
  dcHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  dcTitle: { fontSize: 18, fontWeight: '700', color: 'white', flex: 1 },
  gradeBadge: {
    paddingHorizontal: 10,
    paddingVertical: GRADE_BADGE_PADDING_Y,
    borderRadius: GRADE_BADGE_RADIUS,
  },
  gradeText: { fontWeight: '800', fontSize: 14 },

  dcMetricsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  dcMetric: { alignItems: 'center', gap: 4 },
  dcMetricValue: { fontSize: 24, fontWeight: '700', color: 'white' },
  dcUnit: { fontSize: 14, fontWeight: '500', color: TEXT_SECONDARY },
  dcLabel: { fontSize: 13, color: TEXT_SECONDARY, fontWeight: '500' },
  dcDivider: { width: 1, height: 40, backgroundColor: STROKE },

  wcEmpty: { color: TEXT_DISABLED, fontSize: 15, textAlign: 'center', marginTop: 10 },
});
