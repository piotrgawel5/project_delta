// app/(tabs)/sleep.tsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  Pressable,
  Platform,
  RefreshControl,
  Modal,
  Alert,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import MaskedView from '@react-native-masked-view/masked-view';
import { router } from 'expo-router';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  SlideInLeft,
  SlideInRight,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  withSequence,
  withRepeat,
  runOnJS,
  Easing,
  interpolate,
  useAnimatedScrollHandler,
  Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@store/authStore';
import { useSleepStore } from '@store/sleepStore';
import Svg, {
  Circle,
  G,
  Path,
  Line,
  Rect,
  Text as SvgText,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
} from 'react-native-svg';
import {
  generateWeeklySummary,
  generateMonthlySummary,
  formatHoursShort,
} from '@lib/sleepAnalysis';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const BG_PRIMARY = '#000000';
const RECOVERY = '#6366F1'; // Indigo blue matching reference
const RECOVERY_LIGHT = '#818CF8';

// Outsiders-style gradient colors
const OUTSIDERS_GRADIENT_START = '#6B21A8'; // Deep purple
const OUTSIDERS_GRADIENT_MID = '#7C3AED'; // Violet
const OUTSIDERS_GRADIENT_END = '#A855F7'; // Light purple/magenta

const RING_COLORS = {
  move: '#FF2D55',
  exercise: '#30D158',
  stand: '#00C7BE',
};

// Outsiders-style sleep phase colors
const PHASE_COLORS = {
  deep: '#00D4FF', // Cyan
  light: '#9333EA', // Purple
  rem: '#EC4899', // Pink
  awake: '#FBBF24', // Yellow/Orange
};

// Premium accent colors
const ACCENT_PURPLE = '#7C3AED';
const ACCENT_GREEN = '#34D399';
const ACCENT_YELLOW = '#FBBF24';
const ACCENT_PINK = '#EC4899';
const ACCENT_BLUE = '#38BDF8';

const AI_HINTS = [
  {
    title: 'Optimal Bedtime Tonight',
    message: 'Based on your circadian rhythm, aim for 10:30 PM.',
  },
  { title: 'Building Consistency', message: "Maintain this week's pattern for better deep sleep." },
  { title: 'Recovery Boost', message: 'Try avoiding caffeine after 2 PM for improved REM.' },
];

type ViewMode = 'Day' | 'Week' | 'Month';

