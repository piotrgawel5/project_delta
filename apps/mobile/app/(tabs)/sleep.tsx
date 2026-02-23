import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  Text,
  RefreshControl,
  Pressable,
  Dimensions,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@store/authStore';
import { useProfileStore } from '@store/profileStore';
import { useSleepStore } from '@store/sleepStore';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useAnimatedProps,
  interpolate,
  Extrapolation,
  useAnimatedReaction,
  runOnJS,
  withTiming,
  Easing,
  SharedValue,
} from 'react-native-reanimated';
import Svg, { Rect, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { SleepCalendar } from '../../components/sleep/SleepCalendar';
import { AddSleepRecordModal } from '../../components/sleep/AddSleepRecordModal';
import { transformToHypnogramStages } from '@lib/sleepTransform';
import { getSleepScoreGrade, brightenColor } from '@lib/sleepColors';
import {
  formatDuration,
  formatHours,
  formatTimeParts,
  getSleepDescription,
} from '@lib/sleepFormatters';
import { addDays, dateKey, isSameDay, normalizeDate, padToSeven } from '@lib/sleepDateUtils';
import { useSleepGradient } from '@lib/useSleepGradient';
import { SleepMetricsList, SleepMetricItem } from '@components/sleep/dashboard/SleepMetricsList';
import { SleepHypnogram } from '@components/sleep/SleepHypnogram';
import { fetchSleepTimeline, SleepTimelineResponse } from '@lib/api';
import { isPaidPlan } from '@lib/planUtils';

// Colors
const BG_PRIMARY = '#0B0B0D';
const EMPTY_DAY_BG = '#000000';
const SURFACE_ALT = '#1B1B21';
const SHEET_BG = '#000000';
const TEXT_SECONDARY = 'rgba(255, 255, 255, 0.68)';
const TEXT_TERTIARY = 'rgba(255, 255, 255, 0.45)';
const STROKE = 'rgba(255, 255, 255, 0.08)';
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const SHEET_PADDING_X = 20;
const SHEET_PADDING_TOP = 24;
const SHEET_INNER_RADIUS = 24;
const SHEET_RADIUS = SHEET_INNER_RADIUS + SHEET_PADDING_X;
const ICON_BUTTON_SIZE = 44;
const ICON_BUTTON_RADIUS = ICON_BUTTON_SIZE / 2;
const EMPTY_STATE_PADDING = 22;
const EMPTY_STATE_INNER_RADIUS = 8;
const EMPTY_STATE_RADIUS = EMPTY_STATE_INNER_RADIUS + EMPTY_STATE_PADDING;
const EMPTY_BADGE_SIZE = 44;
const EMPTY_BADGE_RADIUS = EMPTY_BADGE_SIZE / 2;
const EMPTY_BUTTON_PADDING_Y = 10;
const EMPTY_BUTTON_INNER_RADIUS = 8;
const EMPTY_BUTTON_RADIUS = EMPTY_BUTTON_INNER_RADIUS + EMPTY_BUTTON_PADDING_Y;
const GRADIENT_LOCATIONS = [0, 0.55, 1] as const;
const METRIC_COLORS = {
  totalSleep: '#5BC8F5',
  efficiency: '#9B7FD4',
  stagesDeep: '#4CD97B',
  stagesREM: '#E87EAC',
  stagesLight: '#D4A017',
  stagesAwake: '#6B6B6B',
  bedtime: '#9B7FD4',
  wakeTime: '#D4A017',
} as const;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const toBedMinutes = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  let minutes = d.getHours() * 60 + d.getMinutes();
  if (minutes < 12 * 60) minutes += 24 * 60;
  return minutes;
};

const toWakeMinutes = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
};

const resolveSleepScore = (item: any): number | undefined => {
  if (!item) return undefined;
  if (typeof item?.score_breakdown?.score === 'number') {
    return Math.round(item.score_breakdown.score);
  }
  if (typeof item?.sleep_score === 'number') {
    return Math.round(item.sleep_score);
  }
  return undefined;
};

