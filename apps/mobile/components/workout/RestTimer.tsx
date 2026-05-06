import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeInUp,
  FadeOutDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SLEEP_FONTS, SLEEP_LAYOUT, WORKOUT_THEME, tabularStyle } from '@constants';

const DEFAULT_SECONDS = 90;
const BAR_HEIGHT = 70;

interface RestTimerProps {
  isVisible: boolean;
  onDismiss: () => void;
}

export default function RestTimer({ isVisible, onDismiss }: RestTimerProps) {
  const insets = useSafeAreaInsets();
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_SECONDS);
  const totalRef = useRef(DEFAULT_SECONDS);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const progress = useSharedValue(1);
  const progressStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: progress.value }],
  }));

  const skipScale = useSharedValue(1);
  const addScale = useSharedValue(1);
  const skipStyle = useAnimatedStyle(() => ({ transform: [{ scale: skipScale.value }] }));
  const addStyle = useAnimatedStyle(() => ({ transform: [{ scale: addScale.value }] }));

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startTimer = useCallback(
    (seconds: number) => {
      clearTimer();
      totalRef.current = seconds;
      setSecondsLeft(seconds);
      progress.value = 1;
      progress.value = withTiming(0, { duration: seconds * 1000 });

      intervalRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          const next = prev - 1;
          if (next <= 0) {
            clearTimer();
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onDismiss();
            return 0;
          }
          if (next === 10) {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          return next;
        });
      }, 1000);
    },
    [clearTimer, onDismiss, progress],
  );

  useEffect(() => {
    if (isVisible) startTimer(DEFAULT_SECONDS);
    return clearTimer;
  }, [isVisible, startTimer, clearTimer]);

  const handleAdd30 = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addScale.value = withTiming(0.97, { duration: 80 });
    setTimeout(() => {
      addScale.value = withTiming(1, { duration: 80 });
    }, 80);
    const newTotal = totalRef.current + 30;
    const newLeft = secondsLeft + 30;
    totalRef.current = newTotal;
    setSecondsLeft(newLeft);
    progress.value = newLeft / newTotal;
    progress.value = withTiming(0, { duration: newLeft * 1000 });
  }, [secondsLeft, addScale, progress]);

  const handleSkip = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    skipScale.value = withTiming(0.97, { duration: 80 });
    setTimeout(() => {
      skipScale.value = withTiming(1, { duration: 80 });
    }, 80);
    clearTimer();
    onDismiss();
  }, [clearTimer, onDismiss, skipScale]);

  if (!isVisible) return null;

  const m = Math.floor(secondsLeft / 60);
  const s = secondsLeft % 60;
  const label = `${m}:${String(s).padStart(2, '0')}`;
  const bottomOffset = SLEEP_LAYOUT.navbarHeight + SLEEP_LAYOUT.navbarBottom + insets.bottom + 12;

  return (
    <Animated.View
      entering={FadeInUp.duration(220)}
      exiting={FadeOutDown.duration(180)}
      style={[styles.bar, { bottom: bottomOffset, height: BAR_HEIGHT }]}>
      <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.tint} />

      {/* Progress strip — scaled horizontally from full → 0 */}
      <Animated.View style={[styles.progressStrip, progressStyle]} />

      <View style={styles.foreground}>
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons name="timer-outline" size={19} color={WORKOUT_THEME.fg} />
        </View>
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>Rest</Text>
          <Text style={styles.timeLabel}>{label}</Text>
        </View>

        <Animated.View style={addStyle}>
          <Pressable onPress={handleAdd30} style={styles.add30}>
            <Text style={styles.add30Text}>+30s</Text>
          </Pressable>
        </Animated.View>

        <Animated.View style={skipStyle}>
          <Pressable onPress={handleSkip} style={styles.skip}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 12,
    right: 12,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: WORKOUT_THEME.borderStrong,
    zIndex: 60,
  },
  tint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(22,22,24,0.78)',
  },
  progressStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.07)',
    transformOrigin: 'left',
  },
  foreground: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
  },
  eyebrow: {
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 11,
    color: WORKOUT_THEME.fg3,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  timeLabel: {
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 22,
    color: WORKOUT_THEME.fg,
    marginTop: 2,
    letterSpacing: -0.5,
    ...tabularStyle,
  },
  add30: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  add30Text: {
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 13,
    color: WORKOUT_THEME.fg2,
  },
  skip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: WORKOUT_THEME.fg,
  },
  skipText: {
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 13,
    color: WORKOUT_THEME.bg,
  },
});
