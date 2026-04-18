import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeInUp,
  FadeOutDown,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { SLEEP_FONTS, SLEEP_LAYOUT, SLEEP_THEME, WORKOUT_THEME } from '@constants';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const CARD_PADDING = 20;
const ARC_SIZE = 100;
const ARC_RADIUS = 40;
const ARC_STROKE = 5;
const ARC_CIRCUMFERENCE = 2 * Math.PI * ARC_RADIUS;
const SPRING = { damping: 18, stiffness: 240 } as const;
const DEFAULT_SECONDS = 90;

interface RestTimerProps {
  isVisible: boolean;
  onDismiss: () => void;
}

export default function RestTimer({ isVisible, onDismiss }: RestTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_SECONDS);
  const totalRef = useRef(DEFAULT_SECONDS);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const addScale = useSharedValue(1);

  // SVG arc progress driven by secondsLeft state
  const progress = secondsLeft / totalRef.current;
  const strokeDashoffset = ARC_CIRCUMFERENCE * (1 - Math.max(0, progress));

  const arcColor =
    secondsLeft <= 10
      ? WORKOUT_THEME.restTimerDone
      : secondsLeft <= 20
        ? WORKOUT_THEME.restTimerWarning
        : WORKOUT_THEME.restTimerActive;

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset,
    stroke: arcColor,
  }));

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
    [clearTimer, onDismiss]
  );

  useEffect(() => {
    if (isVisible) {
      startTimer(DEFAULT_SECONDS);
    } else {
      clearTimer();
      setSecondsLeft(DEFAULT_SECONDS);
    }
    return clearTimer;
  }, [isVisible, startTimer, clearTimer]);

  const addButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: addScale.value }],
  }));

  const handleAddTime = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addScale.value = withSpring(0.85, SPRING);
    setTimeout(() => {
      addScale.value = withSpring(1, SPRING);
    }, 100);
    setSecondsLeft((prev) => {
      const next = prev + 30;
      totalRef.current = Math.max(totalRef.current, next);
      return next;
    });
  }, [addScale]);

  const timeLabel = (() => {
    const s = Math.max(0, secondsLeft);
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}`;
  })();

  if (!isVisible) return null;

  return (
    <Animated.View
      entering={FadeInUp.springify().damping(22).stiffness(200)}
      exiting={FadeOutDown.duration(200)}
      style={styles.container}>
      {/* Arc progress */}
      <View style={styles.arcWrap}>
        <Svg width={ARC_SIZE} height={ARC_SIZE}>
          {/* Track */}
          <Circle
            cx={ARC_SIZE / 2}
            cy={ARC_SIZE / 2}
            r={ARC_RADIUS}
            stroke={SLEEP_THEME.border}
            strokeWidth={ARC_STROKE}
            fill="none"
            strokeLinecap="round"
          />
          {/* Animated progress arc */}
          <AnimatedCircle
            cx={ARC_SIZE / 2}
            cy={ARC_SIZE / 2}
            r={ARC_RADIUS}
            strokeWidth={ARC_STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={ARC_CIRCUMFERENCE}
            rotation="-90"
            origin={`${ARC_SIZE / 2}, ${ARC_SIZE / 2}`}
            animatedProps={arcProps}
          />
        </Svg>

        <Text style={[styles.timeText, { color: arcColor }]}>{timeLabel}</Text>
        <Text style={styles.arcLabel}>Rest</Text>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Animated.View style={addButtonStyle}>
          <Pressable onPress={handleAddTime} hitSlop={12} style={styles.addBtn}>
            <Text style={styles.addBtnText}>+30s</Text>
          </Pressable>
        </Animated.View>

        <Pressable
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            clearTimer();
            onDismiss();
          }}
          hitSlop={12}
          style={styles.skipBtn}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: SLEEP_LAYOUT.screenPaddingH,
    backgroundColor: SLEEP_THEME.cardBg,
    borderRadius: SLEEP_LAYOUT.cardRadiusOuter,
    padding: CARD_PADDING,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderColor: 'rgba(48,209,88,0.20)',
  },
  arcWrap: {
    width: ARC_SIZE,
    height: ARC_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeText: {
    position: 'absolute',
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 22,
    lineHeight: 26,
    textAlign: 'center',
    top: ARC_SIZE / 2 - 18,
  },
  arcLabel: {
    position: 'absolute',
    bottom: 8,
    fontFamily: SLEEP_FONTS.medium,
    fontSize: 10,
    lineHeight: 12,
    color: SLEEP_THEME.textMuted2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  actions: {
    flex: 1,
    gap: 10,
  },
  addBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: WORKOUT_THEME.accentDim,
    alignSelf: 'flex-start',
  },
  addBtnText: {
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
    color: WORKOUT_THEME.accent,
  },
  skipBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: SLEEP_THEME.elevatedBg,
    alignSelf: 'flex-start',
  },
  skipText: {
    fontFamily: SLEEP_FONTS.medium,
    fontSize: 14,
    lineHeight: 18,
    color: SLEEP_THEME.textMuted1,
  },
});
