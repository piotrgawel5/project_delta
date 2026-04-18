import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, {
  FadeInDown,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useAuthStore } from '@store/authStore';
import { useWorkoutStore } from '@store/workoutStore';
import { SLEEP_FONTS, SLEEP_LAYOUT, SLEEP_THEME, WORKOUT_THEME } from '@constants';
import { computeWeeklyVolume } from '@lib/workoutAnalytics';
import WorkoutHeroShell from '@components/workout/WorkoutHeroShell';
import WorkoutWeekGrid from '@components/workout/WorkoutWeekGrid';
import WorkoutEmptyState from '@components/workout/WorkoutEmptyState';

const SPRING_FAB = { damping: 16, stiffness: 220 } as const;
const FAB_SIZE = 58;
const FAB_BOTTOM = 96;
const FAB_RIGHT = 20;

function AnimatedBlurHeader({
  scrollY,
  threshold,
  insetTop,
}: {
  scrollY: ReturnType<typeof useSharedValue<number>>;
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

export default function WorkoutScreen() {
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const fabScale = useSharedValue(1);
  const router = useRouter();
  const { user } = useAuthStore();

  const sessions = useWorkoutStore((s) => s.sessions);
  const isLoaded = useWorkoutStore((s) => s.isLoaded);
  const startWorkout = useWorkoutStore((s) => s.startWorkout);

  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const totalSets = useMemo(() => computeWeeklyVolume(sessions), [sessions]);

  const thisWeekSessions = useMemo(() => {
    const now = new Date();
    const monday = new Date(now);
    const day = monday.getDay();
    monday.setDate(monday.getDate() + (day === 0 ? -6 : 1 - day));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return sessions.filter((s) => {
      const d = new Date(s.date);
      return d >= monday && d <= sunday;
    });
  }, [sessions]);

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const fabAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fabScale.value }],
  }));

  const handleStartWorkout = useCallback(() => {
    if (!user?.id) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    startWorkout(user.id);
    router.push('/workout/active');
  }, [user?.id, startWorkout, router]);

  const cardContentStyle = useMemo(
    () => ({
      paddingTop: SLEEP_LAYOUT.heroHeight + 16,
      paddingBottom: SLEEP_LAYOUT.scrollBottomPad,
      gap: SLEEP_LAYOUT.cardGap,
    }),
    []
  );

  return (
    <View style={styles.container}>
      <View pointerEvents="box-none" style={styles.heroLayer}>
        <WorkoutHeroShell totalSets={totalSets} weeklyDelta={null} selectedDate={selectedDate} />
      </View>

      <AnimatedBlurHeader
        scrollY={scrollY}
        threshold={SLEEP_LAYOUT.heroHeight * 0.6}
        insetTop={insets.top}
      />

      <Animated.ScrollView
        style={styles.scroll}
        contentContainerStyle={cardContentStyle}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(350).delay(180)}>
          <WorkoutWeekGrid
            sessions={thisWeekSessions}
            selectedDate={selectedDate}
            onDayPress={setSelectedDate}
          />
        </Animated.View>

        {isLoaded && (
          <Animated.View
            entering={FadeInDown.duration(350).delay(220)}
            style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {thisWeekSessions.length > 0
                ? `${thisWeekSessions.length} workout${thisWeekSessions.length !== 1 ? 's' : ''} this week`
                : 'This week'}
            </Text>
          </Animated.View>
        )}

        {isLoaded && thisWeekSessions.length === 0 && (
          <WorkoutEmptyState onStartWorkout={handleStartWorkout} />
        )}

        {isLoaded && thisWeekSessions.length > 0 && (
          <Animated.View
            entering={FadeInDown.duration(350).delay(270)}
            style={styles.analyticsPlaceholder}>
            <Text style={styles.analyticsPlaceholderText}>Analytics — coming P3</Text>
          </Animated.View>
        )}
      </Animated.ScrollView>

      <Animated.View style={[styles.fab, fabAnimatedStyle]}>
        <Pressable
          onPressIn={() => {
            fabScale.value = withSpring(0.92, SPRING_FAB);
          }}
          onPressOut={() => {
            fabScale.value = withSpring(1, SPRING_FAB);
          }}
          onPress={handleStartWorkout}
          style={styles.fabInner}>
          <MaterialCommunityIcons name="plus" size={28} color={SLEEP_THEME.screenBg} />
        </Pressable>
      </Animated.View>

      <Animated.View style={[styles.fabLabel, fabAnimatedStyle]} pointerEvents="none">
        <Text style={styles.fabLabelText}>Start Workout</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SLEEP_THEME.screenBg },
  heroLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 0,
    overflow: 'visible',
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
  scroll: { flex: 1, zIndex: 2 },
  sectionHeader: {
    paddingHorizontal: SLEEP_LAYOUT.screenPaddingH,
    paddingTop: 4,
  },
  sectionTitle: {
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 13,
    lineHeight: 18,
    color: SLEEP_THEME.textMuted1,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  analyticsPlaceholder: {
    marginHorizontal: SLEEP_LAYOUT.screenPaddingH,
    height: 120,
    borderRadius: SLEEP_LAYOUT.cardRadiusOuter,
    backgroundColor: SLEEP_THEME.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyticsPlaceholderText: {
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 13,
    color: SLEEP_THEME.textMuted2,
  },
  fab: {
    position: 'absolute',
    bottom: FAB_BOTTOM,
    right: FAB_RIGHT,
    zIndex: 10,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    shadowColor: WORKOUT_THEME.fabShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  fabInner: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: WORKOUT_THEME.fabBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabLabel: {
    position: 'absolute',
    bottom: FAB_BOTTOM - 22,
    right: FAB_RIGHT,
    zIndex: 10,
    width: FAB_SIZE,
    alignItems: 'center',
  },
  fabLabelText: {
    fontFamily: SLEEP_FONTS.medium,
    fontSize: 10,
    lineHeight: 12,
    color: SLEEP_THEME.textMuted1,
    textAlign: 'center',
  },
});
