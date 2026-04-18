import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Dimensions,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  interpolate,
  Extrapolation,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSleepStore } from '@store/sleepStore';
import { useAuthStore } from '@store/authStore';
import { getSleepScoreGrade } from '@lib/sleepColors';
import { SLEEP_THEME, SLEEP_FONTS } from '../../constants/theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const SHEET_PADDING = 20;
const SHEET_INNER_RADIUS = 24;
const SHEET_RADIUS = SHEET_INNER_RADIUS + SHEET_PADDING;
const HANDLE_HEIGHT = 5;
const HANDLE_RADIUS = HANDLE_HEIGHT / 2;
const CLOSE_BTN_PADDING = 6;
const CLOSE_BTN_INNER_RADIUS = 6;
const CLOSE_BTN_RADIUS = CLOSE_BTN_INNER_RADIUS + CLOSE_BTN_PADDING;
const SELECTED_DAY_SIZE = 36;
const SELECTED_DAY_RADIUS = SELECTED_DAY_SIZE / 2;
const SHEET_SPRING = { damping: 32, stiffness: 200, mass: 1.2 };

interface SleepCalendarProps {
  isVisible: boolean;
  onClose: () => void;
  onDateSelect: (date: Date) => void;
  selectedDate: Date;
}

export const SleepCalendar = ({
  isVisible,
  onClose,
  onDateSelect,
  selectedDate,
}: SleepCalendarProps) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const monthlyData = useSleepStore((s) => s.monthlyData);
  const fetchMonthHistory = useSleepStore((s) => s.fetchMonthHistory);

  const [baseDate, setBaseDate] = useState(new Date(selectedDate));

  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (isVisible) {
      setBaseDate(new Date(selectedDate));
      backdropOpacity.value = withTiming(1, { duration: 420 });
      translateY.value = withSpring(0, SHEET_SPRING);
    } else {
      backdropOpacity.value = 0;
      translateY.value = SCREEN_HEIGHT;
    }
  }, [isVisible, selectedDate, backdropOpacity, translateY]);

  useEffect(() => {
    if (user?.id && isVisible) {
      fetchMonthHistory(user.id, baseDate.getFullYear(), baseDate.getMonth());
    }
  }, [user?.id, isVisible, fetchMonthHistory, baseDate]);

  const closeWithAnimation = useCallback(() => {
    backdropOpacity.value = withTiming(0, { duration: 330 });
    translateY.value = withTiming(
      SCREEN_HEIGHT,
      { duration: 375, easing: Easing.in(Easing.cubic) },
      (finished) => {
        'worklet';
        if (finished) runOnJS(onClose)();
      }
    );
  }, [backdropOpacity, onClose, translateY]);

  const sheetGesture = Gesture.Pan()
    .onUpdate((e) => {
      'worklet';
      translateY.value = Math.max(0, e.translationY);
      backdropOpacity.value = interpolate(translateY.value, [0, 300], [1, 0], Extrapolation.CLAMP);
    })
    .onEnd((e) => {
      'worklet';
      if (translateY.value > 120 || e.velocityY > 600) {
        backdropOpacity.value = withTiming(0, { duration: 330 });
        translateY.value = withTiming(
          SCREEN_HEIGHT,
          { duration: 375, easing: Easing.in(Easing.cubic) },
          (finished) => {
            'worklet';
            if (finished) runOnJS(onClose)();
          }
        );
      } else {
        translateY.value = withSpring(0, { damping: 36, stiffness: 220, mass: 0.9 });
        backdropOpacity.value = withTiming(1, { duration: 300 });
      }
    });

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  const getDayData = useCallback(
    (date: Date) => {
      const key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      const records = monthlyData[key] || [];
      const dateStr = date.toISOString().split('T')[0];
      return records.find((r) => r.date === dateStr);
    },
    [monthlyData]
  );

  const getDotColor = useCallback((score: number | undefined): string | null => {
    if (score === undefined) return null;
    const { grade } = getSleepScoreGrade(score);
    const preset = SLEEP_THEME.heroGradePresets[grade as keyof typeof SLEEP_THEME.heroGradePresets];
    return preset?.primary ?? null;
  }, []);

  const isSameDay = (d1: Date, d2: Date) =>
    d1.getDate() === d2.getDate() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getFullYear() === d2.getFullYear();

  const isFutureDate = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date > today;
  };

  const handleNavigate = useCallback((direction: 'prev' | 'next') => {
    setBaseDate((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + (direction === 'next' ? 1 : -1));
      return d;
    });
  }, []);

  const handleDatePress = useCallback(
    (date: Date) => {
      onDateSelect(date);
      closeWithAnimation();
    },
    [onDateSelect, closeWithAnimation]
  );

  const navTitle = baseDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

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
      <View style={styles.gridContainer}>
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
            const dotColor = getDotColor(dayScore);
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
                    isSelected && styles.selectedDayIndicator,
                    !isSelected && isToday && styles.todayCell,
                    isFuture && styles.futureCell,
                  ]}>
                  <Text
                    style={[
                      styles.dayText,
                      isSelected && styles.selectedDayText,
                      !isSelected && isToday && styles.todayText,
                      !isSelected && !isToday && !dayData && styles.emptyDayText,
                    ]}>
                    {date.getDate()}
                  </Text>
                  {dotColor && !isFuture ? (
                    <View style={[styles.dayDataDot, { backgroundColor: dotColor }]} />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  };

  if (!isVisible) return null;

  return (
    <Modal animationType="none" transparent visible={isVisible} onRequestClose={closeWithAnimation}>
      <GestureHandlerRootView style={StyleSheet.absoluteFill}>
        <Pressable style={styles.backdrop} onPress={closeWithAnimation}>
          <Animated.View
            renderToHardwareTextureAndroid
            shouldRasterizeIOS
            style={[StyleSheet.absoluteFill, backdropStyle]}>
            <BlurView intensity={25} style={StyleSheet.absoluteFill} tint="dark" />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} />
          </Animated.View>
        </Pressable>

        <View style={styles.gestureRoot} pointerEvents="box-none">
          <GestureDetector gesture={sheetGesture}>
            <Animated.View
              style={[styles.sheet, { paddingBottom: insets.bottom + 20 }, sheetStyle]}>
              <View style={styles.handleContainer}>
                <View style={styles.handle} />
              </View>

              <View style={styles.header}>
                <Text style={styles.title}>Sleep History</Text>
                <Pressable onPress={closeWithAnimation} style={styles.closeBtn}>
                  <Ionicons name="close" size={18} color={SLEEP_THEME.textMuted1} />
                </Pressable>
              </View>

              <View style={styles.navHeader}>
                <Pressable onPress={() => handleNavigate('prev')} style={styles.arrowBtn}>
                  <Ionicons name="chevron-back" size={20} color={SLEEP_THEME.textPrimary} />
                </Pressable>
                <Text style={styles.navTitle}>{navTitle}</Text>
                <Pressable onPress={() => handleNavigate('next')} style={styles.arrowBtn}>
                  <Ionicons name="chevron-forward" size={20} color={SLEEP_THEME.textPrimary} />
                </Pressable>
              </View>

              {renderMonthGrid()}
            </Animated.View>
          </GestureDetector>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  gestureRoot: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },

  sheet: {
    backgroundColor: SLEEP_THEME.bottomSheetBg,
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },

  handleContainer: { alignItems: 'center', paddingTop: 16, paddingBottom: 20 },
  handle: {
    width: 36,
    height: HANDLE_HEIGHT,
    backgroundColor: SLEEP_THEME.border,
    borderRadius: HANDLE_RADIUS,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SHEET_PADDING,
    marginBottom: 20,
  },
  title: {
    color: SLEEP_THEME.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    fontFamily: SLEEP_FONTS.bold,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: CLOSE_BTN_RADIUS,
    backgroundColor: SLEEP_THEME.cardBg,
    justifyContent: 'center',
    alignItems: 'center',
  },

  navHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SHEET_PADDING,
    marginBottom: 16,
  },
  navTitle: {
    color: SLEEP_THEME.textPrimary,
    fontSize: 17,
    fontWeight: '600',
    fontFamily: SLEEP_FONTS.semiBold,
  },
  arrowBtn: {
    width: 34,
    height: 34,
    borderRadius: CLOSE_BTN_RADIUS,
    backgroundColor: SLEEP_THEME.cardBg,
    justifyContent: 'center',
    alignItems: 'center',
  },

  gridContainer: { paddingHorizontal: SHEET_PADDING, paddingBottom: 12 },
  weekRow: { flexDirection: 'row', marginBottom: 8 },
  weekDayText: {
    flex: 1,
    textAlign: 'center',
    color: SLEEP_THEME.textMuted1,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: SLEEP_FONTS.semiBold,
  },
  weekendText: { color: SLEEP_THEME.danger },

  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1 },
  dayCellWrapper: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  dayCellContent: {
    width: SELECTED_DAY_SIZE,
    height: SELECTED_DAY_SIZE,
    borderRadius: SELECTED_DAY_RADIUS,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  futureCell: { opacity: 0.3 },
  todayCell: { backgroundColor: SLEEP_THEME.elevatedBg },
  selectedDayIndicator: {
    backgroundColor: SLEEP_THEME.colorBedtime,
  },
  dayText: {
    fontSize: 15,
    fontWeight: '500',
    fontFamily: SLEEP_FONTS.medium,
    color: SLEEP_THEME.textPrimary,
  },
  selectedDayText: {
    color: SLEEP_THEME.textPrimary,
    fontWeight: '700',
    fontFamily: SLEEP_FONTS.bold,
  },
  todayText: {
    color: SLEEP_THEME.textPrimary,
    fontWeight: '600',
    fontFamily: SLEEP_FONTS.semiBold,
  },
  emptyDayText: { color: SLEEP_THEME.textDisabled },
  dayDataDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 2,
  },
});
