import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useWorkoutStore } from '@store/workoutStore';
import { SLEEP_FONTS, WORKOUT_THEME, tabularStyle } from '@constants';
import { useActiveTimer } from '@lib/workoutTimer';

function pausedAgo(pausedAtMs: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - pausedAtMs) / 1000));
  if (diffSec < 60) return `Paused ${diffSec}s ago`;
  const m = Math.floor(diffSec / 60);
  if (m < 60) return `Paused ${m} min ago`;
  const h = Math.floor(m / 60);
  return `Paused ${h}h ago`;
}

function getLatestPauseStart(session: { pausedIntervals: { from: string; to: string | null }[] } | null): number | null {
  if (!session) return null;
  const open = session.pausedIntervals.find((p) => p.to == null);
  if (!open) return null;
  const t = Date.parse(open.from);
  return Number.isNaN(t) ? null : t;
}

export default function ActiveSessionCard() {
  const router = useRouter();
  const activeSession = useWorkoutStore((s) => s.activeSession);
  const elapsedLabel = useActiveTimer(activeSession);

  const scale = useSharedValue(1);
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (!activeSession) return null;

  const totalSets = activeSession.exercises.reduce((acc, e) => acc + e.sets.length, 0);
  const exerciseCount = activeSession.exercises.length;
  const isPaused = activeSession.isPaused;
  const pauseStart = getLatestPauseStart(activeSession);
  const statusLabel = isPaused && pauseStart ? pausedAgo(pauseStart) : 'In progress';
  const title = activeSession.name?.trim() || 'Workout';

  const handleContinue = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.value = withTiming(0.97, { duration: 100 });
    setTimeout(() => {
      scale.value = withTiming(1, { duration: 100 });
    }, 100);
    router.push('/workout/active');
  };

  return (
    <Animated.View entering={FadeInDown.duration(350)} style={[styles.wrap, cardStyle]}>
      <LinearGradient
        colors={[WORKOUT_THEME.resumeHeroTop, WORKOUT_THEME.resumeHeroBottom]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.card}>
        <View style={styles.topRow}>
          <View style={styles.statusPill}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>{statusLabel}</Text>
          </View>
          <MaterialCommunityIcons name="dots-horizontal" size={22} color={WORKOUT_THEME.fg4} />
        </View>

        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>

        <View style={styles.statsRow}>
          <Stat n={elapsedLabel} l="elapsed" mono />
          <Stat n={String(totalSets)} l="sets done" />
          <Stat n={String(exerciseCount)} l="exercises" />
        </View>

        <Pressable onPress={handleContinue} style={styles.cta}>
          <MaterialCommunityIcons name="play" size={13} color={WORKOUT_THEME.bg} />
          <Text style={styles.ctaText}>Continue workout</Text>
        </Pressable>
      </LinearGradient>
    </Animated.View>
  );
}

function Stat({ n, l, mono }: { n: string; l: string; mono?: boolean }) {
  return (
    <View>
      <Text style={[styles.statNumber, mono && tabularStyle]}>{n}</Text>
      <Text style={styles.statLabel}>{l}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 18,
  },
  card: {
    borderRadius: 28,
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderWidth: 1,
    borderColor: WORKOUT_THEME.border,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: WORKOUT_THEME.fg4,
  },
  statusText: {
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 10.5,
    color: WORKOUT_THEME.fg3,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  title: {
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 22,
    color: WORKOUT_THEME.fg,
    marginTop: 14,
    letterSpacing: -0.4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 22,
    marginTop: 22,
  },
  statNumber: {
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 22,
    color: WORKOUT_THEME.fg,
    letterSpacing: -0.6,
  },
  statLabel: {
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 11,
    color: WORKOUT_THEME.fg3,
    marginTop: 2,
  },
  cta: {
    marginTop: 20,
    height: 50,
    borderRadius: 16,
    backgroundColor: WORKOUT_THEME.fg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaText: {
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 15,
    color: WORKOUT_THEME.bg,
  },
});
