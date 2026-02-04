import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Text,
  RefreshControl,
  Pressable,
  InteractionManager,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useAuthStore } from '@store/authStore';
import { useSleepStore } from '@store/sleepStore';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  useAnimatedReaction,
  runOnJS,
} from 'react-native-reanimated';
import { SleepCalendar } from '../../components/sleep/AppleSleepCalendar';
import { TypewriterText } from '../../components/ui/TypewriterText';
import { AddSleepRecordModal } from '../../components/sleep/AddSleepRecordModal';
import { transformToHypnogramStages } from '@lib/sleepTransform';
import { getSleepScoreGrade, brightenColor } from '@lib/sleepColors';
import { formatTime } from '@lib/sleepFormatters';
import MetricCard from '@components/sleep/MetricCard';

// Colors
const BG_PRIMARY = '#000000';
const TEXT_SECONDARY = 'rgba(255, 255, 255, 0.7)';
const STATUS_GREEN = '#22C55E';
const { width: SCREEN_W } = Dimensions.get('window');

export default function SleepScreen() {
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);

  const { weeklyHistory, monthlyData, loading, fetchSleepData, checkHealthConnectStatus } =
    useSleepStore();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isCalendarVisible, setIsCalendarVisible] = useState(false);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isHeaderInteractable, setIsHeaderInteractable] = useState(false);
  const [isNavigated, setIsNavigated] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        setIsNavigated(true);
      });

      return () => {
        task.cancel();
        setIsNavigated(false);
      };
    }, [])
  );

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
    const targetDateStr = selectedDate.toISOString().split('T')[0];

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
  }, [selectedDate, weeklyHistory, monthlyData]);

  const hi = currentData.historyItem;

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

  return (
    <View style={styles.container}>
      {/* Background Gradient */}
      <LinearGradient
        colors={[sleepScoreGrade.color, BG_PRIMARY, BG_PRIMARY]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
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

        <SleepCalendar
          isVisible={isCalendarVisible}
          onClose={() => setIsCalendarVisible(false)}
          selectedDate={selectedDate}
          onDateSelect={setSelectedDate}
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

        {/* Title Section */}
        <View style={styles.titleSection}>
          <View style={styles.labelRow}>
            <Ionicons name="moon" size={16} color={brightenColor(sleepScoreGrade.color)} />
            <Text style={[styles.sectionLabel, { color: brightenColor(sleepScoreGrade.color) }]}>
              Sleep
            </Text>
          </View>
          <Text style={styles.mainRating}>
            {currentData.historyItem?.sleep_score !== undefined ? sleepScoreGrade.grade : '--'}
          </Text>
          <Text style={styles.dateLabel}>{currentData.fullDate}</Text>
          <TypewriterText
            text="Your sleep duration last night was above your goal, providing optimal restorative sleep for complete recovery. You barely stirred awake last night - great stuff."
            style={styles.description}
            trigger={!loading && isNavigated}
          />
        </View>

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
            unit={startTime ? (startTime.getHours() >= 12 ? 'PM' : 'AM') : undefined}
            status="neutral"
          />

          <MetricCard
            label="Woke Up"
            value={formatTime(hi?.end_time).replace(/(AM|PM)/, '')}
            unit={endTime ? (endTime.getHours() >= 12 ? 'PM' : 'AM') : undefined}
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
    paddingHorizontal: 20,
    paddingBottom: 40,
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
    borderRadius: 22,
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
