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
import { LinearGradient } from 'expo-linear-gradient';
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
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
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

const RING_COLORS = {
  move: '#FF2D55',
  exercise: '#30D158',
  stand: '#00C7BE',
};

const PHASE_COLORS = {
  deep: '#5856D6',
  light: '#FF9500',
  rem: '#FF2D55',
  awake: '#FFD60A',
};

// Premium accent colors
const ACCENT_PURPLE = '#6366F1';
const ACCENT_GREEN = '#34D399';
const ACCENT_YELLOW = '#FBBF24';
const ACCENT_PINK = '#F472B6';
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
      const { writeSleepSession } = await import('../../modules/health-connect');
      const now = new Date();
      const bedtime = angleToTime(bedtimeAngle);
      const waketime = angleToTime(wakeAngle);

      const bedDate = new Date(now);
      bedDate.setHours(bedtime.hours, bedtime.minutes, 0, 0);
      if (bedDate > now) bedDate.setDate(bedDate.getDate() - 1);

      const wakeDate = new Date(bedDate);
      wakeDate.setHours(waketime.hours, waketime.minutes, 0, 0);
      if (wakeDate <= bedDate) wakeDate.setDate(wakeDate.getDate() + 1);

      await writeSleepSession(bedDate.toISOString(), wakeDate.toISOString(), 'Manual entry');
      await fetchSleepData(user.id);
      setShowRecordModal(false);
      Alert.alert('Success', 'Sleep session saved!');
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Error', 'Failed to save. Please rebuild the app after native code changes.');
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

  // Fitness Rings
  const renderFitnessRings = () => {
    const size = SCREEN_WIDTH - 40;
    const cx = size / 2;
    const cy = size / 2;
    const strokeWidth = 20;

    const rings = [
      {
        key: 'duration',
        color: RING_COLORS.move,
        percentage: Math.min(((selectedDay?.durationHours || 0) / 8) * 100, 100),
        radius: 135,
      },
      {
        key: 'quality',
        color: RING_COLORS.exercise,
        percentage: selectedDay?.quality || 0,
        radius: 110,
      },
      {
        key: 'recovery',
        color: RING_COLORS.stand,
        percentage: stages.deep + stages.rem,
        radius: 85,
      },
    ];

    const entering =
      dayAnimDirection === 'left'
        ? SlideInRight.duration(300)
        : dayAnimDirection === 'right'
          ? SlideInLeft.duration(300)
          : enteredFromNav
            ? FadeIn.delay(200).duration(600)
            : undefined;

    return (
      <GestureDetector gesture={chartPanGesture}>
        <Animated.View entering={entering} style={[styles.ringsContainer, chartSwipeStyle]}>
          <Pressable
            onPress={() => selectedDay?.durationHours && router.push('/sleep-analysis' as any)}>
            <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
              <Defs>
                <SvgLinearGradient id="moveGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#FF2D55" />
                  <Stop offset="100%" stopColor="#FF6B8A" />
                </SvgLinearGradient>
                <SvgLinearGradient id="exerciseGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#30D158" />
                  <Stop offset="100%" stopColor="#5AE17E" />
                </SvgLinearGradient>
                <SvgLinearGradient id="standGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#00C7BE" />
                  <Stop offset="100%" stopColor="#4DD8D2" />
                </SvgLinearGradient>
              </Defs>

              {rings.map((ring, idx) => {
                const circ = 2 * Math.PI * ring.radius;
                const dash = `${(ring.percentage / 100) * circ} ${circ}`;
                const gradId = idx === 0 ? 'moveGrad' : idx === 1 ? 'exerciseGrad' : 'standGrad';
                return (
                  <G key={ring.key}>
                    <Circle
                      cx={cx}
                      cy={cy}
                      r={ring.radius}
                      stroke="rgba(255,255,255,0.04)"
                      strokeWidth={strokeWidth}
                      fill="transparent"
                    />
                    <Circle
                      cx={cx}
                      cy={cy}
                      r={ring.radius}
                      stroke={`url(#${gradId})`}
                      strokeWidth={strokeWidth}
                      fill="transparent"
                      strokeDasharray={dash}
                      strokeLinecap="round"
                      transform={`rotate(-90 ${cx} ${cy})`}
                    />
                  </G>
                );
              })}

              <SvgText
                x={cx}
                y={cy - 12}
                fill="#fff"
                fontSize="40"
                fontWeight="700"
                textAnchor="middle">
                {formatDuration(selectedDay?.durationHours || 0).split(' ')[0]}
              </SvgText>
              <SvgText
                x={cx}
                y={cy + 18}
                fill="rgba(255,255,255,0.5)"
                fontSize="14"
                textAnchor="middle">
                Sleep Duration
              </SvgText>
            </Svg>
          </Pressable>
        </Animated.View>
      </GestureDetector>
    );
  };

  const renderRingLegend = () => (
    <Animated.View
      entering={enteredFromNav ? FadeInDown.delay(300).duration(400) : undefined}
      style={styles.legendContainer}>
      {[
        {
          color: RING_COLORS.move,
          label: 'Duration',
          value: formatDuration(selectedDay?.durationHours || 0),
        },
        { color: RING_COLORS.exercise, label: 'Quality', value: `${selectedDay?.quality || 0}%` },
        { color: RING_COLORS.stand, label: 'Recovery', value: `${stages.deep + stages.rem}%` },
      ].map((item) => (
        <View key={item.label} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: item.color }]} />
          <View>
            <Text style={styles.legendLabel}>{item.label}</Text>
            <Text style={styles.legendValue}>{item.value}</Text>
          </View>
        </View>
      ))}
    </Animated.View>
  );

  const renderStats = () => {
    const entering = dayAnimDirection
      ? dayAnimDirection === 'left'
        ? SlideInRight.duration(250)
        : SlideInLeft.duration(250)
      : enteredFromNav
        ? FadeInDown.delay(400).duration(400)
        : undefined;
    return (
      <Animated.View entering={entering} style={styles.statsGrid}>
        {[
          { label: 'Total time', value: formatDuration(selectedDay?.durationHours || 0) },
          { label: 'Bedtime', value: formatTime(selectedDay?.startTime) },
          { label: 'Quality', value: `${selectedDay?.quality || 0}%` },
          { label: 'Wake up', value: formatTime(selectedDay?.endTime) },
        ].map((stat) => (
          <View key={stat.label} style={styles.statCard}>
            <Text style={styles.statLabel}>{stat.label}</Text>
            <Text style={styles.statValue}>{stat.value}</Text>
          </View>
        ))}
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
          colors={['rgba(99, 102, 241, 0.3)', 'rgba(99, 102, 241, 0.08)']}
          style={styles.insightGradient}>
          <View style={styles.insightHeader}>
            <View style={styles.insightBadge}>
              <View style={styles.insightBadgeDot} />
              <Text style={styles.insightBadgeText}>AI INSIGHT</Text>
            </View>
            <Text style={styles.insightPro}>PRO</Text>
          </View>
          <Text style={styles.insightTitle}>{AI_HINTS[0].title}</Text>
          <Text style={styles.insightMessage}>{AI_HINTS[0].message}</Text>
        </LinearGradient>
      </View>
    </Animated.View>
  );

  const renderWeeklyChart = () => (
    <Animated.View
      entering={enteredFromNav ? FadeInDown.delay(600).duration(400) : undefined}
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
      <View style={styles.summaryCard}>
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
      </View>

      {/* Weekly Bar Chart */}
      <View style={styles.weeklyCard}>
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
      </View>

      {/* AI Analysis Card */}
      <View style={styles.analysisCard}>
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
      </View>
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
      <View style={styles.summaryCard}>
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
      </View>

      {/* Sleep Metrics Card */}
      <View style={styles.metricsRow}>
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
      </View>

      {/* AI Analysis Card */}
      <View style={styles.analysisCard}>
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
      </View>
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

                  {/* Hour ticks */}
                  {Array.from({ length: 24 }).map((_, i) => {
                    const angle = ((i * 15 - 90) * Math.PI) / 180;
                    const isMajor = i % 6 === 0;
                    const inner = radius - (isMajor ? 18 : 10);
                    const outer = radius - 3;
                    return (
                      <Line
                        key={i}
                        x1={cx + inner * Math.cos(angle)}
                        y1={cy + inner * Math.sin(angle)}
                        x2={cx + outer * Math.cos(angle)}
                        y2={cy + outer * Math.sin(angle)}
                        stroke={isMajor ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.2)'}
                        strokeWidth={isMajor ? 2 : 1}
                      />
                    );
                  })}

                  {/* Hour labels */}
                  {[0, 6, 12, 18].map((h) => {
                    const angle = ((h * 15 - 90) * Math.PI) / 180;
                    const r = radius + 18;
                    return (
                      <SvgText
                        key={h}
                        x={cx + r * Math.cos(angle)}
                        y={cy + r * Math.sin(angle) + 5}
                        fill="rgba(255,255,255,0.7)"
                        fontSize="13"
                        fontWeight="600"
                        textAnchor="middle">
                        {h}
                      </SvgText>
                    );
                  })}

                  {/* Sleep arc */}
                  <Path
                    d={`M ${bedX} ${bedY} A ${radius} ${radius} 0 ${largeArc} 1 ${wakeX} ${wakeY}`}
                    stroke={RECOVERY}
                    strokeWidth="18"
                    strokeLinecap="round"
                    fill="transparent"
                    opacity={0.9}
                  />

                  {/* Dotted extension from bed handle */}
                  <Circle cx={bedX} cy={bedY - 20} r="2" fill={RECOVERY} opacity={0.5} />
                  <Circle cx={bedX + 5} cy={bedY - 35} r="2" fill={RECOVERY} opacity={0.4} />
                  <Circle cx={bedX + 12} cy={bedY - 48} r="2" fill={RECOVERY} opacity={0.3} />
                </Svg>

                {/* Center time display */}
                <View style={styles.clockCenterDisplay}>
                  <View style={styles.clockTimeRow}>
                    <Svg width={20} height={20} viewBox="0 0 24 24">
                      <Path
                        d="M3 12h4l3-9 4 18 3-9h4"
                        stroke="rgba(255,255,255,0.5)"
                        strokeWidth="2"
                        fill="none"
                      />
                    </Svg>
                    <Text style={styles.clockCenterTime}>{bedtime.formatted}</Text>
                  </View>
                  <View style={styles.clockTimeRow}>
                    <Svg width={20} height={20} viewBox="0 0 24 24">
                      <Circle cx="12" cy="12" r="4" fill="rgba(255,255,255,0.5)" />
                    </Svg>
                    <Text style={styles.clockCenterTime}>{waketime.formatted}</Text>
                  </View>
                </View>

                {/* Bedtime handle */}
                <View
                  {...bedPan.panHandlers}
                  style={[
                    styles.clockHandle,
                    { left: bedX + 40 - 20, top: bedY - 20, backgroundColor: RECOVERY },
                  ]}>
                  <Svg width={18} height={18} viewBox="0 0 24 24">
                    <Path d="M3 12h18M7 8h10v8H7z" stroke="#fff" strokeWidth="2" fill="none" />
                  </Svg>
                </View>

                {/* Wake handle */}
                <View
                  {...wakePan.panHandlers}
                  style={[
                    styles.clockHandle,
                    { left: wakeX + 40 - 20, top: wakeY - 20, backgroundColor: RECOVERY },
                  ]}>
                  <Svg width={18} height={18} viewBox="0 0 24 24">
                    <Circle cx="12" cy="12" r="5" fill="#fff" />
                  </Svg>
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
        <LinearGradient
          colors={['#1e1b4b', 'transparent']}
          style={styles.gradientTopLeft}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <LinearGradient
          colors={['#0c4a6e', 'transparent']}
          style={styles.gradientBottomRight}
          start={{ x: 1, y: 1 }}
          end={{ x: 0, y: 0 }}
        />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={RECOVERY}
              colors={[RECOVERY]}
            />
          }>
          <Animated.View
            entering={enteredFromNav ? FadeIn.duration(300) : undefined}
            style={styles.header}>
            <Text style={styles.title}>Sleep Analysis</Text>
            {isConnected && (
              <Pressable style={styles.addBtn} onPress={() => setShowRecordModal(true)}>
                <Text style={styles.addBtnText}>+</Text>
              </Pressable>
            )}
          </Animated.View>

          {renderViewToggle()}

          {viewMode === 'Day' && renderDateNav()}

          {storeLoading ? (
            <Animated.View entering={FadeIn} style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading...</Text>
            </Animated.View>
          ) : !isConnected ? (
            <>
              {renderEmptyState()}
              {isConnected && (
                <Pressable style={styles.recordBtn} onPress={() => setShowRecordModal(true)}>
                  <LinearGradient
                    colors={[RECOVERY, RECOVERY_LIGHT]}
                    style={styles.recordBtnGradient}>
                    <Text style={styles.recordBtnText}>Record Sleep</Text>
                  </LinearGradient>
                </Pressable>
              )}
            </>
          ) : viewMode === 'Day' ? (
            !selectedDay?.durationHours ? (
              <>
                {renderEmptyState()}
                <Pressable style={styles.recordBtn} onPress={() => setShowRecordModal(true)}>
                  <LinearGradient
                    colors={[RECOVERY, RECOVERY_LIGHT]}
                    style={styles.recordBtnGradient}>
                    <Text style={styles.recordBtnText}>Record Sleep</Text>
                  </LinearGradient>
                </Pressable>
              </>
            ) : (
              <>
                {renderFitnessRings()}
                {renderRingLegend()}
                {renderStats()}
                {renderAIInsight()}
                {renderWeeklyChart()}
              </>
            )
          ) : viewMode === 'Week' ? (
            renderWeekView()
          ) : (
            renderMonthView()
          )}
        </ScrollView>

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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
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
});
