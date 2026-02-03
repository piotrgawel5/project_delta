import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  RefreshControl,
  Dimensions,
  Alert,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { HypnogramChart } from '../../components/sleep/dashboard/HypnogramChart';
import { SleepCalendar } from '../../components/sleep/SleepCalendar';
import { AddSleepRecordModal } from '../../components/sleep/AddSleepRecordModal';
import { router } from 'expo-router';
import { transformToHypnogramStages } from '@lib/sleepTransform';

// Colors matching the "Outsiders" reference screenshot
// Deep Purple Gradient
const BG_PRIMARY = '#000000';
const GRADIENT_START = '#581C87'; // Purple-900/800 mix
const TEXT_SECONDARY = 'rgba(255, 255, 255, 0.7)';
const STATUS_GREEN = '#22C55E'; // Green-500

const MetricItem = ({ label, value, unit, status, statusIcon = 'checkmark-circle' }: any) => (
  <View style={styles.metricItem}>
    <View style={styles.metricHeader}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Ionicons
        name="information-circle"
        size={14}
        color={TEXT_SECONDARY}
        style={{ marginLeft: 4 }}
      />
    </View>
    <View style={styles.metricValueContainer}>
      <Text style={styles.metricValue}>{value}</Text>
      {unit && <Text style={styles.metricUnit}>{unit}</Text>}
    </View>
    <View style={styles.metricStatusRow}>
      <Ionicons name={statusIcon as any} size={14} color={STATUS_GREEN} />
      <Text style={styles.metricStatusText}>{status}</Text>
    </View>
  </View>
);

export default function SleepScreen() {
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);

  const { weeklyHistory, loading, fetchSleepData, checkHealthConnectStatus } = useSleepStore();

  const [selectedDayIndex, setSelectedDayIndex] = useState(6);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isCalendarVisible, setIsCalendarVisible] = useState(false);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isHeaderInteractable, setIsHeaderInteractable] = useState(false);

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

  const currentData = (() => {
    // If we have specific date selected via calendar:
    // We should ideally search in history for that date.
    // BUT, the current store might only hold ~7 days.
    // Implementing purely UI selection for now as requested generally.

    // For this task, let's use the selectedDate state
    const targetDateStr = selectedDate.toISOString().split('T')[0];

    // Safe access to weeklyHistory
    const hist = weeklyHistory || [];

    // Find item if exists
    const displayItem = hist.find((item) => item.date === targetDateStr);

    // Fallback logic if needed, but for now exact date match or null
    // If we wanted to fallback to yesterday for "Last Night" context if today has no data yet?
    // Kept simple: specific date or nothing/mock.
    // The previous code had a fallback to 'weeklyHistory[weeklyHistory.length - 1]' if not found.
    // Let's keep a fallback if it's TODAY and there is no data, maybe show yesterday?
    // Actually, user wants to select dates. If no data, displayItem is undefined. UI handles nulls.

    return {
      historyItem: displayItem || null,
      fullDate: selectedDate.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
    };
  })();

  const hi = currentData.historyItem;

  // Metrics
  const duration = formatDuration(hi?.duration_minutes || 0);
  const restorativeMin = (hi?.deep_sleep_minutes || 0) + (hi?.rem_sleep_minutes || 0);
  const restorative = formatDuration(restorativeMin);

  // Times
  const formatTime = (iso?: string) => {
    if (!iso) return '--:--';
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }).replace(' ', '');
  };

  const startTime = hi?.start_time ? new Date(hi.start_time) : null;
  const endTime = hi?.end_time ? new Date(hi.end_time) : null;

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

  return (
    <View style={styles.container}>
      {/* Background Gradient */}
      <LinearGradient
        colors={[GRADIENT_START, BG_PRIMARY, BG_PRIMARY]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Sticky Header */}
      <Animated.View
        pointerEvents={isHeaderInteractable ? 'auto' : 'none'}
        style={[styles.stickyHeader, { paddingTop: insets.top }, headerStyle]}>
        <View style={styles.stickyHeaderContent}>
          <Text style={styles.stickyTitle}>Sleep</Text>
        </View>
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
          onSave={(start, end) => {
            console.log('Save record:', start, end);
            // In a real app this would trigger store.forceSaveManualSleep
            // For now, UI only as requested.
          }}
        />

        {/* Title Section */}
        <View style={styles.titleSection}>
          <View style={styles.labelRow}>
            <Ionicons name="moon" size={16} color="#A855F7" />
            <Text style={styles.sectionLabel}>Sleep</Text>
          </View>
          <Text style={styles.mainRating}>Excellent</Text>
          <Text style={styles.dateLabel}>{currentData.fullDate}</Text>
          <Text style={styles.description}>
            Your sleep duration last night was above your goal, providing optimal restorative sleep
            for complete recovery. You barely stirred awake last night - great stuff.
          </Text>
        </View>

        {/* Metrics Grid */}
        <View style={styles.metricsGrid}>
          <View style={styles.gridRow}>
            <MetricItem
              label="Sleep Duration"
              value={`${duration.h}h ${duration.m}m`}
              status="ABOVE NORMAL"
            />
            <MetricItem
              label="Restorative Sleep"
              value={`${restorative.h}h ${restorative.m}m`}
              status="ABOVE NORMAL"
            />
          </View>
          <View style={styles.gridRow}>
            <MetricItem
              label="Fell Asleep At"
              value={formatTime(hi?.start_time).replace(/(AM|PM)/, '')}
              unit={startTime ? (startTime.getHours() >= 12 ? 'PM' : 'AM') : ''}
              status="EARLIER THAN USUAL"
            />
            <MetricItem
              label="Woke Up At"
              value={formatTime(hi?.end_time).replace(/(AM|PM)/, '')}
              unit={endTime ? (endTime.getHours() >= 12 ? 'PM' : 'AM') : ''}
              status="AS USUAL"
            />
          </View>
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

          <HypnogramChart
            stages={hypnogramStages}
            startTime={hi?.start_time || new Date().toISOString()}
            endTime={hi?.end_time || new Date().toISOString()}
            height={180}
          />

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
    backgroundColor: 'rgba(0,0,0,0.85)',
    zIndex: 100,
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
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
    fontSize: 48,
    fontWeight: '700',
    marginBottom: 4,
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
    gap: 24,
    marginBottom: 32,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricItem: {
    flex: 1,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  metricLabel: {
    color: TEXT_SECONDARY,
    fontSize: 15,
  },
  metricValueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  metricValue: {
    color: 'white',
    fontSize: 34,
    fontWeight: '600',
    letterSpacing: -1,
  },
  metricUnit: {
    color: TEXT_SECONDARY,
    fontSize: 18,
    marginLeft: 4,
  },
  metricStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricStatusText: {
    color: TEXT_SECONDARY,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
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