export default function SleepScreen() {
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const headerBlurStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(scrollY.value, [0, 50], [0, 1], Extrapolation.CLAMP),
    };
  });
  const {
    isConnected,
    isAvailable: isAvailableOnDevice,
    weeklyHistory,
    loading: storeLoading,
    checkHealthConnectStatus,
    requestHealthPermissions,
    fetchSleepData,
  } = useSleepStore();

  const [selectedDayIndex, setSelectedDayIndex] = useState(6);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('Day');
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [enteredFromNav, setEnteredFromNav] = useState(true);
  const [dayAnimDirection, setDayAnimDirection] = useState<'left' | 'right' | null>(null);

  // Clock picker - angles in degrees (0 = 12 o'clock, clockwise)
  const [bedtimeAngle, setBedtimeAngle] = useState(7.5); // 00:30
  const [wakeAngle, setWakeAngle] = useState(107); // 07:10

  const sheetY = useSharedValue(SCREEN_HEIGHT);
  const insightGlow = useSharedValue(0);
  const chartSwipeX = useSharedValue(0);

  // Build weekly data
  const weeklyData = useMemo(() => {
    const now = new Date();
    const result = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().split('T')[0];
      const historyItem = weeklyHistory.find((h) => h.date === dateKey);

      result.push({
        date: dateKey,
        day: d.toLocaleDateString('en-US', { weekday: 'short' }),
        fullDate: d.toLocaleDateString('en-US', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
        durationHours: historyItem ? historyItem.duration_minutes / 60 : 0,
        quality: historyItem?.quality_score || 0,
        startTime: historyItem?.start_time,
        endTime: historyItem?.end_time,
        deepMin: historyItem?.deep_sleep_minutes || 0,
        remMin: historyItem?.rem_sleep_minutes || 0,
        lightMin: historyItem?.light_sleep_minutes || 0,
        awakeMin: historyItem?.awake_minutes || 0,
      });
    }
    return result;
  }, [weeklyHistory]);

  const selectedDay = weeklyData[selectedDayIndex] || null;

  useEffect(() => {
    setEnteredFromNav(true);
    const timeout = setTimeout(() => setEnteredFromNav(false), 1500);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    insightGlow.value = withRepeat(
      withSequence(withTiming(1, { duration: 1500 }), withTiming(0.3, { duration: 1500 })),
      -1,
      true
    );
  }, []);

  useEffect(() => {
    loadSleepData();
  }, [user?.id]);

  useEffect(() => {
    sheetY.value = withTiming(showRecordModal ? 0 : SCREEN_HEIGHT, {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    });
  }, [showRecordModal]);

  const loadSleepData = async () => {
    await checkHealthConnectStatus();
    if (user?.id) await fetchSleepData(user.id);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadSleepData();
    setRefreshing(false);
  }, [user?.id]);

  const handleConnect = async () => {
    const result = await requestHealthPermissions();
    if (result.granted && user?.id) await fetchSleepData(user.id);
  };

  const stages = useMemo(() => {
    if (!selectedDay || selectedDay.durationHours <= 0) {
      return {
        deep: 0,
        light: 0,
        rem: 0,
        awake: 0,
        deepMin: 0,
        lightMin: 0,
        remMin: 0,
        awakeMin: 0,
      };
    }
    const total =
      selectedDay.deepMin + selectedDay.lightMin + selectedDay.remMin + selectedDay.awakeMin || 1;
    return {
      deep: Math.round((selectedDay.deepMin / total) * 100),
      light: Math.round((selectedDay.lightMin / total) * 100),
      rem: Math.round((selectedDay.remMin / total) * 100),
      awake: Math.round((selectedDay.awakeMin / total) * 100),
      deepMin: selectedDay.deepMin,
      lightMin: selectedDay.lightMin,
      remMin: selectedDay.remMin,
      awakeMin: selectedDay.awakeMin,
    };
  }, [selectedDay]);

  const formatTime = (date: string | undefined) => {
    if (!date) return '--:--';
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const formatDuration = (hours: number) => {
    if (hours <= 0) return '0h 0m';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  // Angle to time conversion (0° = 00:00, 360° = 24:00)
  const angleToTime = (angle: number) => {
    const normalized = ((angle % 360) + 360) % 360;
    const totalMinutes = (normalized / 360) * 24 * 60;
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = Math.round(totalMinutes % 60);
    return {
      hours,
      minutes,
      formatted: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`,
    };
  };

  const calculateDurationFromAngles = () => {
    let diff = wakeAngle - bedtimeAngle;
    if (diff <= 0) diff += 360;
    const totalHours = (diff / 360) * 24;
    return { hours: Math.floor(totalHours), mins: Math.round((totalHours % 1) * 60) };
  };

  const handleSaveSleep = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const now = new Date();
      const bedtime = angleToTime(bedtimeAngle);
      const waketime = angleToTime(wakeAngle);

      const bedDate = new Date(now);
      bedDate.setHours(bedtime.hours, bedtime.minutes, 0, 0);
      if (bedDate > now) bedDate.setDate(bedDate.getDate() - 1);

      const wakeDate = new Date(bedDate);
      wakeDate.setHours(waketime.hours, waketime.minutes, 0, 0);
      if (wakeDate <= bedDate) wakeDate.setDate(wakeDate.getDate() + 1);

      const startTime = bedDate.toISOString();
      const endTime = wakeDate.toISOString();

      // Try to write to Health Connect (non-blocking - continue even if fails)
      try {
        const { writeSleepSession } = await import('../../modules/health-connect');
        await writeSleepSession(startTime, endTime, 'Manual entry');
        console.log('[Sleep] Written to Health Connect');
      } catch (hcError) {
        console.warn('[Sleep] Health Connect write failed (continuing):', hcError);
      }

      // Force save directly to database (bypasses cooldown)
      const { forceSaveManualSleep } = useSleepStore.getState();
      const success = await forceSaveManualSleep(user.id, startTime, endTime);

      if (success) {
        setShowRecordModal(false);
        const duration = calculateDurationFromAngles();
        Alert.alert(
          'Sleep Recorded! 🌙',
          `${duration.hours}h ${duration.mins}m saved to your sleep history.`
        );
      } else {
        Alert.alert('Error', 'Failed to save sleep record. Please try again.');
      }
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Error', 'Failed to save sleep record.');
    } finally {
      setSaving(false);
    }
  };

  const navigateDay = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && selectedDayIndex > 0) {
      setDayAnimDirection('right');
      setSelectedDayIndex((i) => i - 1);
    } else if (direction === 'next' && selectedDayIndex < 6) {
      setDayAnimDirection('left');
      setSelectedDayIndex((i) => i + 1);
    }
    setTimeout(() => setDayAnimDirection(null), 400);
  };

  const chartPanGesture = Gesture.Pan()
    .onUpdate((e) => {
      chartSwipeX.value = e.translationX;
    })
    .onEnd((e) => {
      if (e.translationX < -50 && selectedDayIndex < 6) runOnJS(navigateDay)('next');
      else if (e.translationX > 50 && selectedDayIndex > 0) runOnJS(navigateDay)('prev');
      chartSwipeX.value = withSpring(0);
    });

  const chartSwipeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: chartSwipeX.value * 0.3 }],
  }));

  // Outsiders UI: Sleep Rating Logic
  const getSleepRating = (quality: number) => {
    if (quality >= 85) return { label: 'Excellent', color: '#fff' }; // White text for Excellent
    if (quality >= 70) return { label: 'Good', color: '#fff' };
    if (quality >= 50) return { label: 'Fair', color: '#fff' };
    return { label: 'Poor', color: '#fff' };
  };

  const getSleepDescription = (quality: number) => {
    if (quality >= 85)
      return 'Your sleep duration last night was above your goal, providing optimal restorative sleep for complete recovery. You barely stirred awake last night - great stuff.';
    if (quality >= 70)
      return 'You had a good night of sleep. A solid balance of deep and REM sleep to help you feel refreshed.';
    if (quality >= 50)
      return 'Your sleep was okay, but you might feel a bit groggy. Try to aim for more consistency.';
    return 'You might need some extra caffeine today. Your sleep quality was lower than usual.';
  };

  const renderSleepRating = () => {
    // Determine animation direction
    const entering =
      dayAnimDirection === 'left'
        ? SlideInRight.duration(300)
        : dayAnimDirection === 'right'
          ? SlideInLeft.duration(300)
          : enteredFromNav
            ? FadeIn.delay(200).duration(600)
            : undefined;

    const rating = getSleepRating(selectedDay?.quality || 0);
    const description = getSleepDescription(selectedDay?.quality || 0);

    return (
      <GestureDetector gesture={chartPanGesture}>
        <Animated.View entering={entering} style={[styles.ratingContainer, chartSwipeStyle]}>
          <Pressable
            onPress={() => selectedDay?.durationHours && router.push('/sleep-analysis' as any)}>
            <View style={styles.ratingHeader}>
              <View style={styles.backButtonPlaceholder} />
            </View>
            <Text style={styles.ratingTitle}>{rating.label}</Text>
            <Text style={styles.ratingDate}>{selectedDay?.fullDate || 'Today'}</Text>
            <Text style={styles.ratingDescription}>{description}</Text>
          </Pressable>
        </Animated.View>
      </GestureDetector>
    );
  };

  const renderOutsidersMetrics = () => {
    const entering = dayAnimDirection
      ? dayAnimDirection === 'left'
        ? SlideInRight.duration(250)
        : SlideInLeft.duration(250)
      : enteredFromNav
        ? FadeInDown.delay(400).duration(400)
        : undefined;

    // Calculate Restorative Sleep (Deep + REM)
    const restorativeMin = (stages.deep || 0) + (stages.rem || 0);
    const restorativeHours = Math.floor(restorativeMin / 60);
    const restorativeMinsReduced = Math.round(restorativeMin % 60);

    // Format start/end times
    const bedtime = selectedDay?.startTime ? new Date(selectedDay.startTime) : null;
    const waketime = selectedDay?.endTime ? new Date(selectedDay.endTime) : null;

    const formatTimeOnly = (date: Date | null) => {
      if (!date) return '--:--';
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    };

    const getAmPm = (date: Date | null) => {
      if (!date) return '';
      return date.getHours() >= 12 ? 'PM' : 'AM';
    };

    return (
      <Animated.View entering={entering} style={styles.metricsContainer}>
        {/* Top Row: Duration & Restorative */}
        <Animated.View entering={FadeInDown.delay(100).duration(600)} style={styles.metricsRowTop}>
          {/* Sleep Duration */}
          <View style={styles.outsiderMetricCard}>
            <View style={styles.metricLabelRow}>
              <Text style={styles.metricLabelText}>Sleep Duration</Text>
              <Ionicons name="information-circle-outline" size={14} color="rgba(255,255,255,0.4)" />
            </View>
            <Text style={styles.metricBigValue}>
              {Math.floor(selectedDay?.durationHours || 0)}
              <Text style={styles.metricSmallUnit}>h </Text>
              {Math.round(((selectedDay?.durationHours || 0) % 1) * 60)}
              <Text style={styles.metricSmallUnit}>m</Text>
            </Text>
            {/* Hardcoded check for demo - ideally compare to goal */}
            <View style={styles.metricStatusRow}>
              <Ionicons name="checkmark-circle" size={14} color={ACCENT_GREEN} />
              <Text style={styles.metricStatusText}>ABOVE NORMAL</Text>
            </View>
          </View>

          {/* Restorative Sleep */}
          <View style={styles.outsiderMetricCard}>
            <View style={styles.metricLabelRow}>
              <Text style={styles.metricLabelText}>Restorative Sleep</Text>
              <Ionicons name="information-circle-outline" size={14} color="rgba(255,255,255,0.4)" />
            </View>
            <Text style={styles.metricBigValue}>
              {restorativeHours}
              <Text style={styles.metricSmallUnit}>h </Text>
              {restorativeMinsReduced}
              <Text style={styles.metricSmallUnit}>m</Text>
            </Text>
            <View style={styles.metricStatusRow}>
              <Ionicons name="checkmark-circle" size={14} color={ACCENT_GREEN} />
              <Text style={styles.metricStatusText}>ABOVE NORMAL</Text>
            </View>
          </View>
        </Animated.View>

        {/* Bottom Row: Bedtime & Wake Up */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(600)}
          style={styles.metricsRowBottom}>
          {/* Fell Asleep */}
          <View style={styles.outsiderMetricCard}>
            <View style={styles.metricLabelRow}>
              <Text style={styles.metricLabelText}>Fell Asleep At</Text>
            </View>
            <View style={styles.timeValueRow}>
              <Text style={styles.metricTimeValue}>
                {formatTimeOnly(bedtime).replace(/ [AP]M/, '')}
              </Text>
              <Text style={styles.metricAmPm}>{getAmPm(bedtime)}</Text>
            </View>
            <View style={styles.metricStatusRow}>
              <Ionicons name="checkmark-circle" size={14} color={ACCENT_GREEN} />
              <Text style={styles.metricStatusText}>EARLIER THAN USUAL</Text>
            </View>
          </View>

          {/* Woke Up */}
          <View style={styles.outsiderMetricCard}>
            <View style={styles.metricLabelRow}>
              <Text style={styles.metricLabelText}>Woke Up At</Text>
            </View>
            <View style={styles.timeValueRow}>
              <Text style={styles.metricTimeValue}>
                {formatTimeOnly(waketime).replace(/ [AP]M/, '')}
              </Text>
              <Text style={styles.metricAmPm}>{getAmPm(waketime)}</Text>
            </View>
            <View style={styles.metricStatusRow}>
              <Ionicons name="checkmark-circle" size={14} color={ACCENT_GREEN} />
              <Text style={styles.metricStatusText}>AS USUAL</Text>
            </View>
          </View>
        </Animated.View>

        {/* Sleep Stages Timeline */}
        {/* Sleep Stages Timeline */}
        <Animated.View
          entering={FadeInDown.delay(300).duration(500)}
          style={styles.timelineContainer}>
          <View style={styles.timelineHeaderRow}>
            <Text style={styles.timelineTitle}>Sleep Stages</Text>
            <Ionicons name="information-circle-outline" size={16} color="rgba(255,255,255,0.4)" />
          </View>

          <View style={styles.timelineChart}>
            {/* Simulated timeline blocks */}
            {/* We create a visual representation using flex blocks and colors */}
            <View style={styles.timelineTrack}>
              {/* Time Grid Lines (Every hour approx) */}
              {Array.from({ length: 9 }).map((_, i) => (
                <View key={i} style={[styles.timelineGridLine, { left: `${i * 12.5}%` }]} />
              ))}

              {/* Granular Sleep Blocks (Simulated Hypnogram) */}
              {/* Awake (Beginning) */}
              <View
                style={[
                  styles.timelineBlock,
                  {
                    left: '0%',
                    width: '5%',
                    bottom: '60%',
                    height: '30%',
                    backgroundColor: PHASE_COLORS.awake,
                  },
                ]}
              />

              {/* Cycle 1 */}
              <View
                style={[
                  styles.timelineBlock,
                  {
                    left: '5%',
                    width: '15%',
                    bottom: '30%',
                    height: '30%',
                    backgroundColor: PHASE_COLORS.light,
                    shadowColor: PHASE_COLORS.light,
                  },
                ]}
              />
              <View
                style={[
                  styles.timelineBlock,
                  {
                    left: '20%',
                    width: '10%',
                    bottom: '0%',
                    height: '30%',
                    backgroundColor: PHASE_COLORS.deep,
                    shadowColor: PHASE_COLORS.deep,
                  },
                ]}
              />

              {/* Cycle 2 */}
              <View
                style={[
                  styles.timelineBlock,
                  {
                    left: '30%',
                    width: '12%',
                    bottom: '30%',
                    height: '30%',
                    backgroundColor: PHASE_COLORS.light,
                    shadowColor: PHASE_COLORS.light,
                  },
                ]}
              />
              <View
                style={[
                  styles.timelineBlock,
                  {
                    left: '42%',
                    width: '12%',
                    bottom: '0%',
                    height: '30%',
                    backgroundColor: PHASE_COLORS.deep,
                    shadowColor: PHASE_COLORS.deep,
                  },
                ]}
              />

              {/* Cycle 3 (REM start) */}
              <View
                style={[
                  styles.timelineBlock,
                  {
                    left: '54%',
                    width: '10%',
                    bottom: '30%',
                    height: '30%',
                    backgroundColor: PHASE_COLORS.light,
                    shadowColor: PHASE_COLORS.light,
                  },
                ]}
              />
              <View
                style={[
                  styles.timelineBlock,
                  {
                    left: '64%',
                    width: '10%',
                    top: '0%',
                    height: '30%',
                    backgroundColor: PHASE_COLORS.rem,
                    shadowColor: PHASE_COLORS.rem,
                  },
                ]}
              />

              {/* Cycle 4 (More REM) */}
              <View
                style={[
                  styles.timelineBlock,
                  {
                    left: '74%',
                    width: '10%',
                    bottom: '30%',
                    height: '30%',
                    backgroundColor: PHASE_COLORS.light,
                    shadowColor: PHASE_COLORS.light,
                  },
                ]}
              />
              <View
                style={[
                  styles.timelineBlock,
                  {
                    left: '84%',
                    width: '11%',
                    top: '0%',
                    height: '30%',
                    backgroundColor: PHASE_COLORS.rem,
                    shadowColor: PHASE_COLORS.rem,
                  },
                ]}
              />

              {/* Awake (End) */}
              <View
                style={[
                  styles.timelineBlock,
                  {
                    left: '95%',
                    width: '5%',
                    bottom: '60%',
                    height: '30%',
                    backgroundColor: PHASE_COLORS.awake,
                    shadowColor: PHASE_COLORS.awake,
                  },
                ]}
              />
            </View>
          </View>

          <View style={styles.timelineLabels}>
            <Text style={styles.timelineTimeLabel}>{formatTimeOnly(bedtime)}</Text>
            <Text style={styles.timelineTimeLabel}>{formatTimeOnly(waketime)}</Text>
          </View>

          {/* Detailed Sleep Stage Breakdown */}
          <View style={styles.stageStatsContainer}>
            <Text style={styles.sectionTitle}>Sleep Stages</Text>
            <View style={styles.stageStatsGrid}>
              {[
                { label: 'Deep', color: PHASE_COLORS.deep, percent: '18%', time: '1h 32m' },
                { label: 'REM', color: PHASE_COLORS.rem, percent: '24%', time: '2h 15m' },
                { label: 'Light', color: PHASE_COLORS.light, percent: '52%', time: '5h 12m' },
                { label: 'Awake', color: PHASE_COLORS.awake, percent: '6%', time: '41m' },
              ].map((stage, i) => (
                <View key={i} style={styles.stageStatCard}>
                  <View style={styles.stageStatHeader}>
                    <View
                      style={[
                        styles.stageDot,
                        { backgroundColor: stage.color, shadowColor: stage.color },
                      ]}
                    />
                    <Text style={styles.stageLabel}>{stage.label}</Text>
                  </View>
                  <Text style={styles.stageTime}>{stage.time}</Text>
                  <Text style={styles.stagePercent}>{stage.percent}</Text>
                  {/* Tiny bar */}
                  <View style={styles.stageBarBg}>
                    <View
                      style={[
                        styles.stageBarFill,
                        { backgroundColor: stage.color, width: stage.percent as any },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>
        </Animated.View>
      </Animated.View>
    );
  };

  const insightGlowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(insightGlow.value, [0, 1], [0.3, 1]),
  }));

  const renderAIInsight = () => (
    <Animated.View entering={enteredFromNav ? FadeInUp.delay(500).duration(500) : undefined}>
      <Animated.View style={[styles.insightGlowBorder, insightGlowStyle]} />
      <View style={styles.insightCard}>
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)']}
          style={styles.insightGradient}>
          <View style={styles.insightHeader}>
            <View style={styles.insightBadge}>
              <View style={[styles.insightBadgeDot, { backgroundColor: ACCENT_PURPLE }]} />
              <Text style={styles.insightBadgeText}>SLEEP INTELLIGENCE</Text>
            </View>
            <View style={styles.proBadge}>
              <Text style={styles.proBadgeText}>PRO</Text>
            </View>
          </View>
          <Text style={styles.insightTitle}>{AI_HINTS[0].title}</Text>
          <Text style={styles.insightMessage}>{AI_HINTS[0].message}</Text>
        </LinearGradient>
      </View>
    </Animated.View>
  );

  const renderWeeklyChart = () => (
    <Animated.View
      entering={enteredFromNav ? FadeInDown.delay(400).duration(600) : undefined}
      style={styles.weeklyCard}>
      <Text style={styles.cardTitle}>This Week</Text>
      <View style={styles.weeklyBars}>
        {weeklyData.map((day, idx) => {
          const height = Math.min((day.durationHours / 10) * 100, 100);
          const isSelected = idx === selectedDayIndex;
          return (
            <Pressable
              key={day.date}
              style={styles.weeklyBarCol}
              onPress={() => {
                if (idx !== selectedDayIndex) {
                  setDayAnimDirection(idx > selectedDayIndex ? 'left' : 'right');
                  setSelectedDayIndex(idx);
                  setTimeout(() => setDayAnimDirection(null), 400);
                }
              }}>
              <View style={styles.weeklyBarWrapper}>
                <LinearGradient
                  colors={
                    day.durationHours >= 7
                      ? [RING_COLORS.exercise, '#5AE17E']
                      : day.durationHours >= 5
                        ? [PHASE_COLORS.light, '#FFB347']
                        : ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.04)']
                  }
                  style={[
                    styles.weeklyBar,
                    { height: `${Math.max(height, 6)}%` },
                    isSelected && styles.weeklyBarSelected,
                  ]}
                />
              </View>
              <Text style={[styles.weeklyDayLabel, isSelected && styles.weeklyDayLabelActive]}>
                {day.day[0]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Animated.View>
  );

  // Week Summary Calculations
  const weeklySummary = useMemo(() => {
    const data = weeklyData.map((d) => ({
      date: d.date,
      durationHours: d.durationHours,
      quality: d.quality,
      deepMin: d.deepMin,
      remMin: d.remMin,
      lightMin: d.lightMin,
      awakeMin: d.awakeMin,
      startTime: d.startTime,
      endTime: d.endTime,
    }));
    return generateWeeklySummary(data);
  }, [weeklyData]);

  // Week View
  const renderWeekView = () => (
    <Animated.View entering={FadeIn.duration(400)}>
      {/* Weekly Summary Card */}
      <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.summaryCard}>
        <LinearGradient
          colors={['rgba(99,102,241,0.15)', 'transparent']}
          style={styles.summaryGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={styles.summaryHeader}>
          <View style={styles.summaryIconWrap}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path d="M3 3v18h18" stroke={ACCENT_PURPLE} strokeWidth="2" strokeLinecap="round" />
              <Path
                d="M7 16l4-4 4 4 6-6"
                stroke={ACCENT_PURPLE}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
          <View style={styles.summaryTitleWrap}>
            <Text style={styles.summaryTitle}>Weekly Summary</Text>
            <Text style={styles.summarySubtitle}>Last 7 days</Text>
          </View>
          <View style={styles.summaryTotal}>
            <Text style={styles.summaryTotalValue}>
              {formatHoursShort(weeklySummary.totalHours)}
            </Text>
            <Text style={styles.summaryTotalLabel}>Total</Text>
          </View>
        </View>

        <View style={styles.summaryDivider} />

        <View style={styles.summaryStats}>
          <View style={styles.summaryStat}>
            <Text style={styles.summaryStatValue}>{formatHoursShort(weeklySummary.avgHours)}</Text>
            <Text style={styles.summaryStatLabel}>Avg / night</Text>
          </View>
          <View style={styles.summaryStat}>
            <Text style={[styles.summaryStatValue, { color: ACCENT_GREEN }]}>
              {weeklySummary.bestDay?.day || '--'}
            </Text>
            <Text style={styles.summaryStatLabel}>Best night</Text>
          </View>
          <View style={styles.summaryStat}>
            <Text style={[styles.summaryStatValue, { color: ACCENT_PINK }]}>
              {weeklySummary.worstDay?.day || '--'}
            </Text>
            <Text style={styles.summaryStatLabel}>Shortest</Text>
          </View>
          <View style={styles.summaryStat}>
            <Text style={styles.summaryStatValue}>{weeklySummary.consistencyScore}%</Text>
            <Text style={styles.summaryStatLabel}>Consistency</Text>
          </View>
        </View>
      </Animated.View>

      {/* Weekly Bar Chart */}
      <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.weeklyCard}>
        <Text style={styles.cardTitle}>Daily Breakdown</Text>
        <View style={styles.weeklyBars}>
          {weeklyData.map((day, idx) => {
            const height = Math.min((day.durationHours / 10) * 100, 100);
            return (
              <View key={day.date} style={styles.weeklyBarCol}>
                <View style={styles.weeklyBarWrapper}>
                  <LinearGradient
                    colors={
                      day.durationHours >= 7
                        ? [ACCENT_GREEN, '#5AE17E']
                        : day.durationHours >= 5
                          ? [ACCENT_YELLOW, '#FFD93D']
                          : ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']
                    }
                    style={[styles.weeklyBar, { height: `${Math.max(height, 8)}%` }]}
                  />
                </View>
                <Text style={styles.weeklyDayLabel}>{day.day}</Text>
                <Text style={styles.weeklyHoursLabel}>
                  {day.durationHours > 0 ? `${Math.round(day.durationHours)}h` : '-'}
                </Text>
              </View>
            );
          })}
        </View>
      </Animated.View>

      {/* AI Analysis Card */}
      <Animated.View entering={FadeInDown.delay(300).duration(500)} style={styles.analysisCard}>
        <LinearGradient
          colors={['rgba(99,102,241,0.12)', 'transparent']}
          style={styles.analysisGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={styles.analysisHeader}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path
              d="M9.663 17h4.674M10 21h4M12 2a7 7 0 00-4 12.7V17a1 1 0 001 1h6a1 1 0 001-1v-2.3A7 7 0 0012 2z"
              stroke={ACCENT_YELLOW}
              strokeWidth="2"
              strokeLinecap="round"
            />
          </Svg>
          <Text style={styles.analysisTitle}>Weekly Analysis</Text>
          <View style={styles.aiBadge}>
            <Text style={styles.aiBadgeText}>AI</Text>
          </View>
        </View>
        <Text style={styles.analysisMainInsight}>{weeklySummary.mainInsight}</Text>
        <View style={styles.analysisInsights}>
          {weeklySummary.insights.slice(0, 2).map((insight, i) => (
            <View key={i} style={styles.analysisInsightRow}>
              <View
                style={[
                  styles.analysisInsightDot,
                  { backgroundColor: i === 0 ? ACCENT_PURPLE : ACCENT_BLUE },
                ]}
              />
              <Text style={styles.analysisInsightText}>{insight}</Text>
            </View>
          ))}
        </View>
      </Animated.View>
    </Animated.View>
  );

  // Month View (placeholder - would need more data)
  const monthlySummary = useMemo(() => {
    // For now, use weekly data * 4 as mock
    const data = weeklyData.map((d) => ({
      date: d.date,
      durationHours: d.durationHours,
      quality: d.quality,
      deepMin: d.deepMin,
      remMin: d.remMin,
      lightMin: d.lightMin,
      awakeMin: d.awakeMin,
    }));
    return generateMonthlySummary(data);
  }, [weeklyData]);

  const renderMonthView = () => (
    <Animated.View entering={FadeIn.duration(400)}>
      {/* Monthly Summary Card */}
      <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.summaryCard}>
        <LinearGradient
          colors={['rgba(52,211,153,0.12)', 'transparent']}
          style={styles.summaryGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={styles.summaryHeader}>
          <View style={[styles.summaryIconWrap, { backgroundColor: 'rgba(52,211,153,0.15)' }]}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path
                d="M8 2v3M16 2v3M3 9h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z"
                stroke={ACCENT_GREEN}
                strokeWidth="2"
                strokeLinecap="round"
              />
            </Svg>
          </View>
          <View style={styles.summaryTitleWrap}>
            <Text style={styles.summaryTitle}>Monthly Overview</Text>
            <Text style={styles.summarySubtitle}>{monthlySummary.daysTracked} days tracked</Text>
          </View>
          <View style={styles.summaryTotal}>
            <Text style={styles.summaryTotalValue}>~{monthlySummary.totalHours}h</Text>
            <Text style={styles.summaryTotalLabel}>Total</Text>
          </View>
        </View>

        <View style={styles.summaryDivider} />

        <View style={styles.summaryStats}>
          <View style={styles.summaryStat}>
            <Text style={styles.summaryStatValue}>{formatHoursShort(monthlySummary.avgHours)}</Text>
            <Text style={styles.summaryStatLabel}>Avg / night</Text>
          </View>
          <View style={styles.summaryStat}>
            <Text style={styles.summaryStatValue}>{monthlySummary.avgQuality}%</Text>
            <Text style={styles.summaryStatLabel}>Avg quality</Text>
          </View>
          <View style={styles.summaryStat}>
            <Text style={[styles.summaryStatValue, { color: ACCENT_GREEN }]}>
              {monthlySummary.daysWithGoodSleep}
            </Text>
            <Text style={styles.summaryStatLabel}>7+ hr days</Text>
          </View>
          <View style={styles.summaryStat}>
            <Text style={styles.summaryStatValue}>{monthlySummary.consistencyScore}%</Text>
            <Text style={styles.summaryStatLabel}>Consistency</Text>
          </View>
        </View>
      </Animated.View>

      {/* Sleep Metrics Card */}
      <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <LinearGradient
            colors={[`${ACCENT_BLUE}15`, 'transparent']}
            style={styles.metricGradient}
          />
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path
              d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z"
              stroke={ACCENT_BLUE}
              strokeWidth="2"
            />
          </Svg>
          <Text style={styles.metricValue}>{monthlySummary.avgDeepPercent}%</Text>
          <Text style={styles.metricLabel}>Avg Deep</Text>
        </View>
        <View style={styles.metricCard}>
          <LinearGradient
            colors={[`${ACCENT_PURPLE}15`, 'transparent']}
            style={styles.metricGradient}
          />
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path
              d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"
              stroke={ACCENT_PURPLE}
              strokeWidth="2"
            />
            <Circle cx="12" cy="12" r="3" stroke={ACCENT_PURPLE} strokeWidth="2" />
          </Svg>
          <Text style={styles.metricValue}>{monthlySummary.avgRemPercent}%</Text>
          <Text style={styles.metricLabel}>Avg REM</Text>
        </View>
      </Animated.View>

      {/* AI Analysis Card */}
      <Animated.View entering={FadeInDown.delay(300).duration(500)} style={styles.analysisCard}>
        <LinearGradient
          colors={['rgba(52,211,153,0.1)', 'transparent']}
          style={styles.analysisGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={styles.analysisHeader}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path
              d="M9.663 17h4.674M10 21h4M12 2a7 7 0 00-4 12.7V17a1 1 0 001 1h6a1 1 0 001-1v-2.3A7 7 0 0012 2z"
              stroke={ACCENT_GREEN}
              strokeWidth="2"
              strokeLinecap="round"
            />
          </Svg>
          <Text style={styles.analysisTitle}>Monthly Analysis</Text>
          <View style={[styles.aiBadge, { backgroundColor: ACCENT_GREEN }]}>
            <Text style={styles.aiBadgeText}>AI</Text>
          </View>
        </View>
        <Text style={styles.analysisMainInsight}>{monthlySummary.mainInsight}</Text>
        <View style={styles.analysisInsights}>
          {monthlySummary.insights.slice(0, 2).map((insight, i) => (
            <View key={i} style={styles.analysisInsightRow}>
              <View
                style={[
                  styles.analysisInsightDot,
                  { backgroundColor: i === 0 ? ACCENT_GREEN : ACCENT_YELLOW },
                ]}
              />
              <Text style={styles.analysisInsightText}>{insight}</Text>
            </View>
          ))}
        </View>
      </Animated.View>
    </Animated.View>
  );

  const renderViewToggle = () => (
    <Animated.View
      entering={enteredFromNav ? FadeIn.delay(100).duration(300) : undefined}
      style={styles.viewToggle}>
      {(['Day', 'Week', 'Month'] as ViewMode[]).map((mode) => (
        <Pressable
          key={mode}
          style={[styles.viewToggleBtn, viewMode === mode && styles.viewToggleBtnActive]}
          onPress={() => setViewMode(mode)}>
          <Text style={[styles.viewToggleText, viewMode === mode && styles.viewToggleTextActive]}>
            {mode}
          </Text>
        </Pressable>
      ))}
    </Animated.View>
  );

  const renderDateNav = () => (
    <View style={styles.dateNav}>
      <Pressable style={styles.dateArrow} onPress={() => navigateDay('prev')}>
        <Text style={styles.dateArrowText}>‹</Text>
      </Pressable>
      <View style={styles.dateCenter}>
        <Text style={styles.dateText}>{selectedDay?.fullDate || '--'}</Text>
        {selectedDay?.startTime && (
          <Text style={styles.dateSubtext}>
            {formatTime(selectedDay.startTime)} – {formatTime(selectedDay.endTime)}
          </Text>
        )}
      </View>
      <Pressable style={styles.dateArrow} onPress={() => navigateDay('next')}>
        <Text style={styles.dateArrowText}>›</Text>
      </Pressable>
    </View>
  );

  // Premium Clock Picker - Matching Reference Image
  const renderClockPicker = () => {
    const recDuration = calculateDurationFromAngles();
    const bedtime = angleToTime(bedtimeAngle);
    const waketime = angleToTime(wakeAngle);
    const size = SCREEN_WIDTH - 80;
    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 35;
    const outerRadius = size / 2 - 8;

    // Calculate handle positions
    const bedRad = ((bedtimeAngle - 90) * Math.PI) / 180;
    const wakeRad = ((wakeAngle - 90) * Math.PI) / 180;
    const bedX = cx + radius * Math.cos(bedRad);
    const bedY = cy + radius * Math.sin(bedRad);
    const wakeX = cx + radius * Math.cos(wakeRad);
    const wakeY = cy + radius * Math.sin(wakeRad);

    // Arc calculation
    let arcAngle = wakeAngle - bedtimeAngle;
    if (arcAngle < 0) arcAngle += 360;
    const largeArc = arcAngle > 180 ? 1 : 0;

    const createPanResponder = (setAngle: (a: number) => void) =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderMove: (_, g) => {
          const dx = g.moveX - 40 - cx;
          const dy = g.moveY - 200 - cy;
          let angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
          if (angle < 0) angle += 360;
          setAngle(Math.round(angle / 7.5) * 7.5);
        },
        onPanResponderTerminationRequest: () => false,
      });

    const bedPan = useRef(createPanResponder(setBedtimeAngle)).current;
    const wakePan = useRef(createPanResponder(setWakeAngle)).current;

    const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: sheetY.value }] }));
    const sheetGesture = Gesture.Pan()
      .onUpdate((e) => {
        if (e.translationY > 0) sheetY.value = e.translationY;
      })
      .onEnd((e) => {
        if (e.translationY > 100 || e.velocityY > 500) {
          sheetY.value = withTiming(SCREEN_HEIGHT, { duration: 200 });
          runOnJS(setShowRecordModal)(false);
        } else sheetY.value = withTiming(0, { duration: 200 });
      });

    return (
      <Modal visible={showRecordModal} transparent statusBarTranslucent animationType="none">
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackground} onPress={() => setShowRecordModal(false)} />
          <GestureDetector gesture={sheetGesture}>
            <Animated.View style={[styles.clockModal, sheetStyle]}>
              <View style={styles.modalHandle} />
              <Text style={styles.clockModalTitle}>Yesterday</Text>

              <View style={styles.clockFaceContainer}>
                <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                  {/* Outer dark ring */}
                  <Circle cx={cx} cy={cy} r={outerRadius} fill="rgba(40,40,50,0.9)" />
                  {/* Inner dark circle */}
                  <Circle cx={cx} cy={cy} r={radius - 15} fill="rgba(25,25,35,0.95)" />

                  {/* Hour ticks - minimalistic */}
                  {[0, 6, 12, 18].map((h) => {
                    const angle = ((h * 15 - 90) * Math.PI) / 180;
                    const r = radius - 15; // Move ticks inside
                    return (
                      <Circle
                        key={h}
                        cx={cx + r * Math.cos(angle)}
                        cy={cy + r * Math.sin(angle)}
                        r={2}
                        fill="rgba(255,255,255,0.3)"
                      />
                    );
                  })}

                  {/* Sleep arc - Thicker & Neon */}
                  {/* Glow effect (optional, simplified with double path) */}
                  <Path
                    d={`M ${bedX} ${bedY} A ${radius} ${radius} 0 ${largeArc} 1 ${wakeX} ${wakeY}`}
                    stroke={RECOVERY}
                    strokeWidth="38" // Thicker stroke
                    strokeLinecap="round"
                    fill="transparent"
                    opacity={0.3} // Glow/Blur simulation layer
                  />
                  <Path
                    d={`M ${bedX} ${bedY} A ${radius} ${radius} 0 ${largeArc} 1 ${wakeX} ${wakeY}`}
                    stroke={RECOVERY}
                    strokeWidth="32" // Main stroke
                    strokeLinecap="round"
                    fill="transparent"
                    opacity={1}
                  />
                </Svg>

                {/* Center time display */}
                <View style={styles.clockCenterDisplay}>
                  <Text style={styles.clockCenterLabel}>SCHEDULE</Text>
                  <View style={styles.clockTimeRow}>
                    <Text style={styles.clockCenterTimeBig}>
                      {bedtime.formatted.replace(' AM', '').replace(' PM', '')}
                    </Text>
                    <Text style={styles.clockCenterTimeSmall}>{bedtime.formatted.slice(-2)}</Text>
                    <Text style={styles.clockCenterDash}>-</Text>
                    <Text style={styles.clockCenterTimeBig}>
                      {waketime.formatted.replace(' AM', '').replace(' PM', '')}
                    </Text>
                    <Text style={styles.clockCenterTimeSmall}>{waketime.formatted.slice(-2)}</Text>
                  </View>
                  <Text style={styles.clockDurationText}>
                    {recDuration.hours}h {recDuration.mins}m
                  </Text>
                </View>

                {/* Bedtime handle - Big & Glowy */}
                <View
                  {...bedPan.panHandlers}
                  style={[
                    styles.clockHandle,
                    {
                      left: bedX + 40 - 24,
                      top: bedY - 24,
                      backgroundColor: '#fff',
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      shadowColor: RECOVERY,
                      shadowOpacity: 0.8,
                      shadowRadius: 10,
                      elevation: 5,
                    },
                  ]}>
                  <Ionicons name="moon" size={24} color={RECOVERY} />
                </View>

                {/* Waketime handle - Big & Glowy */}
                <View
                  {...wakePan.panHandlers}
                  style={[
                    styles.clockHandle,
                    {
                      left: wakeX + 40 - 24,
                      top: wakeY - 24,
                      backgroundColor: '#fff',
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      shadowColor: RECOVERY,
                      shadowOpacity: 0.8,
                      shadowRadius: 10,
                      elevation: 5,
                    },
                  ]}>
                  <Ionicons name="sunny" size={24} color={ACCENT_YELLOW} />
                </View>
              </View>

              <Text style={styles.sleepDurationLabel}>
                Sleep time: {recDuration.hours} hours {recDuration.mins} minutes
              </Text>
              <Pressable style={styles.deleteRecordBtn}>
                <Text style={styles.deleteRecordText}>Delete sleep record</Text>
              </Pressable>

              <View style={styles.modalActions}>
                <Pressable style={styles.modalCancelBtn} onPress={() => setShowRecordModal(false)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.modalSaveBtn} onPress={handleSaveSleep} disabled={saving}>
                  <Text style={styles.modalSaveText}>{saving ? 'Saving...' : 'Save'}</Text>
                </Pressable>
              </View>
            </Animated.View>
          </GestureDetector>
        </View>
      </Modal>
    );
  };

  const renderEmptyState = () => (
    <Animated.View entering={FadeIn.duration(400)} style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>
        {Platform.OS !== 'android'
          ? 'Apple Health Coming Soon'
          : !isAvailableOnDevice
            ? 'Health Connect Required'
            : !isConnected
              ? 'Connect Health Data'
              : 'No Sleep Data'}
      </Text>
      <Text style={styles.emptyText}>
        {Platform.OS !== 'android'
          ? 'HealthKit integration is in development.'
          : !isAvailableOnDevice
            ? 'Install Health Connect to track sleep.'
            : !isConnected
              ? 'Sync your data for analysis.'
              : 'Track tonight or record manually.'}
      </Text>
      {Platform.OS === 'android' && !isConnected && isAvailableOnDevice && (
        <Pressable style={styles.connectBtn} onPress={handleConnect}>
          <Text style={styles.connectBtnText}>Connect</Text>
        </Pressable>
      )}
    </Animated.View>
  );

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.container}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: BG_PRIMARY }]} />

        {/* OLED Edge Gradients */}
        {/* Outsiders Full Gradient Background */}
        <LinearGradient
          colors={[OUTSIDERS_GRADIENT_START, OUTSIDERS_GRADIENT_MID, 'rgba(0,0,0,0.8)']}
          style={styles.fullGradient}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />

        <Animated.View
          style={[
            styles.stickyHeader,
            { height: 120, paddingTop: 0 }, // Extended height for gradient fade
            headerBlurStyle,
          ]}>
          <MaskedView
            style={StyleSheet.absoluteFill}
            maskElement={
              <LinearGradient
                colors={['black', 'black', 'black', 'transparent']}
                locations={[0, 0.4, 0.7, 1]}
                style={StyleSheet.absoluteFill}
              />
            }>
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          </MaskedView>
        </Animated.View>

        <Animated.ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 60 }]}
          showsVerticalScrollIndicator={false}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#fff"
              colors={[RECOVERY]}
            />
          }>
          <Animated.View
            entering={enteredFromNav ? FadeIn.duration(300) : undefined}
            style={styles.header}>
            <View style={styles.headerContent}>
              <Pressable style={styles.addBtn} onPress={() => router.back()}>
                <Ionicons name="chevron-back" size={24} color="#fff" />
              </Pressable>
              {/* Title is now part of the Rating component */}
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Pressable style={styles.addBtn}>
                  <Ionicons name="calendar-outline" size={20} color="#fff" />
                </Pressable>
                <Pressable
                  style={styles.addBtn}
                  onPress={() => {
                    // "Edit" or "Options" action - here we use it as "Log/Edit Sleep" entry point
                    setShowRecordModal(true);
                  }}>
                  <Ionicons name="options-outline" size={20} color="#fff" />
                </Pressable>
              </View>
            </View>
          </Animated.View>

          {/* View Toggle - Hidden for Outsiders Day view to match reference clean look, but can be brought back or styled differently */}
          {/* {renderViewToggle()} */}

          {/* Date Nav - Replaced by Rating Date */}
          {/* {viewMode === 'Day' && renderDateNav()} */}

          {storeLoading ? (
            <Animated.View entering={FadeIn} style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading...</Text>
            </Animated.View>
          ) : !isConnected ? (
            <>{renderEmptyState()}</>
          ) : viewMode === 'Day' ? (
            !selectedDay?.durationHours ? (
              <>{renderEmptyState()}</>
            ) : (
              <>
                {renderSleepRating()}
                {renderOutsidersMetrics()}
                {/* {renderAIInsight()} - Maybe keep or remove based on new design cleanliness */}
                {/* {renderWeeklyChart()} - Removed as timeline is now part of metrics */}
              </>
            )
          ) : viewMode === 'Week' ? (
            renderWeekView()
          ) : (
            renderMonthView()
          )}
        </Animated.ScrollView>

        {renderClockPicker()}
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG_PRIMARY },
  scrollView: { flex: 1 },
  scrollContent: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 120 },
  header: {
    paddingTop: 10,
    marginBottom: 10,
    paddingHorizontal: 0, // Reset horizontal padding for full gradient
  },
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  stickyHeaderContent: {
    paddingBottom: 10,
  },
  stickyHeaderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    fontFamily: 'Inter-SemiBold',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20, // Push down below back button
    paddingHorizontal: 20,
    zIndex: 10,
  },
  headerIcons: {
    flexDirection: 'row',
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // New Outsiders Styles
  fullGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 400, // Large gradient background
  },
  ratingContainer: {
    paddingHorizontal: 0,
    marginBottom: 30,
    marginTop: 10,
  },
  ratingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  backButtonPlaceholder: { width: 40 },
  ratingTitle: {
    fontSize: 48,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -1,
    fontFamily: 'Poppins-Bold',
    marginBottom: 4,
  },
  ratingDate: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 16,
    fontFamily: 'Inter-Medium',
  },
  ratingDescription: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 24,
  },
  metricsContainer: {
    gap: 24,
    marginBottom: 40,
  },
  metricsRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  metricsRowBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  outsiderMetricCard: {
    flex: 1,
  },
  metricLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  metricLabelText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
  },
  metricBigValue: {
    fontSize: 38,
    fontWeight: '800', // Bolder
    color: '#fff',
    fontFamily: 'Inter-Black', // Use heaviest font
    marginBottom: 4,
  },
  metricSmallUnit: {
    fontSize: 20,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
  },
  metricStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 0.5,
  },
  timeValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: 4,
  },
  metricTimeValue: {
    fontSize: 28,
    fontWeight: '600',
    color: '#fff',
  },
  metricAmPm: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '600',
  },
  timelineContainer: {
    marginTop: 10,
    marginBottom: 20,
  },
  timelineHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
    paddingHorizontal: 0,
  },
  timelineTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Inter-SemiBold',
  },
  timelineChart: {
    height: 180, // Taller chart
    marginTop: 10,
    marginBottom: 6,
  },
  timelineTrack: {
    flex: 1,
    backgroundColor: 'transparent',
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  timelineGridLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderStyle: 'dashed',
  },
  timelineBlock: {
    position: 'absolute',
    borderRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 8,
  },
  timelineLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timelineTimeLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
  },
  title: { fontSize: 28, fontWeight: '700', color: '#fff', fontFamily: 'Poppins-Bold' },
  addBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtnText: { fontSize: 26, color: '#fff', fontWeight: '300', marginTop: -2 },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  viewToggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  viewToggleBtnActive: { backgroundColor: RECOVERY },
  viewToggleText: { fontSize: 14, color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter-Medium' },
  viewToggleTextActive: { color: '#fff', fontWeight: '600' },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  dateArrow: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  dateArrowText: { fontSize: 30, color: 'rgba(255,255,255,0.4)', fontWeight: '300' },
  dateCenter: { alignItems: 'center' },
  dateText: { fontSize: 17, fontWeight: '600', color: '#fff' },
  dateSubtext: { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  loadingContainer: { alignItems: 'center', paddingTop: 60 },
  loadingText: { fontSize: 14, color: 'rgba(255,255,255,0.4)' },
  emptyContainer: { alignItems: 'center', paddingVertical: 50 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: '#fff', marginBottom: 8 },
  emptyText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  connectBtn: {
    backgroundColor: RECOVERY,
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 14,
  },
  connectBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  ringsContainer: { alignItems: 'center', marginBottom: 16 },
  legendContainer: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendLabel: { fontSize: 11, color: 'rgba(255,255,255,0.5)' },
  legendValue: { fontSize: 14, fontWeight: '600', color: '#fff' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  statCard: {
    width: '47%',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 },
  statValue: { fontSize: 16, fontWeight: '600', color: '#fff' },
  insightGlowBorder: {
    position: 'absolute',
    left: -2,
    right: -2,
    top: -2,
    bottom: -2,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: RECOVERY,
  },
  insightCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  insightGradient: { padding: 18 },
  insightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  insightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(99, 102, 241, 0.5)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  insightBadgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFD60A' },
  insightBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },
  proBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.3)',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  proBadgeText: {
    color: RECOVERY_LIGHT,
    fontSize: 10,
    fontWeight: '700',
  },
  insightPro: {
    fontSize: 10,
    fontWeight: '700',
    color: RECOVERY_LIGHT,
    backgroundColor: 'rgba(99, 102, 241, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  insightTitle: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 6 },
  insightMessage: { fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 19 },
  weeklyCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 16 },
  weeklyBars: { flexDirection: 'row', justifyContent: 'space-between', height: 110 },
  weeklyBarCol: { flex: 1, alignItems: 'center' },
  weeklyBarWrapper: { flex: 1, width: 20, justifyContent: 'flex-end', marginBottom: 8 },
  weeklyBar: { width: '100%', borderRadius: 4 },
  weeklyBarSelected: { borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)' },
  weeklyDayLabel: { fontSize: 11, color: 'rgba(255,255,255,0.4)' },
  weeklyDayLabelActive: { color: '#fff', fontWeight: '600' },
  recordBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 8 },
  recordBtnGradient: { paddingVertical: 16, alignItems: 'center' },
  recordBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  modalOverlay: { flex: 1, backgroundColor: 'transparent', justifyContent: 'flex-end' },
  modalBackground: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.8)' },
  clockModal: {
    backgroundColor: '#0A0A12',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  clockModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 24,
  },
  clockFaceContainer: { alignItems: 'center', marginBottom: 20 },
  clockCenterDisplay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -60,
    marginTop: -45,
    width: 120,
    alignItems: 'center',
    gap: 12,
  },
  clockTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  clockCenterTime: { fontSize: 28, fontWeight: '700', color: '#fff', fontFamily: 'Poppins-Bold' },
  clockHandle: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  sleepDurationLabel: {
    fontSize: 15,
    color: RECOVERY,
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '500',
  },
  deleteRecordBtn: { alignItems: 'center', marginBottom: 30 },
  deleteRecordText: { fontSize: 15, color: '#FF453A', fontWeight: '500' },
  modalActions: { flexDirection: 'row', gap: 16 },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
  },
  modalCancelText: { fontSize: 17, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  modalSaveBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: RECOVERY,
    alignItems: 'center',
  },
  modalSaveText: { fontSize: 17, color: '#fff', fontWeight: '600' },

  // OLED Gradients
  gradientTopLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    opacity: 0.4,
  },
  gradientBottomRight: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    opacity: 0.3,
  },

  // Summary Card (Week/Month)
  summaryCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    position: 'relative',
  },
  summaryGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    borderRadius: 24,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(99,102,241,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  summaryTitleWrap: { flex: 1 },
  summaryTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  summarySubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  summaryTotal: { alignItems: 'flex-end' },
  summaryTotalValue: { fontSize: 22, fontWeight: '700', color: '#fff' },
  summaryTotalLabel: { fontSize: 11, color: 'rgba(255,255,255,0.5)' },
  summaryDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: 16,
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryStat: { alignItems: 'center', flex: 1 },
  summaryStatValue: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 4 },
  summaryStatLabel: { fontSize: 10, color: 'rgba(255,255,255,0.5)', textAlign: 'center' },

  // Weekly Hours Label
  weeklyHoursLabel: { fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 },

  // Analysis Card
  analysisCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    position: 'relative',
  },
  analysisGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
    borderRadius: 24,
  },
  analysisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 10,
  },
  analysisTitle: { fontSize: 16, fontWeight: '600', color: '#fff', flex: 1 },
  aiBadge: {
    backgroundColor: ACCENT_PURPLE,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  aiBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  analysisMainInsight: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    lineHeight: 22,
    marginBottom: 14,
  },
  analysisInsights: { gap: 12 },
  analysisInsightRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  analysisInsightDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  analysisInsightText: { fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 20, flex: 1 },

  // Metrics Row (Month View)
  metricsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  metricCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 20,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    position: 'relative',
  },
  metricGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
  },
  metricValue: { fontSize: 28, fontWeight: '700', color: '#fff', marginTop: 10, marginBottom: 4 },
  metricLabel: { fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  clockCenterLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1,
    marginBottom: 4,
  },
  clockCenterTimeBig: { fontSize: 24, fontWeight: '700', color: '#fff' },
  clockCenterTimeSmall: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginLeft: 2,
    marginBottom: 4,
  },
  clockCenterDash: { fontSize: 20, color: 'rgba(255,255,255,0.4)', marginHorizontal: 8 },
  clockDurationText: { fontSize: 16, color: RECOVERY, fontWeight: '600', marginTop: 4 },

  // Stage Stats Styles
  stageStatsContainer: {
    marginTop: 24,
    width: '100%',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
    fontFamily: 'Inter-SemiBold',
  },
  stageStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  stageStatCard: {
    width: '48%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  stageStatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  stageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  stageLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Inter-Medium',
  },
  stageTime: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Inter-SemiBold',
    marginBottom: 2,
  },
  stagePercent: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 8,
  },
  stageBarBg: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
  },
  stageBarFill: {
    height: '100%',
    borderRadius: 2,
  },

  // Timeline Glow Logic embedded in style
});
