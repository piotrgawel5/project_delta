import { useCallback, useEffect, useMemo } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useAuthStore } from '@store/authStore';
import { useWorkoutStore } from '@store/workoutStore';
import { SLEEP_FONTS, SLEEP_LAYOUT, WORKOUT_THEME } from '@constants';
import ActiveSessionCard from '@components/workout/ActiveSessionCard';
import ConsistencyGrid12 from '@components/workout/ConsistencyGrid12';
import StatTwoUp from '@components/workout/StatTwoUp';
import HistoryList from '@components/workout/HistoryList';
import WorkoutEmptyState from '@components/workout/WorkoutEmptyState';
import { MorningBriefCard } from '@components/home/MorningBriefCard';
import { useMorningBrief } from '@lib/useMorningBrief';

const SCREEN_PAD_X = 18;
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatToday(d: Date): string {
  return `${WEEKDAYS_LONG[d.getDay()]}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

export default function WorkoutScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthStore();

  const sessions = useWorkoutStore((s) => s.sessions);
  const isLoaded = useWorkoutStore((s) => s.isLoaded);
  const activeSession = useWorkoutStore((s) => s.activeSession);
  const startWorkout = useWorkoutStore((s) => s.startWorkout);
  const fetchSessions = useWorkoutStore((s) => s.fetchSessions);
  const drainSyncQueue = useWorkoutStore((s) => s.drainSyncQueue);

  useEffect(() => {
    if (user?.id) {
      void fetchSessions(user.id);
      void drainSyncQueue();
    }
  }, [user?.id, fetchSessions, drainSyncQueue]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void drainSyncQueue();
    });
    return () => sub.remove();
  }, [drainSyncQueue]);

  const dateLabel = useMemo(() => formatToday(new Date()), []);
  const morningBrief = useMorningBrief();
  const headline = activeSession ? 'Pick up where\nyou left off.' : 'Ready to train.';

  const startScale = useSharedValue(1);
  const startBtnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: startScale.value }],
  }));

  const handleStartWorkout = useCallback(() => {
    if (!user?.id) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    startWorkout(user.id);
    router.push('/workout/active');
  }, [user?.id, startWorkout, router]);

  const showEmpty = isLoaded && sessions.length === 0 && !activeSession;
  const ctaBottom = SLEEP_LAYOUT.navbarHeight + SLEEP_LAYOUT.navbarBottom + insets.bottom + 12;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 12, paddingBottom: ctaBottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(350)} style={styles.titleBlock}>
          <Text style={styles.dateLabel}>{dateLabel}</Text>
          <Text style={styles.title}>{headline}</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(350).delay(60)} style={styles.briefSlot}>
          <MorningBriefCard insight={morningBrief} />
        </Animated.View>

        {activeSession && (
          <Animated.View entering={FadeInDown.duration(350).delay(80)} style={styles.heroSlot}>
            <ActiveSessionCard />
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.duration(350).delay(140)} style={styles.gridSlot}>
          <ConsistencyGrid12 sessions={sessions} />
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(350).delay(200)} style={styles.twoUpSlot}>
          <StatTwoUp sessions={sessions} />
        </Animated.View>

        {showEmpty ? (
          <View style={styles.emptySlot}>
            <WorkoutEmptyState onStartWorkout={handleStartWorkout} />
          </View>
        ) : (
          sessions.length > 0 && (
            <Animated.View entering={FadeInDown.duration(350).delay(260)} style={styles.historySlot}>
              <HistoryList sessions={sessions} />
            </Animated.View>
          )
        )}
      </ScrollView>

      {!activeSession && !showEmpty && (
        <View pointerEvents="box-none" style={[styles.ctaStrip, { bottom: ctaBottom }]}>
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.92)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <AnimatedPressable
            onPressIn={() => {
              startScale.value = withTiming(0.97, { duration: 100 });
            }}
            onPressOut={() => {
              startScale.value = withTiming(1, { duration: 100 });
            }}
            onPress={handleStartWorkout}
            style={[styles.startBtn, startBtnStyle]}>
            <MaterialCommunityIcons name="plus" size={18} color={WORKOUT_THEME.bg} />
            <Text style={styles.startBtnText}>Start workout</Text>
          </AnimatedPressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: WORKOUT_THEME.bg },
  scroll: { flex: 1 },
  scrollContent: {
    paddingBottom: 200,
  },
  titleBlock: {
    paddingHorizontal: SCREEN_PAD_X,
    paddingTop: 12,
    paddingBottom: 4,
  },
  dateLabel: {
    fontFamily: SLEEP_FONTS.medium,
    fontSize: 12,
    color: WORKOUT_THEME.fg3,
  },
  title: {
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 36,
    color: WORKOUT_THEME.fg,
    marginTop: 8,
    letterSpacing: -1.2,
    lineHeight: 38,
  },
  briefSlot: {
    marginTop: 18,
    paddingHorizontal: SCREEN_PAD_X,
  },
  heroSlot: {
    marginTop: 22,
  },
  gridSlot: {
    marginTop: 22,
    paddingHorizontal: SCREEN_PAD_X,
  },
  twoUpSlot: {
    marginTop: 14,
    paddingHorizontal: SCREEN_PAD_X,
  },
  historySlot: {
    marginTop: 22,
    paddingHorizontal: SCREEN_PAD_X,
  },
  emptySlot: {
    marginTop: 22,
    paddingHorizontal: SCREEN_PAD_X,
  },
  ctaStrip: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingTop: 24,
    paddingBottom: 4,
    paddingHorizontal: SCREEN_PAD_X,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 16,
    backgroundColor: WORKOUT_THEME.fg,
  },
  startBtnText: {
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 15,
    color: WORKOUT_THEME.bg,
  },
});
