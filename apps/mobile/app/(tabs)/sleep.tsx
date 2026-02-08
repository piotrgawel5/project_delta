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
  SharedValue,
} from 'react-native-reanimated';
import Svg, { Rect, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { SleepCalendar } from '../../components/sleep/SleepCalendar';
import { AddSleepRecordModal } from '../../components/sleep/AddSleepRecordModal';
import { transformToHypnogramStages } from '@lib/sleepTransform';
import { getSleepScoreGrade, brightenColor } from '@lib/sleepColors';
import {
  formatHours,
  formatMinutesToTimeLabel,
  formatTimeParts,
  formatTimeWithMeridiem,
} from '@lib/sleepFormatters';
import { addDays, dateKey, isSameDay, normalizeDate } from '@lib/sleepDateUtils';
import { useSleepGradient } from '@lib/useSleepGradient';
import { MetricDetailSheet } from '@components/sleep/MetricDetailSheet';
import { SleepMetricsList, SleepMetricItem, MetricSheetData } from '@components/sleep/dashboard/SleepMetricsList';

// Colors
const BG_PRIMARY = '#0B0B0D';
const SURFACE = '#141419';
const SURFACE_ALT = '#1B1B21';
const TEXT_SECONDARY = 'rgba(255, 255, 255, 0.68)';
const TEXT_TERTIARY = 'rgba(255, 255, 255, 0.45)';
const STROKE = 'rgba(255, 255, 255, 0.08)';
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const BG_WIDTH = SCREEN_W;
const BG_HEIGHT = SCREEN_H;
const UI_RADIUS = 36;
const AnimatedRect = Animated.createAnimatedComponent(Rect);

const padToSeven = <T,>(values: T[], fill: T) => {
  if (values.length >= 7) return values.slice(-7);
  return Array(7 - values.length).fill(fill).concat(values);
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
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);

  const {
    weeklyHistory,
    monthlyData,
    loading,
    fetchSleepData,
    fetchSleepDataRange,
    forceSaveManualSleep,
    checkHealthConnectStatus,
  } = useSleepStore();

  const [selectedDate, setSelectedDate] = useState(() => {
    return normalizeDate(new Date());
  });
  const [isCalendarVisible, setIsCalendarVisible] = useState(false);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isHeaderInteractable, setIsHeaderInteractable] = useState(false);
  const pagerRef = useRef<FlatList<Date>>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const selectedYear = selectedDate.getFullYear();
  const selectedMonth = selectedDate.getMonth();
  const [cacheRange, setCacheRange] = useState({ min: 0, max: 0 });
  const [cachedHistory, setCachedHistory] = useState<Map<string, any>>(new Map());
  const [activeMetric, setActiveMetric] = useState<MetricSheetData | null>(null);

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

  const currentData = useMemo(() => {
    const targetDateStr = dateKey(selectedDate);

    // 1. Try weekly history first
    const hist = weeklyHistory || [];
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
  }, [selectedDate, weeklyHistory, monthlyData, dateKey]);

  const hi = currentData.historyItem;
  const hasData = !!hi;

  // Metrics
  const durationMinutes = hi?.duration_minutes || 0;
  const durationHoursValue = durationMinutes ? formatHours(durationMinutes, 2) : '--';
  const sleepEfficiency = durationMinutes
    ? Math.min(100, Math.round((durationMinutes / 480) * 100))
    : 0;
  const deepMin = hi?.deep_sleep_minutes || 0;
  const remMin = hi?.rem_sleep_minutes || 0;
  const lightMin = hi?.light_sleep_minutes || 0;
  const deepPct = durationMinutes ? Math.round((deepMin / durationMinutes) * 100) : 0;
  const remPct = durationMinutes ? Math.round((remMin / durationMinutes) * 100) : 0;
  const lightPct = durationMinutes ? Math.round((lightMin / durationMinutes) * 100) : 0;
  const stageItems = useMemo(() => {
    if (!durationMinutes) return [];
    return [
      {
        label: 'Deep',
        value: `${formatHours(deepMin)}h`,
        percent: deepPct,
        color: '#34D399',
      },
      {
        label: 'REM',
        value: `${formatHours(remMin)}h`,
        percent: remPct,
        color: '#F472B6',
      },
      {
        label: 'Light',
        value: `${formatHours(lightMin)}h`,
        percent: lightPct,
        color: '#FBBF24',
      },
    ];
  }, [deepMin, remMin, lightMin, deepPct, remPct, lightPct, durationMinutes]);

  const bedtimeParts = formatTimeParts(hi?.start_time);
  const wakeParts = formatTimeParts(hi?.end_time);

  // Memoize sleep score grade to avoid redundant calculations
  const sleepScoreGrade = useMemo(
    () => getSleepScoreGrade(currentData.historyItem?.sleep_score ?? 0),
    [currentData.historyItem?.sleep_score]
  );


  // Transform aggregate sleep data into hypnogram-compatible stages
  const hypnogramStages = useMemo(() => {
    if (!hi) return [];
    return transformToHypnogramStages({
      start_time: hi.start_time,
      end_time: hi.end_time,
      duration_minutes: hi.duration_minutes,
      deep_sleep_minutes: hi.deep_sleep_minutes,
      rem_sleep_minutes: hi.rem_sleep_minutes,
      light_sleep_minutes: hi.light_sleep_minutes,
      awake_minutes: hi.awake_minutes,
    });
  }, [hi]);

  const weeklySeries = useMemo(() => {
    const history = weeklyHistory || [];
    if (!history.length) return [];
    return [...history]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-7);
  }, [weeklyHistory]);

  const trendData = useMemo(() => {
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

    return {
      duration: padToSeven(weeklySeries.map((item) => item.duration_minutes ?? null), null),
      efficiency: padToSeven(
        weeklySeries.map((item) =>
          item.duration_minutes
            ? Math.min(100, Math.round((item.duration_minutes / 480) * 100))
            : null
        ),
        null
      ),
      deep: padToSeven(weeklySeries.map((item) => item.deep_sleep_minutes ?? null), null),
      rem: padToSeven(weeklySeries.map((item) => item.rem_sleep_minutes ?? null), null),
      light: padToSeven(weeklySeries.map((item) => item.light_sleep_minutes ?? null), null),
      bed: padToSeven(weeklySeries.map((item) => toBedMinutes(item.start_time)), null),
      wake: padToSeven(weeklySeries.map((item) => toWakeMinutes(item.end_time)), null),
    };
  }, [weeklySeries]);

  const weekLabels = useMemo(
    () =>
      padToSeven(
        weeklySeries.map((item) => {
          const d = new Date(item.date);
          return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
        }),
        '--'
      ),
    [weeklySeries]
  );

  const metricCards = useMemo<SleepMetricItem[]>(() => {
    const formatHoursRow = (value: number | null) =>
      typeof value === 'number' ? `${formatHours(value)}h` : '--';
    const formatPercentRow = (value: number | null) =>
      typeof value === 'number' ? `${value}%` : '--';
    const formatTimeRow = (value: number | null) => formatMinutesToTimeLabel(value);

    const buildRows = (values: Array<number | null>, formatter: (value: number | null) => string) =>
      weekLabels.map((label, index) => ({
        label,
        value: formatter(values[index] ?? null),
      }));

    const stageRows = weekLabels.map((label, index) => {
      const deep = trendData.deep[index];
      const rem = trendData.rem[index];
      const light = trendData.light[index];
      const hasAny = [deep, rem, light].some((v) => typeof v === 'number');
      return {
        label,
        value: hasAny
          ? `D ${formatHours(deep ?? 0)}h / R ${formatHours(rem ?? 0)}h / L ${formatHours(light ?? 0)}h`
          : '--',
      };
    });

    const totalSubtitle = durationMinutes
      ? durationMinutes >= 420
        ? 'Above goal'
        : 'Below goal'
      : 'No data';

    const efficiencySubtitle = durationMinutes
      ? sleepEfficiency >= 85
        ? 'Excellent'
        : sleepEfficiency >= 70
          ? 'Good'
          : 'Low'
      : 'No data';

    return [
      {
        id: 'total',
        label: 'Total Sleep',
        value: durationHoursValue,
        unit: durationMinutes ? 'hr' : undefined,
        status: durationMinutes >= 420 ? 'up' : durationMinutes > 0 ? 'down' : 'neutral',
        subLabel: totalSubtitle,
        accent: '#7DD3FC',
        icon: 'moon',
        trend: trendData.duration,
        chartType: 'bars',
        sheet: {
          id: 'total',
          title: 'Total Sleep',
          value: durationHoursValue,
          unit: durationMinutes ? 'hr' : undefined,
          subtitle: totalSubtitle,
          accent: '#7DD3FC',
          chartType: 'bars',
          trend: trendData.duration,
          rows: buildRows(trendData.duration, formatHoursRow),
        },
      },
      {
        id: 'efficiency',
        label: 'Efficiency',
        value: durationMinutes ? `${sleepEfficiency}` : '--',
        unit: durationMinutes ? '%' : undefined,
        status: durationMinutes
          ? sleepEfficiency >= 85
            ? 'up'
            : sleepEfficiency >= 70
              ? 'neutral'
              : 'down'
          : 'neutral',
        subLabel: efficiencySubtitle,
        accent: '#C4B5FD',
        icon: 'speedometer',
        trend: trendData.efficiency,
        chartType: 'dots',
        dotThreshold: 85,
        sheet: {
          id: 'efficiency',
          title: 'Efficiency',
          value: durationMinutes ? `${sleepEfficiency}` : '--',
          unit: durationMinutes ? '%' : undefined,
          subtitle: efficiencySubtitle,
          accent: '#C4B5FD',
          chartType: 'dots',
          dotThreshold: 85,
          trend: trendData.efficiency,
          rows: buildRows(trendData.efficiency, formatPercentRow),
        },
      },
      {
        id: 'stages',
        label: 'Sleep Stages',
        value: durationMinutes ? durationHoursValue : '--',
        unit: durationMinutes ? 'hr' : undefined,
        status: 'neutral',
        subLabel: durationMinutes ? 'Stage breakdown' : 'No data',
        accent: '#A7F3D0',
        icon: 'layers',
        chartType: 'stages',
        stages: stageItems,
        showDays: false,
        sheet: {
          id: 'stages',
          title: 'Sleep Stages',
          value: durationMinutes ? durationHoursValue : '--',
          unit: durationMinutes ? 'hr' : undefined,
          subtitle: durationMinutes ? 'Weekly stage mix' : 'No data',
          accent: '#A7F3D0',
          chartType: 'bars',
          trend: trendData.duration,
          rows: stageRows,
        },
      },
      {
        id: 'bed',
        label: 'Fell Asleep',
        value: bedtimeParts.time,
        unit: bedtimeParts.meridiem,
        status: 'neutral',
        subLabel: 'Bedtime',
        accent: '#93C5FD',
        icon: 'bed',
        trend: trendData.bed,
        chartType: 'line',
        sheet: {
          id: 'bed',
          title: 'Fell Asleep',
          value: formatTimeWithMeridiem(hi?.start_time),
          subtitle: 'Bedtime',
          accent: '#93C5FD',
          chartType: 'line',
          trend: trendData.bed,
          rows: buildRows(trendData.bed, formatTimeRow),
        },
      },
      {
        id: 'wake',
        label: 'Woke Up',
        value: wakeParts.time,
        unit: wakeParts.meridiem,
        status: 'neutral',
        subLabel: 'Wake time',
        accent: '#FDBA74',
        icon: 'alarm',
        trend: trendData.wake,
        chartType: 'ticks',
        sheet: {
          id: 'wake',
          title: 'Woke Up',
          value: formatTimeWithMeridiem(hi?.end_time),
          subtitle: 'Wake time',
          accent: '#FDBA74',
          chartType: 'ticks',
          trend: trendData.wake,
          rows: buildRows(trendData.wake, formatTimeRow),
        },
      },
    ];
  }, [
    bedtimeParts.meridiem,
    bedtimeParts.time,
    durationHoursValue,
    durationMinutes,
    hi?.end_time,
    hi?.start_time,
    sleepEfficiency,
    stageItems,
    trendData.bed,
    trendData.deep,
    trendData.duration,
    trendData.efficiency,
    trendData.light,
    trendData.rem,
    trendData.wake,
    wakeParts.meridiem,
    wakeParts.time,
    weekLabels,
  ]);

  const historyByDate = useMemo(() => {
    const map = new Map<string, any>();
    (weeklyHistory || []).forEach((item) => {
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
  }, [weeklyHistory, monthlyData]);

  const getGradientColorForKey = useCallback(
    (key: string) => {
      const item = cachedHistory.get(key) || historyByDate.get(key);
      if (!item) return BG_PRIMARY;
      return getSleepScoreGrade(item.sleep_score ?? 0).color;
    },
    [cachedHistory, historyByDate]
  );

  const { gradientBase, gradientOverlay, gradientProgress, gradientKey, setGradientKey } =
    useSleepGradient({
      initialKey: dateKey(selectedDate),
      defaultColor: BG_PRIMARY,
      getColorForKey: getGradientColorForKey,
    });

  const resolvedSheetChartType =
    activeMetric?.chartType && activeMetric.chartType !== 'stages'
      ? activeMetric.chartType
      : 'bars';

  const monthDates = useMemo(() => {
    const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const today = normalizeDate(new Date());
    const isCurrentMonth =
      selectedYear === today.getFullYear() && selectedMonth === today.getMonth();
    const maxDay = isCurrentMonth ? today.getDate() : lastDay;
    return Array.from({ length: lastDay }, (_, i) =>
      normalizeDate(new Date(selectedYear, selectedMonth, i + 1))
    ).filter((d) => d.getDate() <= maxDay);
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    const index = monthDates.findIndex((d) => isSameDay(d, selectedDate));
    if (index >= 0) {
      pagerRef.current?.scrollToIndex({ index, animated: true });
      setActiveIndex(index);
    }
  }, [selectedDate, monthDates]);

  const handlePagerEnd = (offsetX: number) => {
    const index = Math.round(offsetX / SCREEN_W);
    const next = monthDates[index];
    if (next && !isSameDay(next, selectedDate)) {
      setSelectedDate(next);
      setActiveIndex(index);
    }
    const nextKey = next ? dateKey(next) : gradientKey;
    setGradientKey(nextKey, true);
    navigation.getParent()?.setOptions({ swipeEnabled: true });
  };

  useEffect(() => {
    navigation.getParent()?.setOptions({ swipeEnabled: true });
  }, [navigation]);

  useEffect(() => {
    if (!monthDates.length) return;
    const initialMin = Math.max(0, activeIndex - 4);
    const initialMax = Math.min(monthDates.length - 1, activeIndex);
    setCacheRange({ min: initialMin, max: initialMax });
  }, [monthDates.length, activeIndex]);

  useEffect(() => {
    if (!monthDates.length) return;
    setCacheRange((prev) => {
      let min = prev.min;
      let max = prev.max;

      if (activeIndex < min + 1) {
        min = Math.max(0, activeIndex - 4);
      }
      if (activeIndex >= max - 1) {
        max = Math.min(monthDates.length - 1, activeIndex + 4);
      }

      if (min === prev.min && max === prev.max) return prev;
      return { min, max };
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
    if (!monthDates.length) return;
    const next = new Map(cachedHistory);
    for (let i = cacheRange.min; i <= cacheRange.max; i += 1) {
      const date = monthDates[i];
      if (!date) continue;
      const key = dateKey(date);
      if (next.has(key)) continue;
      const record = historyByDate.get(key) || null;
      next.set(key, record);
    }
    if (next.size !== cachedHistory.size) {
      setCachedHistory(next);
    }
  }, [cacheRange, monthDates, historyByDate, dateKey]);

  return (
    <View style={styles.container}>
      {/* Background Gradient */}
      <GradientBackground
        baseColor={gradientBase}
        overlayColor={gradientOverlay}
        progress={gradientProgress}
      />

      {/* Sticky Header */}
      <Animated.View
        pointerEvents={isHeaderInteractable ? 'auto' : 'none'}
        style={[styles.stickyHeader, { paddingTop: insets.top }, headerStyle]}>
        <LinearGradient colors={['#000000', 'rgba(0,0,0,0)']} style={StyleSheet.absoluteFill} />
        <View style={styles.stickyHeaderContent} />
      </Animated.View>

      <Animated.ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20 }]}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="white" />
        }>
        <View style={styles.contentWrap}>
          {/* Navigation Row */}
          <View style={styles.navRow}>
            {/* Back button removed as requested */}
            <View style={{ width: 44 }} />

            <View style={styles.rightIcons}>
              <Pressable style={styles.iconButton} onPress={() => setIsCalendarVisible(true)}>
                <Ionicons name="calendar-outline" size={20} color="white" />
              </Pressable>
              <Pressable style={styles.iconButton} onPress={() => setIsAddModalVisible(true)}>
                <Ionicons name="add" size={24} color="white" />
              </Pressable>
            </View>
          </View>
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
          history={weeklyHistory}
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

        <MetricDetailSheet
          isVisible={!!activeMetric}
          onClose={() => setActiveMetric(null)}
          title={activeMetric?.title || ''}
          value={activeMetric?.value || '--'}
          unit={activeMetric?.unit}
          subtitle={activeMetric?.subtitle}
          accent={activeMetric?.accent || '#7DD3FC'}
          chartType={resolvedSheetChartType}
          dotThreshold={activeMetric?.dotThreshold}
          trend={activeMetric?.trend}
          rows={activeMetric?.rows}
        />

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
            removeClippedSubviews
            onScrollBeginDrag={() => {
              navigation.getParent()?.setOptions({ swipeEnabled: false });
            }}
            onMomentumScrollEnd={(event) => handlePagerEnd(event.nativeEvent.contentOffset.x)}
            onScrollEndDrag={() => {
              navigation.getParent()?.setOptions({ swipeEnabled: true });
            }}
            onTouchStart={() => {
              navigation.getParent()?.setOptions({ swipeEnabled: false });
            }}
            onTouchEnd={() => {
              navigation.getParent()?.setOptions({ swipeEnabled: true });
            }}
            renderItem={({ item, index }) => {
              const shouldPrefetch = Math.abs(index - activeIndex) <= 1;
              const itemDateStr = dateKey(item);
              const itemHistory =
                cachedHistory.get(itemDateStr) ||
                (shouldPrefetch ? historyByDate.get(itemDateStr) || null : null);
              const itemHasData = !!itemHistory;
              const itemGrade = getSleepScoreGrade(itemHistory?.sleep_score ?? 0);
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
                      {itemHistory?.sleep_score !== undefined ? itemGrade.grade : '--'}
                    </Text>
                    <Text style={styles.dateLabel}>
                      {item.toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </Text>
                    <Text style={styles.description}>
                      {itemHasData
                        ? 'Your sleep duration last night was above your goal, providing optimal restorative sleep for complete recovery. You barely stirred awake last night - great stuff.'
                        : 'No sleep data yet for this day. Add a record to see your score and trends.'}
                    </Text>
                  </View>
                </View>
              );
            }}
          />
        </View>

        <View style={styles.contentWrap}>
          {hasData ? (
            <>
              <SleepMetricsList
                metrics={metricCards}
                onMetricPress={(metric) => {
                  setActiveMetric(metric);
                }}
              />

              {/* Chart Section */}
              <View style={styles.chartSection}>
                <View style={styles.labelRow}>
                  <Text style={styles.chartTitle}>Sleep Stages</Text>
                  <Ionicons
                    name="information-circle"
                    size={16}
                    color={TEXT_SECONDARY}
                    style={{ marginLeft: 6 }}
                  />
                </View>

                {/*   <HypnogramChart
                  stages={hypnogramStages}
                  startTime={hi?.start_time || new Date().toISOString()}
                  endTime={hi?.end_time || new Date().toISOString()}
                  height={180}
                /> */}

                {/* Time Labels for Chart */}
                <View style={styles.chartTimeLabels}>
                  <Text style={styles.chartTimeText}>
                    {formatTimeWithMeridiem(hi?.start_time)}
                  </Text>
                  <Text style={styles.chartTimeText}>
                    {formatTimeWithMeridiem(hi?.end_time)}
                  </Text>
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

        {/* Bottom Tab Bar Placeholder Spacer */}
        <View style={{ height: 100 }} />
      </Animated.ScrollView>
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
    paddingHorizontal: 20,
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
    width: 44,
    height: 44,
    borderRadius: UI_RADIUS,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: STROKE,
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
  dateLabel: {
    color: TEXT_SECONDARY,
    fontSize: 15,
    marginBottom: 16,
  },
  description: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 17,
    lineHeight: 24,
  },
  emptyState: {
    borderRadius: UI_RADIUS,
    padding: 22,
    backgroundColor: SURFACE_ALT,
    borderWidth: 1,
    borderColor: STROKE,
  },
  emptyBadge: {
    width: 44,
    height: 44,
    borderRadius: UI_RADIUS,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: STROKE,
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
    color: TEXT_TERTIARY,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  emptyButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: UI_RADIUS,
  },
  emptyButtonText: {
    color: 'black',
    fontSize: 14,
    fontWeight: '700',
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
