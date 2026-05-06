import { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  interpolate,
  type SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useAuthStore } from '@store/authStore';
import { useProfileStore } from '@store/profileStore';
import { useSleepStore } from '@store/sleepStore';
import { SLEEP_LAYOUT, SLEEP_THEME } from '@constants';
import { getSleepScoreGrade } from '@lib/sleepColors';
import { formatTimeParts, getSleepDescription } from '@lib/sleepFormatters';
import { addDays, dateKey, isSameDay, normalizeDate } from '@lib/sleepDateUtils';
import { calculateWeeklyDelta, deriveWeekSeries } from '@lib/sleepWeeklyInsights';
import { SleepCalendar } from '../../components/sleep/SleepCalendar';
import { AddSleepRecordModal } from '../../components/sleep/AddSleepRecordModal';
import SleepCardBedtime from '../../components/sleep/redesign/SleepCardBedtime';
import SleepCardDeep from '../../components/sleep/redesign/SleepCardDeep';
import SleepEditLink from '../../components/sleep/redesign/SleepEditLink';
import SleepEmptyState from '../../components/sleep/redesign/SleepEmptyState';
import SleepHero from '../../components/sleep/redesign/SleepHero';
import { FullScreenSkeleton } from '../../components/sleep/redesign/SleepSkeletons';
import SleepTimelineSection from '../../components/sleep/SleepTimelineSection';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type SleepRecordLike = {
  id: string;
  user_id: string;
  date: string;
  start_time?: string | null;
  end_time?: string | null;
  duration_minutes?: number | null;
  deep_sleep_minutes?: number | null;
  sleep_score?: number | null;
  score_breakdown?: {
    score?: number | null;
  } | null;
};

function resolveSleepScore(item: SleepRecordLike | null): number | undefined {
  if (!item) return undefined;
  if (typeof item.score_breakdown?.score === 'number') {
    return Math.round(item.score_breakdown.score);
  }
  if (typeof item.sleep_score === 'number') {
    return Math.round(item.sleep_score);
  }
  return undefined;
}

function AnimatedBlurHeader({
  scrollY,
  threshold,
  insetTop,
}: {
  scrollY: SharedValue<number>;
  threshold: number;
  insetTop: number;
}) {
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [threshold, threshold + 30], [0, 1], 'clamp'),
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.blurHeader, { height: insetTop + 56 }, animatedStyle]}>
      <BlurView
        intensity={SLEEP_THEME.navbarBlurIntensity}
        tint="dark"
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.blurHeaderFill} />
    </Animated.View>
  );
}