const GradientBackground = React.memo(function GradientBackground({
  baseColor,
  overlayColor,
  progress,
}: {
  baseColor: string;
  overlayColor: string;
  progress: SharedValue<number>;
}) {
  const animatedOverlayProps = useAnimatedProps(() => ({
    opacity: progress.value,
  }));

  return (
    <Svg width={BG_WIDTH} height={BG_HEIGHT} style={StyleSheet.absoluteFill}>
      <Defs>
        <SvgGradient id="sleepGradientBase" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={baseColor} />
          <Stop offset="0.55" stopColor={BG_PRIMARY} />
          <Stop offset="1" stopColor={BG_PRIMARY} />
        </SvgGradient>
        <SvgGradient id="sleepGradientOverlay" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={overlayColor} />
          <Stop offset="0.55" stopColor={BG_PRIMARY} />
          <Stop offset="1" stopColor={BG_PRIMARY} />
        </SvgGradient>
      </Defs>
      <Rect x="0" y="0" width={BG_WIDTH} height={BG_HEIGHT} fill="url(#sleepGradientBase)" />
      <AnimatedRect
        x="0"
        y="0"
        width={BG_WIDTH}
        height={BG_HEIGHT}
        fill="url(#sleepGradientOverlay)"
        animatedProps={animatedOverlayProps}
      />
    </Svg>
  );
});

