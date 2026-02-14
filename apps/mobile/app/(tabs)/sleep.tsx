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
  withTiming,
  Easing,
  SharedValue,
} from 'react-native-reanimated';
import Svg, { Rect, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { SleepCalendar } from '../../components/sleep/SleepCalendar';
import { AddSleepRecordModal } from '../../components/sleep/AddSleepRecordModal';
import { transformToHypnogramStages } from '@lib/sleepTransform';
import { getSleepScoreGrade, brightenColor } from '@lib/sleepColors';
import { formatTime } from '@lib/sleepFormatters';
import MetricCard from '@components/sleep/MetricCard';

// Colors
const BG_PRIMARY = '#000000';
const TEXT_SECONDARY = 'rgba(255, 255, 255, 0.7)';
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const BG_WIDTH = SCREEN_W;
const BG_HEIGHT = SCREEN_H;
const UI_RADIUS = 36;
const AnimatedRect = Animated.createAnimatedComponent(Rect);

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
  const [activeIndex, setActiveIndex] = useState(0);
  const selectedYear = selectedDate.getFullYear();
  const selectedMonth = selectedDate.getMonth();
  const gradientProgress = useSharedValue(1);
  const [gradientBase, setGradientBase] = useState('#000000');
  const [gradientOverlay, setGradientOverlay] = useState('#000000');
  const [cacheRange, setCacheRange] = useState({ min: 0, max: 0 });
  const [cachedHistory, setCachedHistory] = useState<Map<string, any>>(new Map());
  const [gradientDateKey, setGradientDateKey] = useState(() => dateKey(selectedDate));
  const gradientInitialized = useRef(false);

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
  const duration = formatDuration(hi?.duration_minutes || 0);
  const restorativeMin = (hi?.deep_sleep_minutes || 0) + (hi?.rem_sleep_minutes || 0);
  const restorative = formatDuration(restorativeMin);

  // Times
  const startTime = hi?.start_time ? new Date(hi.start_time) : null;
  const endTime = hi?.end_time ? new Date(hi.end_time) : null;

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

  // Compute sparkline data from weekly history (last 7 days, chronological order)
  const sparklineData = useMemo(() => {
    const history = weeklyHistory || [];
    if (history.length < 2) {
      return { duration: undefined, restorative: undefined };
    }

    // Sort chronologically (oldest first) for proper sparkline trend
    const sorted = [...history]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-7); // Last 7 days

    const durationData = sorted.map((item) => item.duration_minutes || 0);
    const restorativeData = sorted.map(
      (item) => (item.deep_sleep_minutes || 0) + (item.rem_sleep_minutes || 0)
    );

    return {
      duration: durationData.length >= 2 ? durationData : undefined,
      restorative: restorativeData.length >= 2 ? restorativeData : undefined,
    };
  }, [weeklyHistory]);

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

  const setGradientImmediate = useCallback((color: string) => {
    setGradientBase(color);
    setGradientOverlay(color);
    gradientProgress.value = 1;
  }, []);

  const animateGradientTo = useCallback((color: string) => {
    setGradientBase(gradientOverlay);
    setGradientOverlay(color);
    gradientProgress.value = 0;
    gradientProgress.value = withTiming(1, {
      duration: 600,
      easing: Easing.out(Easing.cubic),
    });
  }, [gradientOverlay]);

  useEffect(() => {
    if (gradientInitialized.current) return;
    const initial = getGradientColorForKey(gradientDateKey);
    setGradientImmediate(initial);
    gradientInitialized.current = true;
  }, [getGradientColorForKey, gradientDateKey, setGradientImmediate]);

  useEffect(() => {
    if (!gradientInitialized.current) return;
    const target = getGradientColorForKey(gradientDateKey);
    if (gradientOverlay !== target && gradientProgress.value >= 1) {
      setGradientImmediate(target);
    }
  }, [getGradientColorForKey, gradientDateKey, setGradientImmediate, gradientOverlay]);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const monthDates = useMemo(() => {
    const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    return Array.from({ length: lastDay }, (_, i) =>
      normalizeDate(new Date(selectedYear, selectedMonth, i + 1))
    );
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
      setGradientDateKey(dateKey(next));
    }
    const nextKey = next ? dateKey(next) : gradientDateKey;
    const targetColor = getGradientColorForKey(nextKey);
    animateGradientTo(targetColor);
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
            setGradientDateKey(dateKey(normalized));
            const targetColor = getGradientColorForKey(dateKey(normalized));
            animateGradientTo(targetColor);
          }}
          history={weeklyHistory}
        />

        <AddSleepRecordModal
          isVisible={isAddModalVisible}
          onClose={() => setIsAddModalVisible(false)}
          onSave={async (start, end) => {
            console.log('Save record:', start, end);
            // In a real app this would trigger store.forceSaveManualSleep
            // For now, UI only as requested.
            return true;
          }}
          date={selectedDate}
          userId={user?.id || ''}
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
              {/* Metrics Grid */}
              <View style={styles.metricsGrid}>
                <MetricCard
                  label="Sleep Duration"
                  value={`${duration.h}h ${duration.m}m`}
                  status={duration.h >= 7 ? 'up' : 'neutral'}
                  sparkline={sparklineData.duration}
                  onPress={() => {
                    /* open detail or chart */
                  }}
                />

                <MetricCard
                  label="Restorative"
                  value={`${restorative.h}h ${restorative.m}m`}
                  status={restorative.h >= 2 ? 'up' : 'neutral'}
                  sparkline={sparklineData.restorative}
                  onPress={() => {}}
                />

                <MetricCard
                  label="Fell Asleep"
                  value={formatTime(hi?.start_time).replace(/(AM|PM)/, '')}
                  unit={startTime ? (startTime.getHours() >= 12 ? 'PM ' : 'AM ') : undefined}
                  status="neutral"
                />

                <MetricCard
                  label="Woke Up"
                  value={formatTime(hi?.end_time).replace(/(AM|PM)/, '')}
                  unit={endTime ? (endTime.getHours() >= 12 ? 'PM ' : 'AM ') : undefined}
                  status="neutral"
                />
              </View>

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
                  <Text style={styles.chartTimeText}>{formatTime(hi?.start_time)}</Text>
                  <Text style={styles.chartTimeText}>{formatTime(hi?.end_time)}</Text>
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
    backgroundColor: 'rgba(255,255,255,0.1)',
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
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12, // keep visual rhythm
    marginBottom: 32,
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
