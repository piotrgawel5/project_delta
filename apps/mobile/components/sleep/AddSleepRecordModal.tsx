import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, Dimensions, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Path, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  runOnJS,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');
const SLIDER_SIZE = width * 0.7;
const STROKE_WIDTH = 36;
const CENTER = SLIDER_SIZE / 2;
const RADIUS = CENTER - STROKE_WIDTH / 2 - 4;
const KNOB_SIZE = 32;
const KNOB_HALF = KNOB_SIZE / 2;

// Visual Constants
const SHEET_PADDING = 20;
const SHEET_INNER_RADIUS = 12;
const SHEET_RADIUS = SHEET_INNER_RADIUS + SHEET_PADDING;
const CONTROL_PADDING = 14;
const CONTROL_INNER_RADIUS = 8;
const CONTROL_RADIUS = CONTROL_INNER_RADIUS + CONTROL_PADDING;
const CLOSE_BTN_PADDING = 6;
const CLOSE_BTN_INNER_RADIUS = 6;
const CLOSE_BTN_RADIUS = CLOSE_BTN_INNER_RADIUS + CLOSE_BTN_PADDING;
const HANDLE_HEIGHT = 5;
const HANDLE_RADIUS = HANDLE_HEIGHT / 2;
const SAVE_BTN_PADDING_Y = 12;
const SAVE_BTN_INNER_RADIUS = 10;
const SAVE_BTN_RADIUS = SAVE_BTN_INNER_RADIUS + SAVE_BTN_PADDING_Y;
const CARD_BG = '#000000';
const POPUP_BG = '#0B0B0D';
const TEXT_SECONDARY = 'rgba(255, 255, 255, 0.7)';
const TEXT_TERTIARY = 'rgba(255,255,255,0.5)';
const STROKE = 'rgba(255,255,255,0.08)';
const BTN_SOLID = '#F8FAFC';

interface AddSleepRecordModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSave: (startTime: Date, endTime: Date) => Promise<boolean>;
  date?: Date; // Reference date for the sleep record
  userId: string;
}

// ----------------------------------------------------------------------
// Math Helpers
// ----------------------------------------------------------------------

const PI = Math.PI;
const TAU = 2 * PI;

function normalizeAngle(angle: number): number {
  'worklet';
  let a = angle;
  while (a <= -PI) a += TAU;
  while (a > PI) a -= TAU;
  return a;
}

function timeToRad(h: number, m: number): number {
  'worklet';
  const totalMinutes = h * 60 + m;
  const ratio = totalMinutes / (24 * 60);
  return normalizeAngle(ratio * TAU - PI / 2);
}

function radToTime(rad: number): { h: number; m: number } {
  'worklet';
  let angle = rad + PI / 2;
  if (angle < 0) angle += TAU;
  if (angle >= TAU) angle -= TAU;
  const mins = Math.round(((angle / TAU) * 24 * 60) / 10) * 10;
  let h = Math.floor(mins / 60);
  if (h >= 24) h = 0;
  const m = mins % 60;
  return { h, m };
}

function polarToCartesian(angle: number, r: number, cx: number): { x: number; y: number } {
  'worklet';
  return {
    x: cx + r * Math.cos(angle),
    y: cx + r * Math.sin(angle),
  };
}