export default function SleepScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const isPremium = isPaidPlan(useProfileStore((s) => s.profile?.plan));
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);

  const {
    recentHistory,
    monthlyData,
    loading,
    fetchSleepData,
    fetchSleepDataRange,
    checkHealthConnectStatus,
  } = useSleepStore();

  const normalizeDate = useCallback((date: Date) => {
    const d = new Date(date);
    d.setHours(12, 0, 0, 0);
    return d;
  }, []);

  const dateKey = useCallback((date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  const addDays = useCallback((date: Date, days: number) => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }, []);

  const [selectedDate, setSelectedDate] = useState(() => {
    return normalizeDate(new Date());
  });
  const [isCalendarVisible, setIsCalendarVisible] = useState(false);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isHeaderInteractable, setIsHeaderInteractable] = useState(false);
  const pagerRef = useRef<FlatList<Date>>(null);
  const [activeIndex, setActiveIndex] = useState<number>(() => {
    const today = normalizeDate(new Date());
    const year = today.getFullYear();
    const month = today.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    return Math.min(today.getDate() - 1, lastDay - 1);
  });
  const selectedYear = selectedDate.getFullYear();
  const selectedMonth = selectedDate.getMonth();
  const gradientProgress = useSharedValue(1);
  const [gradientBase, setGradientBase] = useState('#000000');
  const [gradientOverlay, setGradientOverlay] = useState('#000000');
  const [cacheRange, setCacheRange] = useState({ min: 0, max: 0 });
  const [cachedHistory, setCachedHistory] = useState<Map<string, any>>(new Map());
  const populatedKeysRef = useRef<Set<string>>(new Set());
  const [timeline, setTimeline] = useState<SleepTimelineResponse | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);

  useEffect(() => {
    if (user?.id) {
      checkHealthConnectStatus();
      fetchSleepData(user.id);
    }
  }, [user?.id]);

  const onRefresh = useCallback(async () => {
    if (user?.id) {
      setRefreshing(true);
      await fetchSleepData(user.id);
      setRefreshing(false);
    }
  }, [user?.id]);

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  useAnimatedReaction(
    () => scrollY.value > 20,
    (isScrolled, prev) => {
      if (isScrolled !== prev) {
        runOnJS(setIsHeaderInteractable)(isScrolled);
      }
    }
  );

  const headerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 40], [0, 1], Extrapolation.CLAMP),
  }));

  // Helper to format minutes into H M
  const formatDuration = (totalMinutes: number) => {
    const h = Math.floor(totalMinutes / 60);
    const m = Math.round(totalMinutes % 60);
    return { h, m };
  };

  const currentData = useMemo(() => {
    const targetDateStr = dateKey(selectedDate);

    // 1. Try weekly history first
    const hist = recentHistory || [];
    let displayItem = hist.find((item) => item.date === targetDateStr);

    // 2. Fallback to monthly data cache if not found
    if (!displayItem && monthlyData) {
      const monthKey = targetDateStr.substring(0, 7); // YYYY-MM
      const monthRecords = monthlyData[monthKey];
      if (monthRecords) {
        displayItem = monthRecords.find((r) => r.date === targetDateStr);
      }
    }

    return {
      historyItem: displayItem || null,
      fullDate: selectedDate.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
    };
  }, [selectedDate, recentHistory, monthlyData]);

  const hi = currentData.historyItem;
  const currentRecord = hi;
  const hasData = !!hi;

  // Metrics
  const durationMinutes = hi?.duration_minutes || 0;
  const durationParts = durationMinutes ? formatDuration(durationMinutes) : null;
  const durationHoursValue = durationParts
    ? durationParts.m > 0
      ? `${durationParts.h}h ${durationParts.m}m`
      : `${durationParts.h}h`
    : '--';
  const timeInBedMinutes =
    hi?.start_time && hi?.end_time
      ? Math.round((new Date(hi.end_time).getTime() - new Date(hi.start_time).getTime()) / 60000)
      : durationMinutes;
  const sleepEfficiency =
    timeInBedMinutes > 0
      ? Math.min(100, Math.round((durationMinutes / timeInBedMinutes) * 100))
      : 0;
  const deepMin = hi?.deep_sleep_minutes || 0;
  const remMin = hi?.rem_sleep_minutes || 0;
  const lightMin = hi?.light_sleep_minutes || 0;
  const awakeMinutesRaw = hi?.awake_minutes;
  const awakeMin = typeof awakeMinutesRaw === 'number' ? awakeMinutesRaw : null;
  const deepPct = durationMinutes ? Math.round((deepMin / durationMinutes) * 100) : 0;
  const remPct = durationMinutes ? Math.round((remMin / durationMinutes) * 100) : 0;
  const lightPct = durationMinutes ? Math.round((lightMin / durationMinutes) * 100) : 0;
  const awakePct =
    durationMinutes && awakeMin !== null ? Math.round((awakeMin / durationMinutes) * 100) : null;
  const deepDurationParts = deepMin ? formatDuration(deepMin) : null;
  const deepDurationValue = deepDurationParts
    ? deepDurationParts.m > 0
      ? `${deepDurationParts.h}h ${deepDurationParts.m}m`
      : `${deepDurationParts.h}h`
    : '--';
  const stageItems = useMemo(() => {
    if (!durationMinutes) return [];
    return [
      {
        label: 'Deep',
        value: `${formatHours(deepMin)}h`,
        percent: deepPct,
        color: METRIC_COLORS.stagesDeep,
      },
      {
        label: 'REM',
        value: `${formatHours(remMin)}h`,
        percent: remPct,
        color: METRIC_COLORS.stagesREM,
      },
      {
        label: 'Light',
        value: `${formatHours(lightMin)}h`,
        percent: lightPct,
        color: METRIC_COLORS.stagesLight,
      },
      {
        label: 'Awake',
        value: awakeMin !== null ? `${formatHours(awakeMin)}h` : '—',
        percent: awakePct,
        color: METRIC_COLORS.stagesAwake,
      },
    ];
  }, [awakeMin, awakePct, deepMin, remMin, lightMin, deepPct, remPct, lightPct, durationMinutes]);

  const bedtimeParts = formatTimeParts(hi?.start_time);
  const wakeParts = formatTimeParts(hi?.end_time);

  const weeklySeries = useMemo(() => {
    const history = recentHistory || [];
    if (!history.length) return [];
    return [...history]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-7);
  }, [recentHistory]);

    return {
      duration: padToSeven(
        weeklySeries.map((item) => item.duration_minutes ?? null),
        null
      ),
      efficiency: padToSeven(
        weeklySeries.map((item) => {
          const duration = item.duration_minutes ?? 0;
          if (!duration) return null;
          const awake =
            typeof item.awake_minutes === 'number'
              ? item.awake_minutes
              : item.start_time && item.end_time
                ? Math.max(
                    0,
                    Math.round(
                      (new Date(item.end_time).getTime() - new Date(item.start_time).getTime()) /
                        60000
                    ) - duration
                  )
                : 0;
          const timeInBed = duration + awake;
          return timeInBed > 0 ? Math.min(100, Math.round((duration / timeInBed) * 100)) : null;
        }),
        null
      ),
      deep: padToSeven(
        weeklySeries.map((item) => item.deep_sleep_minutes ?? null),
        null
      ),
      rem: padToSeven(
        weeklySeries.map((item) => item.rem_sleep_minutes ?? null),
        null
      ),
      light: padToSeven(
        weeklySeries.map((item) => item.light_sleep_minutes ?? null),
        null
      ),
      bed: padToSeven(
        weeklySeries.map((item) => toBedMinutes(item.start_time)),
        null
      ),
      wake: padToSeven(
        weeklySeries.map((item) => toWakeMinutes(item.end_time)),
        null
      ),
    };
  }, [weeklySeries]);

  const metricCards = useMemo<SleepMetricItem[]>(() => {
    const totalSubtitle = durationMinutes
      ? durationMinutes >= 420
        ? 'Above goal'
        : 'Below goal'
      : 'No data';

    const efficiencySubtitle = durationMinutes
      ? sleepEfficiency >= 85
        ? 'Excellent'
        : sleepEfficiency >= 75
          ? 'Good'
          : 'Low'
      : 'No data';

    return [
      {
        id: 'total',
        label: 'Total Sleep',
        value: durationHoursValue,
        unit: undefined,
        status: durationMinutes >= 420 ? 'up' : durationMinutes > 0 ? 'down' : 'neutral',
        subLabel: totalSubtitle,
        accent: METRIC_COLORS.totalSleep,
        icon: 'moon',
        trend: trendData.duration,
        chartType: 'bars',
        selectedDate,
      },
      {
        id: 'efficiency',
        label: 'Efficiency',
        value: durationMinutes ? `${sleepEfficiency}` : '--',
        unit: durationMinutes ? '%' : undefined,
        status: durationMinutes
          ? sleepEfficiency >= 85
            ? 'up'
            : sleepEfficiency >= 75
              ? 'neutral'
              : 'down'
          : 'neutral',
        subLabel: efficiencySubtitle,
        accent: METRIC_COLORS.efficiency,
        icon: 'speedometer',
        trend: trendData.efficiency,
        chartType: 'dots',
        dotThreshold: 85,
        selectedDate,
      },
      {
        id: 'stages',
        label: 'Sleep Stages',
        value: durationMinutes ? `${deepDurationValue} Deep` : '--',
        unit: undefined,
        status: 'neutral',
        subLabel: durationMinutes ? `${deepPct}% of total` : 'No data',
        accent: METRIC_COLORS.stagesDeep,
        icon: 'layers',
        chartType: 'stages',
        stages: stageItems,
        showDays: false,
        selectedDate,
      },
      {
        id: 'bed',
        label: 'Fell Asleep',
        value: bedtimeParts.time,
        unit: bedtimeParts.meridiem,
        status: 'neutral',
        subLabel: 'Bedtime',
        accent: METRIC_COLORS.bedtime,
        icon: 'bed',
        trend: trendData.bed,
        chartType: 'dots',
        dotThreshold: 1320,
        selectedDate,
      },
      {
        id: 'wake',
        label: 'Woke Up',
        value: wakeParts.time,
        unit: wakeParts.meridiem,
        status: 'neutral',
        subLabel: 'Wake time',
        accent: METRIC_COLORS.wakeTime,
        icon: 'alarm',
        trend: trendData.wake,
        chartType: 'bars',
        selectedDate,
      },
    ];
  }, [
    bedtimeParts.meridiem,
    bedtimeParts.time,
    deepDurationValue,
    deepPct,
    durationHoursValue,
    durationMinutes,
    selectedDate,
    sleepEfficiency,
    stageItems,
    trendData.bed,
    trendData.duration,
    trendData.efficiency,
    trendData.wake,
    wakeParts.meridiem,
    wakeParts.time,
  ]);

  const historyByDate = useMemo(() => {
    const map = new Map<string, any>();
    (recentHistory || []).forEach((item) => {
      map.set(item.date, item);
    });
    if (monthlyData) {
      Object.keys(monthlyData).forEach((monthKey) => {
        (monthlyData[monthKey] || []).forEach((item) => {
          if (!map.has(item.date)) {
            map.set(item.date, item);
          }
        });
      });
    }
    return map;
  }, [recentHistory, monthlyData, currentMonthKey]);

  const getGradientColorForKey = useCallback(
    (key: string) => {
      const item = historyByDate.get(key) ?? cachedHistory.get(key);
      if (!item) return EMPTY_DAY_BG;
      return getSleepScoreGrade(resolveSleepScore(item) ?? 0).color;
    },
    [cachedHistory, historyByDate]
  );

  const {
    gradientBase,
    overlayAColor,
    overlayBColor,
    overlayAOpacity,
    overlayBOpacity,
    gradientKey,
    setGradientKey,
  } = useSleepGradient({
    initialKey: dateKey(selectedDate),
    defaultColor: BG_PRIMARY,
    getColorForKey: getGradientColorForKey,
  });
  const selectedDateKey = useMemo(() => dateKey(selectedDate), [selectedDate]);
  const hydratedGradientKeysRef = useRef<Set<string>>(new Set());
  const prevSelectedDateKeyRef = useRef(selectedDateKey);
  const prevHasDataForSelectedRef = useRef<boolean>(!!historyByDate.get(selectedDateKey));

  useEffect(() => {
    const selectedChanged = prevSelectedDateKeyRef.current !== selectedDateKey;
    const hasDataNow = !!historyByDate.get(selectedDateKey);
    const hadDataBefore = prevHasDataForSelectedRef.current;

    prevSelectedDateKeyRef.current = selectedDateKey;
    prevHasDataForSelectedRef.current = hasDataNow;

    // Keep animated transitions for explicit day changes.
    if (selectedChanged) return;
    const becameAvailable = !hadDataBefore && hasDataNow;
    if (!becameAvailable) return;
    if (hydratedGradientKeysRef.current.has(selectedDateKey)) return;
    if (gradientKey !== selectedDateKey) return;

    setGradientKey(selectedDateKey, false);
    hydratedGradientKeysRef.current.add(selectedDateKey);
  }, [historyByDate, selectedDateKey, gradientKey, setGradientKey]);

  const monthDates = useMemo(() => {
    const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    return Array.from({ length: lastDay }, (_, i) =>
      normalizeDate(new Date(selectedYear, selectedMonth, i + 1))
    );
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    const index = monthDates.findIndex((d) => isSameDay(d, selectedDate));
    if (index >= 0 && index !== activeIndex) {
      pagerRef.current?.scrollToIndex({ index, animated: true });
      setActiveIndex(index);
    }
  }, [selectedDate, monthDates, activeIndex]);

  const handlePagerEnd = useCallback(
    (offsetX: number) => {
      const index = Math.round(offsetX / SCREEN_W);
      const next = monthDates[index];
      if (next && !isSameDay(next, selectedDate)) {
        setSelectedDate(next);
        setActiveIndex(index);
      }
      const nextKey = next ? dateKey(next) : gradientKey;
      setGradientKey(nextKey, true);
      navigation.getParent()?.setOptions({ swipeEnabled: true });
    },
    [monthDates, selectedDate, gradientKey, setGradientKey, navigation]
  );

  useEffect(() => {
    navigation.getParent()?.setOptions({ swipeEnabled: true });
  }, [navigation]);

  useEffect(() => {
    if (!monthDates.length) return;
    setCacheRange((prev) => {
      const newMin = Math.max(0, activeIndex - 4);
      const newMax = Math.min(monthDates.length - 1, activeIndex + 4);
      if (newMin === prev.min && newMax === prev.max) return prev;
      return { min: newMin, max: newMax };
    });
  }, [activeIndex, monthDates.length]);

  useEffect(() => {
    if (!user?.id) return;
    if (!monthDates.length) return;

    if (activeIndex >= cacheRange.max - 1) {
      const start = addDays(selectedDate, 1);
      const end = addDays(selectedDate, 7);
      fetchSleepDataRange(user.id, start, end);
    }

    if (activeIndex <= cacheRange.min + 1) {
      const start = addDays(selectedDate, -7);
      const end = addDays(selectedDate, -1);
      fetchSleepDataRange(user.id, start, end);
    }
  }, [activeIndex, cacheRange, selectedDate, user?.id, fetchSleepDataRange, addDays, monthDates.length]);

  useEffect(() => {
    populatedKeysRef.current.clear();
    setCachedHistory(new Map());
  }, [historyByDate]);

  useEffect(() => {
    if (!monthDates.length) return;
    setCachedHistory((prev) => {
      let hasNew = false;
      const next = new Map(prev);
      for (let i = cacheRange.min; i <= cacheRange.max; i += 1) {
        const date = monthDates[i];
        if (!date) continue;
        const key = dateKey(date);
        if (populatedKeysRef.current.has(key)) continue;
        const record = historyByDate.get(key) ?? null;
        next.set(key, record);
        populatedKeysRef.current.add(key);
        hasNew = true;
      }
      return hasNew ? next : prev;
    });
  }, [cacheRange, monthDates, historyByDate]);

  useEffect(() => {
    const userId = currentRecord?.user_id;
    const date = currentRecord?.date;
    const id = currentRecord?.id;

    let cancelled = false;
    let retryAttempt = 0;
    const RETRY_DELAYS = [6000, 12000];

    const attemptRetry = () => {
      if (retryAttempt >= RETRY_DELAYS.length || cancelled) return;
      const delay = RETRY_DELAYS[retryAttempt++];
      setTimeout(async () => {
        if (cancelled) return;
        try {
          const retry = await fetchSleepTimeline(userId!, date!);
          if (retry && retry.phases.length > 0) {
            setTimeline(retry);
          } else {
            attemptRetry();
          }
        } catch {
          // silent
        }
      }, delay);
    };

    const loadTimeline = async () => {
      if (!userId || !date) {
        return;
      }
      if (!isPremium) {
        setTimeline(null);
        return;
      }
      if (id && !UUID_REGEX.test(id)) {
        return;
      }

      setTimelineLoading(true);
      try {
        const result = await fetchSleepTimeline(userId, date);
        if (result && result.phases.length > 0) {
          setTimeline(result);
        } else {
          attemptRetry();
        }
      } catch {
        setTimeline(null);
      } finally {
        setTimelineLoading(false);
      }
    };

    void loadTimeline();

    return () => {
      cancelled = true;
    };
  }, [currentRecord?.user_id, currentRecord?.date, currentRecord?.id, isPremium]);

  return (
    <View style={styles.container}>
      {/* Background Gradient */}
      <GradientBackground
        baseColor={gradientBase}
        overlayColor={gradientOverlay}
        progress={gradientProgress}
      />

      <View
        pointerEvents={isTopOverlayFront ? 'auto' : 'none'}
        onLayout={handleTopSectionLayout}
        style={[
          styles.fixedTopSection,
          {
            paddingTop: insets.top + 20,
            zIndex: isTopOverlayFront ? 3 : 0,
          },
        ]}>
        {/* Swipeable Title Section */}
        <View style={styles.pagerWrap}>
          <FlatList
            ref={pagerRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            data={monthDates}
            keyExtractor={(item) => dateKey(item)}
            getItemLayout={(_, index) => ({
              length: SCREEN_W,
              offset: SCREEN_W * index,
              index,
            })}
            initialScrollIndex={activeIndex}
            windowSize={3}
            maxToRenderPerBatch={3}
            updateCellsBatchingPeriod={50}
            onScrollBeginDrag={() => {
              navigation.getParent()?.setOptions({ swipeEnabled: false });
            }}
            onMomentumScrollEnd={(event) => handlePagerEnd(event.nativeEvent.contentOffset.x)}
            onScrollEndDrag={() => {
              navigation.getParent()?.setOptions({ swipeEnabled: true });
            }}
            renderItem={({ item, index }) => {
              const shouldPrefetch = Math.abs(index - activeIndex) <= 1;
              const itemDateStr = dateKey(item);
              const itemHistory =
                historyByDate.get(itemDateStr) ??
                cachedHistory.get(itemDateStr) ??
                (shouldPrefetch ? historyByDate.get(itemDateStr) || null : null);
              const itemHasData = !!itemHistory;
              const itemScore = resolveSleepScore(itemHistory);
              const itemGrade = getSleepScoreGrade(itemScore ?? 0);
              return (
                <View style={styles.pagerItem}>
                  <View style={styles.titleSection}>
                    <View style={styles.labelRow}>
                      <Ionicons name="moon" size={16} color={brightenColor(itemGrade.color)} />
                      <Text
                        style={[
                          styles.sectionLabel,
                          { color: brightenColor(itemGrade.color) },
                        ]}>
                        Sleep
                      </Text>
                    </View>
                    <Text style={styles.mainRating}>
                      {itemScore !== undefined ? itemGrade.grade : '--'}
                    </Text>
                    {itemScore !== undefined ? (
                      <Text style={styles.scoreNumeric}>{itemScore} / 100</Text>
                    ) : null}
                    <Text style={styles.dateLabel}>
                      {item.toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </Text>
                    <Text style={styles.description}>
                      {itemHasData
                        ? getSleepDescription(
                            itemScore ?? 0,
                            itemHistory?.duration_minutes ?? 0
                          )
                        : 'No sleep data yet for this day. Add a record to see your score and trends.'}
                    </Text>
                  </View>
                </View>
              );
            }}
          />
        </View>

      <View style={[styles.persistentControls, { top: insets.top + 20, zIndex: 10 }]}>
        <View style={{ width: 44 }} />
        <View style={styles.rightIcons}>
          <Pressable style={styles.iconButton} onPress={() => setIsCalendarVisible(true)}>
            <Ionicons name="calendar-outline" size={20} color="#FFFFFF" />
          </Pressable>
          <Pressable style={styles.iconButton} onPress={() => setIsAddModalVisible(true)}>
            <Ionicons name="add" size={24} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      <Animated.ScrollView
        style={styles.sheetScroll}
        contentContainerStyle={[styles.scrollContent, { paddingTop: topSectionHeight }]}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="white" />
        }>
        <View style={[styles.bottomSheet, { paddingBottom: Math.max(120, insets.bottom + 80) }]}>
          <View style={styles.bottomSheetContent}>
            {hasData ? (
              <>
                <SleepMetricsList metrics={metricCards} />
                {currentRecord?.start_time && currentRecord?.end_time ? (
                  <View style={styles.stageSectionCard}>
                    <Text style={styles.stageSectionTitle}>Sleep Stages</Text>
                    <SleepHypnogram
                      phases={timeline?.phases ?? []}
                      sessionStart={currentRecord.start_time}
                      sessionEnd={currentRecord.end_time}
                      isPremium={isPremium}
                      isLoading={timelineLoading}
                    />
                  </View>
                ) : null}
              </>
            ) : (
              <View style={styles.emptyState}>
                <View style={styles.emptyBadge}>
                  <Ionicons name="moon-outline" size={22} color={TEXT_SECONDARY} />
                </View>
              </View>
            </>
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyBadge}>
                <Ionicons name="moon-outline" size={22} color={TEXT_SECONDARY} />
              </View>
              <Text style={styles.emptyTitle}>No sleep data</Text>
              <Text style={styles.emptyCopy}>
                Add a sleep record for this day to unlock metrics and trends.
              </Text>
              <Pressable style={styles.emptyButton} onPress={() => setIsAddModalVisible(true)}>
                <Text style={styles.emptyButtonText}>Add data</Text>
                <Ionicons name="add" size={18} color="black" />
              </Pressable>
            </View>
          )}
        </View>

      <SleepCalendar
        isVisible={isCalendarVisible}
        onClose={() => setIsCalendarVisible(false)}
        selectedDate={selectedDate}
        onDateSelect={(date) => {
          const normalized = normalizeDate(date);
          setSelectedDate(normalized);
          setGradientKey(dateKey(normalized), true);
        }}
        history={recentHistory}
      />

      <AddSleepRecordModal
        isVisible={isAddModalVisible}
        onClose={() => setIsAddModalVisible(false)}
        onSave={async (start, end) => {
          if (!user?.id) return false;
          const success = await forceSaveManualSleep(
            user.id,
            start.toISOString(),
            end.toISOString()
          );
          return success;
        }}
        date={selectedDate}
        userId={user?.id || ''}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_PRIMARY,
  },
  scrollContent: {
    paddingHorizontal: 0,
    paddingBottom: 40,
  },
  contentWrap: {
    paddingHorizontal: SHEET_PADDING_X,
  },
  fixedTopSection: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  persistentControls: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SHEET_PADDING_X,
  },
  sheetScroll: {
    zIndex: 1,
  },
  pagerWrap: {
    marginBottom: 24,
  },
  pagerItem: {
    width: SCREEN_W,
    paddingHorizontal: 20,
  },
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    alignItems: 'center',
    paddingBottom: 10,
  },
  stickyHeaderContent: {
    height: 44,
    justifyContent: 'center',
  },
  stickyTitle: {
    color: 'white',
    fontSize: 17,
    fontWeight: '600',
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  rightIcons: {
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    width: ICON_BUTTON_SIZE,
    height: ICON_BUTTON_SIZE,
    borderRadius: ICON_BUTTON_RADIUS,
    backgroundColor: 'rgba(0, 0, 0, 0.30)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleSection: {
    marginBottom: 32,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionLabel: {
    color: '#A855F7',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  mainRating: {
    color: 'white',
    fontSize: Math.min(72, Math.round(SCREEN_W * 0.18)),
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -2,
  },
  scoreNumeric: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.82)',
    marginTop: 6,
    letterSpacing: 0.35,
    marginBottom: 10,
  },
  dateLabel: {
    color: TEXT_SECONDARY,
    fontSize: 15,
    marginBottom: 16,
  },
  description: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    marginTop: 6,
  },
  emptyState: {
    borderRadius: UI_RADIUS,
    padding: 22,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  emptyBadge: {
    width: 44,
    height: 44,
    borderRadius: UI_RADIUS,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyCopy: {
    color: TEXT_SECONDARY,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  emptyButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'white',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: UI_RADIUS,
  },
  emptyButtonText: {
    color: 'black',
    fontSize: 14,
    fontWeight: '700',
  },
  stageSectionCard: {
    borderRadius: 24,
    padding: 20,
    backgroundColor: '#1C1C1E',
    borderWidth: 1,
    borderColor: STROKE,
    marginBottom: 32,
  },
  stageSectionTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  chartSection: {
    marginBottom: 40,
  },
  chartTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: '700',
  },
  chartTimeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  chartTimeText: {
    color: TEXT_SECONDARY,
    fontSize: 12,
  },
});
