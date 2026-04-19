import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useWorkoutStore } from '@store/workoutStore';
import type { ActiveWorkoutSession } from '@store/workoutStore';
import { SLEEP_FONTS, SLEEP_LAYOUT, SLEEP_THEME, WORKOUT_THEME } from '@constants';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function computeElapsedSeconds(session: ActiveWorkoutSession): number {
  const now = Date.now();
  const start = new Date(session.startedAt).getTime();
  const pausedMs = session.pausedIntervals.reduce((acc, interval) => {
    // Open interval (currently paused): count up to now so elapsed stays frozen
    const end = interval.to ? new Date(interval.to).getTime() : now;
    return acc + (end - new Date(interval.from).getTime());
  }, 0);
  return Math.max(0, Math.floor((now - start - pausedMs) / 1000));
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

const SPRING = { damping: 16, stiffness: 220 } as const;

export default function ActiveSessionCard() {
  const router = useRouter();
  const activeSession = useWorkoutStore((s) => s.activeSession);
  const pauseWorkout = useWorkoutStore((s) => s.pauseWorkout);
  const resumeWorkout = useWorkoutStore((s) => s.resumeWorkout);

  // Stable ref so the interval closure always reads latest session data
  const sessionRef = useRef(activeSession);
  sessionRef.current = activeSession;

  const [elapsed, setElapsed] = useState(() =>
    activeSession ? computeElapsedSeconds(activeSession) : 0,
  );

  const scale = useSharedValue(1);
  const dotOpacity = useSharedValue(1);

  const isPaused = activeSession?.isPaused ?? false;

  // Pulsing live dot — dims when paused
  useEffect(() => {
    if (isPaused) {
      dotOpacity.value = withTiming(0.35, { duration: 300 });
      return;
    }
    dotOpacity.value = withRepeat(withTiming(0.2, { duration: 900 }), -1, true);
  }, [isPaused]);

  // 1-second elapsed ticker — stops when paused, snaps value on resume
  useEffect(() => {
    if (!activeSession || isPaused) {
      if (activeSession) setElapsed(computeElapsedSeconds(activeSession));
      return;
    }
    const id = setInterval(() => {
      if (sessionRef.current) setElapsed(computeElapsedSeconds(sessionRef.current));
    }, 1000);
    return () => clearInterval(id);
  }, [isPaused]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const dotStyle = useAnimatedStyle(() => ({
    opacity: dotOpacity.value,
  }));

  if (!activeSession) return null;

  const totalSets = activeSession.exercises.reduce((acc, e) => acc + e.sets.length, 0);
  const exerciseCount = activeSession.exercises.length;

  const handleNavigate = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/workout/active');
  };

  const handleTogglePause = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isPaused) resumeWorkout();
    else pauseWorkout();
  };

  return (
    <Animated.View entering={FadeInDown.duration(350)} style={cardStyle}>
      <Pressable
        onPressIn={() => {
          scale.value = withSpring(0.98, SPRING);
        }}
        onPressOut={() => {
          scale.value = withSpring(1, SPRING);
        }}
        onPress={handleNavigate}
        style={[styles.card, isPaused && styles.cardPaused]}>

        {/* Accent left bar */}
        <View style={[styles.accentBar, isPaused && styles.accentBarPaused]} />

        <View style={styles.body}>
          {/* Header row */}
          <View style={styles.headerRow}>
            <View style={styles.livePill}>
              <Animated.View style={[styles.liveDot, dotStyle]} />
              <Text style={[styles.liveLabel, isPaused && styles.liveLabelPaused]}>
                {isPaused ? 'Paused' : 'Live'}
              </Text>
            </View>

            {/* Pause / Resume — nested Pressable takes the touch, outer card press is skipped */}
            <Pressable
              onPress={handleTogglePause}
              hitSlop={10}
              style={[styles.pauseBtn, isPaused && styles.pauseBtnPaused]}>
              <MaterialCommunityIcons
                name={isPaused ? 'play' : 'pause'}
                size={13}
                color={isPaused ? WORKOUT_THEME.accent : SLEEP_THEME.screenBg}
              />
              <Text style={[styles.pauseBtnText, isPaused && styles.pauseBtnTextPaused]}>
                {isPaused ? 'Resume' : 'Pause'}
              </Text>
            </Pressable>
          </View>

          {/* Elapsed timer */}
          <Text style={[styles.timer, isPaused && styles.timerPaused]}>
            {formatElapsed(elapsed)}
          </Text>

          {/* Stats + tap hint */}
          <View style={styles.statsRow}>
            <Text style={styles.statValue}>{exerciseCount}</Text>
            <Text style={styles.statLabel}>
              {exerciseCount === 1 ? ' exercise' : ' exercises'}
            </Text>
            <View style={styles.statDivider} />
            <Text style={styles.statValue}>{totalSets}</Text>
            <Text style={styles.statLabel}>{totalSets === 1 ? ' set' : ' sets'}</Text>
            <View style={styles.statSpacer} />
            <Text style={styles.tapHint}>Continue →</Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: SLEEP_LAYOUT.screenPaddingH,
    borderRadius: SLEEP_LAYOUT.cardRadiusOuter,
    backgroundColor: SLEEP_THEME.cardBg,
    borderWidth: 1,
    borderColor: WORKOUT_THEME.accentBorder,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  cardPaused: {
    borderColor: SLEEP_THEME.border,
  },
  accentBar: {
    width: 3,
    backgroundColor: WORKOUT_THEME.accent,
  },
  accentBarPaused: {
    backgroundColor: SLEEP_THEME.textMuted2,
  },
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: WORKOUT_THEME.accent,
  },
  liveLabel: {
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 11,
    lineHeight: 14,
    color: WORKOUT_THEME.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  liveLabelPaused: {
    color: SLEEP_THEME.textMuted1,
  },
  pauseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: WORKOUT_THEME.accent,
  },
  pauseBtnPaused: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: WORKOUT_THEME.accent,
  },
  pauseBtnText: {
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 12,
    lineHeight: 15,
    color: SLEEP_THEME.screenBg,
  },
  pauseBtnTextPaused: {
    color: WORKOUT_THEME.accent,
  },
  timer: {
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 44,
    lineHeight: 48,
    letterSpacing: -1,
    color: SLEEP_THEME.textPrimary,
  },
  timerPaused: {
    color: SLEEP_THEME.textSecondary,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statValue: {
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 13,
    lineHeight: 17,
    color: SLEEP_THEME.textSecondary,
  },
  statLabel: {
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 13,
    lineHeight: 17,
    color: SLEEP_THEME.textMuted1,
  },
  statDivider: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: SLEEP_THEME.textMuted2,
    marginHorizontal: 8,
  },
  statSpacer: {
    flex: 1,
  },
  tapHint: {
    fontFamily: SLEEP_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: WORKOUT_THEME.accentMid,
  },
});