const formatTime = (h: number, m: number) => {
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

const getSmartDateLabel = (date: Date) => {
  const now = new Date();
  // Reset times to compare dates only
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const n = new Date(now);
  n.setHours(0, 0, 0, 0);

  const diffTime = n.getTime() - d.getTime();
  const diffDays = diffTime / (1000 * 3600 * 24);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';

  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

// ----------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------

Animated.addWhitelistedNativeProps({ d: true });
const AnimatedPath = Animated.createAnimatedComponent(Path);

export const AddSleepRecordModal = ({
  isVisible,
  onClose,
  onSave,
  date,
  userId,
}: AddSleepRecordModalProps) => {
  const insets = useSafeAreaInsets();

  const startAngle = useSharedValue(timeToRad(23, 0));
  const endAngle = useSharedValue(timeToRad(7, 0));
  const activeKnob = useSharedValue<'start' | 'end' | null>(null);
  const translateY = useSharedValue(height);

  const [bedtime, setBedtime] = useState({ h: 23, m: 0 });
  const [waketime, setWaketime] = useState({ h: 7, m: 0 });
  const [durationStr, setDurationStr] = useState('8h 00m');
  const [headerDate, setHeaderDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Stabilize date to prevent infinite re-renders when parent passes new Date()
  const stableDate = useMemo(() => {
    const d = date || new Date();
    return d;
  }, [date?.getTime()]);

  const updateTimes = useCallback((sRad: number, eRad: number) => {
    const sTime = radToTime(sRad);
    const eTime = radToTime(eRad);
    setBedtime(sTime);
    setWaketime(eTime);

    let diff = eRad - sRad;
    if (diff <= 0) diff += TAU;
    const durMins = Math.round(((diff / TAU) * 24 * 60) / 10) * 10;
    const dh = Math.floor(durMins / 60);
    const dm = durMins % 60;
    setDurationStr(`${dh}h ${dm.toString().padStart(2, '0')}m`);
  }, []);

  useEffect(() => {
    if (isVisible) {
      setHeaderDate(getSmartDateLabel(stableDate));
      setIsSaving(false);
      startAngle.value = timeToRad(23, 0);
      endAngle.value = timeToRad(7, 0);
      updateTimes(startAngle.value, endAngle.value);
      translateY.value = withTiming(0, { duration: 350, easing: Easing.out(Easing.cubic) });
    } else {
      translateY.value = height;
    }
  }, [isVisible, stableDate]);

  const closeWithAnimation = useCallback(() => {
    translateY.value = withTiming(height, { duration: 250, easing: Easing.in(Easing.cubic) });
    setTimeout(onClose, 260);
  }, [onClose]);

  const triggerHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // ------------------------------------------------------------------
  // Circular Slider Gesture w/ Manual Activation
  // ------------------------------------------------------------------
  const sliderGesture = Gesture.Pan()
    .manualActivation(true)
    .onTouchesDown((e, state) => {
      'worklet';
      const touch = e.changedTouches[0];
      if (!touch) return;

      const sPos = polarToCartesian(startAngle.value, RADIUS, CENTER);
      const ePos = polarToCartesian(endAngle.value, RADIUS, CENTER);

      const dS = Math.hypot(touch.x - sPos.x, touch.y - sPos.y);
      const dE = Math.hypot(touch.x - ePos.x, touch.y - ePos.y);

      const threshold = STROKE_WIDTH + 30;

      if (dS <= threshold && dS <= dE) {
        activeKnob.value = 'start';
        state.activate();
      } else if (dE <= threshold) {
        activeKnob.value = 'end';
        state.activate();
      } else {
        activeKnob.value = null;
        state.fail();
      }
    })
    .onUpdate((e) => {
      'worklet';
      if (!activeKnob.value) return;

      const rawAngle = Math.atan2(e.y - CENTER, e.x - CENTER);

      const STEP = TAU / 144;
      const offset = -PI / 2;
      let relative = rawAngle - offset;
      if (relative < 0) relative += TAU;
      if (relative >= TAU) relative -= TAU;

      const snapped = Math.round(relative / STEP) * STEP;
      const finalAngle = normalizeAngle(snapped + offset);

      const current = activeKnob.value === 'start' ? startAngle.value : endAngle.value;
      let angleDiff = Math.abs(finalAngle - current);
      if (angleDiff > PI) angleDiff = TAU - angleDiff;

      if (angleDiff > 0.01) {
        if (activeKnob.value === 'start') {
          startAngle.value = finalAngle;
        } else {
          endAngle.value = finalAngle;
        }
        runOnJS(triggerHaptic)();
        runOnJS(updateTimes)(startAngle.value, endAngle.value);
      }
    })
    .onFinalize(() => {
      'worklet';
      activeKnob.value = null;
    });

  // ------------------------------------------------------------------
  // Sheet Dismiss Gesture
  // ------------------------------------------------------------------
  const sheetGesture = Gesture.Pan()
    .onUpdate((e) => {
      'worklet';
      if (e.translationY > 0) {
        translateY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      'worklet';
      if (translateY.value > 120 || e.velocityY > 600) {
        translateY.value = withTiming(height, { duration: 250 });
        runOnJS(onClose)();
      } else {
        translateY.value = withTiming(0, { duration: 200 });
      }
    });

  // ------------------------------------------------------------------
  // Animated Styles
  // ------------------------------------------------------------------
  const animatedPathProps = useAnimatedProps(() => {
    const start = startAngle.value;
    const end = endAngle.value;
    let diff = end - start;
    if (diff <= 0) diff += TAU;
    const largeArc = diff > PI ? 1 : 0;
    const startPos = polarToCartesian(start, RADIUS, CENTER);
    const endPos = polarToCartesian(end, RADIUS, CENTER);
    if (isNaN(startPos.x) || isNaN(endPos.x)) return { d: '' };
    return {
      d: `M ${startPos.x} ${startPos.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${endPos.x} ${endPos.y}`,
    };
  });

  const startKnobStyle = useAnimatedStyle(() => {
    const pos = polarToCartesian(startAngle.value, RADIUS, CENTER);
    return { transform: [{ translateX: pos.x - KNOB_HALF }, { translateY: pos.y - KNOB_HALF }] };
  });

  const endKnobStyle = useAnimatedStyle(() => {
    const pos = polarToCartesian(endAngle.value, RADIUS, CENTER);
    return { transform: [{ translateX: pos.x - KNOB_HALF }, { translateY: pos.y - KNOB_HALF }] };
  });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const handleSave = async () => {
    if (isSaving || !userId) return;

    setIsSaving(true);

    const n = new Date(stableDate); // Use the stabilized date
    const s = new Date(n);
    s.setHours(bedtime.h, bedtime.m, 0, 0);
    const e = new Date(n);
    e.setHours(waketime.h, waketime.m, 0, 0);

    // Logic: Bedtime allows going back 1 day. Wake up defaults to reference day.
    if (s > e) {
      // e.g. Sleep 23:00 -> Wake 07:00
      // s is day before
      s.setDate(s.getDate() - 1);
    }

    try {
      const success = await onSave(s, e);
      if (success) {
        closeWithAnimation();
      } else {
        setIsSaving(false);
      }
    } catch (error) {
      console.error('[AddSleepRecordModal] Save failed:', error);
      setIsSaving(false);
    }
  };

  if (!isVisible) return null;

  return (
    <Modal animationType="none" transparent visible={isVisible} onRequestClose={closeWithAnimation}>
      <Pressable style={styles.backdrop} onPress={closeWithAnimation}>
        <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />
      </Pressable>

      <GestureHandlerRootView style={styles.gestureRoot} pointerEvents="box-none">
        <GestureDetector gesture={sheetGesture}>
          <Animated.View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }, sheetStyle]}>
            {/* Expanded Header Zone for Gestures */}
            <View style={styles.headerZone}>
              <View style={styles.handleContainer}>
                <View style={styles.handle} />
              </View>

              <View style={styles.header}>
                <Text style={styles.title}>{headerDate}</Text>
                <Pressable onPress={closeWithAnimation} style={styles.closeBtn}>
                  <Ionicons name="close" size={18} color="#8E8E93" />
                </Pressable>
              </View>
            </View>

            {/* Slider */}
            <View style={styles.content}>
              <GestureDetector gesture={sliderGesture}>
                <View style={styles.sliderContainer}>
                  <Svg width={SLIDER_SIZE} height={SLIDER_SIZE}>
                    <Defs>
                      <SvgGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <Stop offset="0" stopColor="#7DD3FC" />
                        <Stop offset="1" stopColor="#C4B5FD" />
                      </SvgGradient>
                    </Defs>
                    <Circle
                      cx={CENTER}
                      cy={CENTER}
                      r={RADIUS}
                      stroke="rgba(255,255,255,0.12)"
                      strokeWidth={STROKE_WIDTH}
                      fill="none"
                    />
                    <AnimatedPath
                      animatedProps={animatedPathProps}
                      stroke="url(#arcGrad)"
                      strokeWidth={STROKE_WIDTH}
                      fill="none"
                      strokeLinecap="round"
                    />
                    {Array.from({ length: 48 }).map((_, i) => {
                      const ang = (i / 48) * TAU - PI / 2;
                      const inner = RADIUS - 24;
                      const outer = inner + 3;
                      const isMajor = i % 4 === 0;
                      return (
                        <Path
                          key={i}
                          d={`M ${CENTER + inner * Math.cos(ang)} ${CENTER + inner * Math.sin(ang)} L ${CENTER + outer * Math.cos(ang)} ${CENTER + outer * Math.sin(ang)}`}
                          stroke={isMajor ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.12)'}
                          strokeWidth={isMajor ? 1.5 : 1}
                        />
                      );
                    })}
                  </Svg>
                  <Text style={[styles.clockLabel, { top: 16 }]}>00</Text>
                  <Text style={[styles.clockLabel, { right: 16, top: CENTER - 7 }]}>06</Text>
                  <Text style={[styles.clockLabel, { bottom: 16 }]}>12</Text>
                  <Text style={[styles.clockLabel, { left: 16, top: CENTER - 7 }]}>18</Text>

                  <Animated.View style={[styles.knobWrap, startKnobStyle]}>
                    <View style={styles.knob}>
                      <Ionicons name="bed" size={13} color="#000" />
                    </View>
                  </Animated.View>
                  <Animated.View style={[styles.knobWrap, endKnobStyle]}>
                    <View style={styles.knob}>
                      <Ionicons name="alarm" size={13} color="#000" />
                    </View>
                  </Animated.View>

                  <View style={styles.centerInfo} pointerEvents="none">
                    <Text style={styles.durationLabel}>Duration</Text>
                  <Text style={styles.durationValue}>{durationStr}</Text>
                </View>
              </View>
              </GestureDetector>

              {/* Time display */}
              <View style={styles.timeRow}>
                <View style={styles.timeItem}>
                  <View style={styles.timeLabelRow}>
                    <Ionicons name="bed" size={13} color="#7DD3FC" />
                    <Text style={styles.timeLabelText}>Bedtime</Text>
                  </View>
                  <Text style={styles.timeValue}>{formatTime(bedtime.h, bedtime.m)}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.timeItem}>
                  <View style={styles.timeLabelRow}>
                    <Ionicons name="alarm" size={13} color="#C4B5FD" />
                    <Text style={styles.timeLabelText}>Wake Up</Text>
                  </View>
                  <Text style={styles.timeValue}>{formatTime(waketime.h, waketime.m)}</Text>
                </View>
              </View>

              {/* Save button */}
              <Pressable
                onPress={handleSave}
                disabled={isSaving || !userId}
                style={({ pressed }) => [
                  styles.saveBtn,
                  pressed && { opacity: 0.85 },
                  (isSaving || !userId) && { opacity: 0.5 },
                ]}>
                <Text style={styles.saveBtnText}>{isSaving ? 'Saving...' : 'Save Sleep'}</Text>
              </Pressable>
            </View>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  gestureRoot: { flex: 1, justifyContent: 'flex-end', pointerEvents: 'box-none' },
  sheet: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: STROKE,
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  headerZone: {
    width: '100%',
    paddingBottom: 10,
    backgroundColor: 'transparent',
    // Increase top padding to add "some space at the top" for gestures
    paddingTop: 12,
  },
  handleContainer: { alignItems: 'center', marginBottom: 8 },
  handle: {
    width: 36,
    height: HANDLE_HEIGHT,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: HANDLE_RADIUS,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: { color: 'white', fontSize: 19, fontWeight: '700' },
  closeBtn: {
    padding: 6,
    backgroundColor: '#0F1117',
    borderRadius: CLOSE_BTN_RADIUS,
    borderWidth: 1,
    borderColor: STROKE,
  },
  content: { alignItems: 'center', paddingHorizontal: 20 },
  sliderContainer: {
    width: SLIDER_SIZE,
    height: SLIDER_SIZE,
    marginBottom: 16,
  },
  clockLabel: {
    position: 'absolute',
    color: TEXT_TERTIARY,
    fontSize: 11,
    fontWeight: '600',
    alignSelf: 'center',
  },
  knobWrap: { position: 'absolute', width: KNOB_SIZE, height: KNOB_SIZE },
  knob: {
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: KNOB_SIZE / 2,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  centerInfo: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  durationLabel: { color: TEXT_SECONDARY, fontSize: 12, fontWeight: '500', marginBottom: 2 },
  durationValue: { color: 'white', fontSize: 26, fontWeight: '700', fontVariant: ['tabular-nums'] },
  timeRow: {
    flexDirection: 'row',
    backgroundColor: '#0F1117',
    borderRadius: CONTROL_RADIUS,
    padding: CONTROL_PADDING,
    width: '100%',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: STROKE,
  },
  timeItem: { flex: 1, alignItems: 'center' },
  timeLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  timeLabelText: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '500' },
  timeValue: { color: 'white', fontSize: 18, fontWeight: '600', fontVariant: ['tabular-nums'] },
  divider: { width: 1, height: 36, backgroundColor: STROKE, marginHorizontal: 12 },
  saveBtn: {
    width: '100%',
    height: 52,
    borderRadius: SAVE_BTN_RADIUS,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: BTN_SOLID,
  },
  saveBtnText: { color: '#000', fontSize: 16, fontWeight: '700' },
});