export default function SleepScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const { user } = useAuthStore();
  const profile = useProfileStore((s) => s.profile);
  const recentHistory = useSleepStore((s) => s.recentHistory);
  const monthlyData = useSleepStore((s) => s.monthlyData);
  const fetchSleepDataRange = useSleepStore((s) => s.fetchSleepDataRange);
  const forceSaveManualSleep = useSleepStore((s) => s.forceSaveManualSleep);
  const loading = useSleepStore((s) => s.loading);

  const [selectedDate, setSelectedDate] = useState(() => normalizeDate(new Date()));
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isCalendarVisible, setIsCalendarVisible] = useState(false);
  const [dateFetchStatus, setDateFetchStatus] = useState<Record<string, 'pending' | 'done'>>({});
  const [activeIndex, setActiveIndex] = useState(0);
  const pagerRef = useRef<FlatList<Date>>(null);
  const pagerScrollX = useSharedValue(0);
  const instantTransitionRef = useRef(false);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);

  const selectedDateKey = useMemo(() => dateKey(selectedDate), [selectedDate]);
  const selectedYear = selectedDate.getFullYear();
  const selectedMonth = selectedDate.getMonth();

  const monthDates = useMemo(() => {
    const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const today = normalizeDate(new Date());
    const isCurrentMonth =
      selectedYear === today.getFullYear() && selectedMonth === today.getMonth();
    const maxDay = isCurrentMonth ? today.getDate() : lastDay;

    return Array.from({ length: lastDay }, (_, index) =>
      normalizeDate(new Date(selectedYear, selectedMonth, index + 1))
    ).filter((date) => date.getDate() <= maxDay);
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    const index = monthDates.findIndex((date) => isSameDay(date, selectedDate));
    if (index >= 0) {
      setActiveIndex(index);
      pagerRef.current?.scrollToIndex({ index, animated: false });
    }
  }, [monthDates, pagerRef, selectedDate]);

  const currentData = useMemo(() => {
    const hist = recentHistory as SleepRecordLike[];
    let displayItem = hist.find((item) => item.date === selectedDateKey) || null;

    if (!displayItem) {
      const monthKey = selectedDateKey.substring(0, 7);
      const monthRecords = monthlyData[monthKey] as SleepRecordLike[] | undefined;
      displayItem = monthRecords?.find((item) => item.date === selectedDateKey) || null;
    }

    return {
      historyItem: displayItem,
    };
  }, [monthlyData, recentHistory, selectedDateKey]);

  useEffect(() => {
    if (!user?.id) return;
    if (currentData.historyItem) {
      setDateFetchStatus((current) =>
        current[selectedDateKey] === 'done' ? current : { ...current, [selectedDateKey]: 'done' }
      );
      return;
    }

    if (dateFetchStatus[selectedDateKey]) return;

    setDateFetchStatus((current) => ({ ...current, [selectedDateKey]: 'pending' }));
    void fetchSleepDataRange(user.id, addDays(selectedDate, -3), addDays(selectedDate, 3))
      .catch((error) => {
        console.warn('[SleepScreen] Date range fetch failed', error);
      })
      .finally(() => {
        setDateFetchStatus((current) => ({ ...current, [selectedDateKey]: 'done' }));
      });
  }, [
    currentData.historyItem,
    dateFetchStatus,
    fetchSleepDataRange,
    selectedDate,
    selectedDateKey,
    user?.id,
  ]);

  useEffect(() => {
    if (!user?.id || !monthDates.length) return;

    if (activeIndex >= monthDates.length - 2) {
      void fetchSleepDataRange(user.id, addDays(selectedDate, 1), addDays(selectedDate, 7));
    }

    if (activeIndex <= 1) {
      void fetchSleepDataRange(user.id, addDays(selectedDate, -7), addDays(selectedDate, -1));
    }
  }, [activeIndex, fetchSleepDataRange, monthDates.length, selectedDate, user?.id]);

  const weekData = useMemo(
    () =>
      deriveWeekSeries(
        recentHistory as SleepRecordLike[],
        monthlyData as Record<string, SleepRecordLike[]>,
        selectedDate
      ),
    [monthlyData, recentHistory, selectedDate]
  );

  const score = resolveSleepScore(currentData.historyItem);
  const gradeInfo = getSleepScoreGrade(score ?? 0);
  const heroGrade = score === undefined ? '--' : gradeInfo.grade;
  const heroColor = score === undefined ? SLEEP_THEME.elevatedBg : gradeInfo.color;

  const prevNextGrades = useMemo(() => {
    const hist = recentHistory as SleepRecordLike[];
    const gradeForIndex = (idx: number): string => {
      const date = monthDates[idx];
      if (!date) return heroGrade;
      const key = dateKey(date);
      const monthKey = key.substring(0, 7);
      const item =
        hist.find((r) => r.date === key) ??
        (monthlyData[monthKey] as SleepRecordLike[] | undefined)?.find((r) => r.date === key) ??
        null;
      const s = resolveSleepScore(item);
      return s === undefined ? heroGrade : getSleepScoreGrade(s).grade;
    };
    return {
      prevGrade: gradeForIndex(activeIndex - 1),
      nextGrade: gradeForIndex(activeIndex + 1),
    };
  }, [activeIndex, monthDates, recentHistory, monthlyData, heroGrade]);
  const description =
    score === undefined || !currentData.historyItem?.duration_minutes
      ? 'No sleep data recorded for this day yet.'
      : getSleepDescription(score, currentData.historyItem.duration_minutes);
  const weeklyDelta = calculateWeeklyDelta(score, weekData.scores, weekData.todayIndex);
  const bedtimeParts = useMemo(() => {
    if (!currentData.historyItem?.start_time) return null;
    const parts = formatTimeParts(currentData.historyItem.start_time);
    return parts.meridiem ? { time: parts.time, meridiem: parts.meridiem } : null;
  }, [currentData.historyItem?.start_time]);

  const wakeTimeParts = useMemo(() => {
    if (!currentData.historyItem?.end_time) return null;
    const parts = formatTimeParts(currentData.historyItem.end_time);
    return parts.meridiem ? { time: parts.time, meridiem: parts.meridiem } : null;
  }, [currentData.historyItem?.end_time]);
  const isLoading =
    loading || (!currentData.historyItem && dateFetchStatus[selectedDateKey] !== 'done');

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  const backdropBlurStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, SLEEP_LAYOUT.heroHeight * 0.9], [0, 1], 'clamp'),
  }));

  const handlePagerEnd = (offsetX: number) => {
    const index = Math.round(offsetX / SCREEN_WIDTH);
    const next = monthDates[index];
    if (!next || isSameDay(next, selectedDate)) return;

    instantTransitionRef.current = true;
    setSwipeDirection(index > activeIndex ? 'right' : 'left');
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDate(next);
    setActiveIndex(index);
    navigation.getParent()?.setOptions({ swipeEnabled: true });
  };

  const cardContainerStyle = useMemo(
    () => ({
      paddingTop: SLEEP_LAYOUT.heroHeight + 24,
      paddingBottom: SLEEP_LAYOUT.scrollBottomPad,
      paddingHorizontal: SLEEP_LAYOUT.screenPaddingH,
      gap: SLEEP_LAYOUT.cardGap,
    }),
    []
  );

  return (
    <View style={styles.container}>
      <View pointerEvents="box-none" style={styles.heroLayer}>
        <SleepHero
          selectedDate={selectedDate}
          score={score}
          grade={heroGrade}
          gradeColor={heroColor}
          durationMinutes={currentData.historyItem?.duration_minutes ?? null}
          description={description}
          weeklyDelta={weeklyDelta}
          isLoading={isLoading}
          chartData={weekData.durations}
          todayIndex={weekData.todayIndex}
          targetMinutes={480}
          onPressDate={() => setIsCalendarVisible(true)}
          pagerScrollX={pagerScrollX}
          pageIndex={activeIndex}
          prevGrade={prevNextGrades.prevGrade}
          nextGrade={prevNextGrades.nextGrade}
          instantTransitionRef={instantTransitionRef}
          swipeDirection={swipeDirection}
        />
      </View>

      <FlatList
        ref={(ref) => {
          pagerRef.current = ref;
        }}
        data={monthDates}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={styles.heroPager}
        renderItem={() => <View style={styles.pagerItem} />}
        keyExtractor={(item) => dateKey(item)}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
        initialScrollIndex={activeIndex}
        scrollEventThrottle={16}
        onScroll={(event) => {
          pagerScrollX.value = event.nativeEvent.contentOffset.x;
        }}
        onScrollBeginDrag={() => {
          navigation.getParent()?.setOptions({ swipeEnabled: false });
        }}
        onScrollEndDrag={() => {
          navigation.getParent()?.setOptions({ swipeEnabled: true });
        }}
        onMomentumScrollEnd={(event) => handlePagerEnd(event.nativeEvent.contentOffset.x)}
      />

      {!isLoading && (
        <Pressable
          style={styles.dateOverlay}
          onPress={() => setIsCalendarVisible(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        />
      )}

      <Animated.View pointerEvents="none" style={[styles.backdropBlur, backdropBlurStyle]}>
        <BlurView
          intensity={48}
          tint="dark"
          experimentalBlurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <AnimatedBlurHeader
        scrollY={scrollY}
        threshold={SLEEP_LAYOUT.heroHeight * 0.6}
        insetTop={insets.top}
      />

      <Animated.ScrollView
        style={styles.cardsScroll}
        contentContainerStyle={cardContainerStyle}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <FullScreenSkeleton />
        ) : (
          <Animated.View
            key={`cards-${selectedDateKey}`}
            exiting={FadeOut.duration(150)}
            style={styles.cardTransitionWrap}>
            {!currentData.historyItem ? (
              <Animated.View entering={FadeIn.duration(300).delay(220)}>
                <SleepEmptyState date={selectedDate} onAddData={() => setIsAddModalVisible(true)} />
              </Animated.View>
            ) : (
              <>
                <Animated.View entering={FadeInDown.duration(400).delay(220)}>
                  <SleepCardBedtime
                    bedtime={bedtimeParts}
                    wakeTime={wakeTimeParts}
                    weekBedtimes={weekData.bedtimes}
                    weekWakeTimes={weekData.wakeTimes}
                    todayIndex={weekData.todayIndex}
                  />
                </Animated.View>
                <Animated.View entering={FadeInDown.duration(400).delay(270)}>
                  <SleepCardDeep
                    deepMinutes={currentData.historyItem.deep_sleep_minutes ?? null}
                    totalMinutes={currentData.historyItem.duration_minutes ?? null}
                  />
                </Animated.View>
                <Animated.View entering={FadeInDown.duration(400).delay(320)}>
                  <SleepTimelineSection
                    userId={user?.id ?? null}
                    date={selectedDateKey}
                    plan={profile?.plan ?? null}
                    startTimeIso={currentData.historyItem?.start_time ?? null}
                    endTimeIso={currentData.historyItem?.end_time ?? null}
                    totalDurationMinutes={currentData.historyItem?.duration_minutes ?? null}
                  />
                </Animated.View>
                <SleepEditLink onPress={() => setIsAddModalVisible(true)} />
              </>
            )}
          </Animated.View>
        )}
      </Animated.ScrollView>

      <SleepCalendar
        isVisible={isCalendarVisible}
        onClose={() => setIsCalendarVisible(false)}
        selectedDate={selectedDate}
        onDateSelect={(date) => {
          setSwipeDirection(null);
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setSelectedDate(normalizeDate(date));
        }}
      />

      <AddSleepRecordModal
        isVisible={isAddModalVisible}
        onClose={() => setIsAddModalVisible(false)}
        onSave={async (start, end) => {
          if (!user?.id) return false;
          return forceSaveManualSleep(user.id, start.toISOString(), end.toISOString());
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
    backgroundColor: SLEEP_THEME.screenBg,
  },
  heroLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 0,
    overflow: 'visible',
  },
  backdropBlur: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 3,
  },
  dateOverlay: {
    position: 'absolute',
    top: SLEEP_LAYOUT.heroTextPaddingTop,
    left: SLEEP_LAYOUT.heroTextPaddingH,
    height: 28,
    paddingHorizontal: 4,
    alignSelf: 'flex-start',
    zIndex: 7,
    // Width determined by content — use a fixed estimate matching the date label
    width: 120,
  },
  heroPager: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SLEEP_LAYOUT.heroHeight,
    zIndex: 6,
    backgroundColor: 'transparent',
  },
  pagerItem: {
    width: SCREEN_WIDTH,
    height: SLEEP_LAYOUT.heroHeight,
    backgroundColor: 'transparent',
  },
  blurHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 4,
  },
  blurHeaderFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: SLEEP_THEME.navbarBg,
  },
  cardTransitionWrap: {
    gap: SLEEP_LAYOUT.cardGap,
  },
  cardsScroll: {
    position: 'relative',
    zIndex: 5,
  },
});
