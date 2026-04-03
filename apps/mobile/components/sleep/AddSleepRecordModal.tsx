import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Dimensions,
  Pressable,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  type SharedValue,
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
  withTiming,
  withSpring,
  interpolate,
  Extrapolation,
  Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SLEEP_THEME, SLEEP_FONTS, SLEEP_LAYOUT } from '../../constants/theme';

const { width: SCREEN_WIDTH, height } = Dimensions.get('window');

// Visual Constants
const SHEET_PADDING = 20;
const SHEET_INNER_RADIUS = 24;
const SHEET_RADIUS = SHEET_INNER_RADIUS + SHEET_PADDING;
const CLOSE_BTN_PADDING = 6;
const CLOSE_BTN_INNER_RADIUS = 6;
const CLOSE_BTN_RADIUS = CLOSE_BTN_INNER_RADIUS + CLOSE_BTN_PADDING;
const HANDLE_HEIGHT = 5;
const HANDLE_RADIUS = HANDLE_HEIGHT / 2;
const ROW_HEIGHT = 52;
const VISIBLE_ROWS = 5;
const PADDING_ROWS = 2;
const REPEAT = 3;
const PICKER_HEIGHT = ROW_HEIGHT * VISIBLE_ROWS;
const HOUR_DRUM_WIDTH = 120;
const MINUTE_DRUM_WIDTH = 96;
const DRUM_PAIR_WIDTH = HOUR_DRUM_WIDTH + MINUTE_DRUM_WIDTH + 16;
const HOUR_VALUES = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
const MINUTE_VALUES = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0'));

// Sheet surface — one step above screenBg so the selection capsule reads clearly
const SHEET_BG = SLEEP_THEME.cardBg;

// Selection capsule — optical corner rule: outer = inner + inset
const CAPSULE_INSET = 4;
const CAPSULE_RADIUS = SLEEP_LAYOUT.cardRadiusInner - CAPSULE_INSET; // 12

// Primary action button — system accent (Apple HIG: filled primary on dark surface)
const CTA_BG = SLEEP_THEME.colorBedtime;
const CTA_TEXT_COLOR = SLEEP_THEME.textPrimary;
const CTA_BG_DISABLED = SLEEP_THEME.elevatedBg;
const CTA_TEXT_DISABLED = SLEEP_THEME.textMuted2;

// Spring configs
const SHEET_SPRING = { damping: 28, stiffness: 300, mass: 0.8 };
const SLIDE_SPRING = { damping: 28, stiffness: 280, mass: 0.6 };

interface AddSleepRecordModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSave: (startTime: Date, endTime: Date) => Promise<boolean>;
  date?: Date;
  userId: string;
}

const getSmartDateLabel = (date: Date) => {
  const now = new Date();
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const n = new Date(now);
  n.setHours(0, 0, 0, 0);
  const diffDays = (n.getTime() - d.getTime()) / (1000 * 3600 * 24);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

type DrumPickerProps = {
  values: string[];
  selectedIndex: number;
  onIndexChange: (index: number) => void;
  width: number;
};

type DrumRowProps = {
  absoluteIndex: number;
  value: string;
  valuesLength: number;
  translateY: SharedValue<number>;
  centerOffsetY: number;
};

const DrumRow = React.memo(function DrumRow({
  absoluteIndex,
  value,
  valuesLength,
  translateY,
  centerOffsetY,
}: DrumRowProps) {
  const animStyle = useAnimatedStyle(() => {
    const centeredRaw = (centerOffsetY - translateY.value) / ROW_HEIGHT;
    const trueCenter = ((centeredRaw % valuesLength) + valuesLength) % valuesLength;
    const trueThis = ((absoluteIndex % valuesLength) + valuesLength) % valuesLength;
    let dist = Math.abs(trueThis - trueCenter);
    dist = Math.min(dist, valuesLength - dist);
    // P4: unselected items at 0.45 opacity (was 0.6/0.25) — legible on mid-range Android
    const opacity = interpolate(dist, [0, 1, 2], [1.0, 0.45, 0.12], Extrapolation.CLAMP);
    const scale = interpolate(dist, [0, 1, 2], [1.0, 0.72, 0.52], Extrapolation.CLAMP);
    return { opacity, transform: [{ scale }] };
  });

  return (
    <Animated.Text style={[styles.drumRow, { top: absoluteIndex * ROW_HEIGHT }, animStyle]}>
      {value}
    </Animated.Text>
  );
});

const DrumPicker = React.memo(function DrumPicker({
  values,
  selectedIndex,
  onIndexChange,
  width,
}: DrumPickerProps) {
  const offset = values.length;
  const centerOffsetY = ROW_HEIGHT * PADDING_ROWS;
  const totalItems = values.length * REPEAT;

  const tripled = useMemo(
    () => Array.from({ length: totalItems }, (_, i) => values[i % values.length]),
    [values, totalItems]
  );

  const minY = centerOffsetY - (totalItems - 1) * ROW_HEIGHT;
  const maxY = centerOffsetY;
  const initialY = centerOffsetY - (selectedIndex + offset) * ROW_HEIGHT;
  const translateY = useSharedValue(initialY);
  const prevY = useSharedValue(initialY);

  useEffect(() => {
    const target = centerOffsetY - (selectedIndex + offset) * ROW_HEIGHT;
    translateY.value = target;
    prevY.value = target;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex]);

  const triggerHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const panGesture = Gesture.Pan()
    .onBegin(() => {
      'worklet';
      prevY.value = translateY.value;
    })
    .onUpdate((e) => {
      'worklet';
      const next = prevY.value + e.translationY;
      translateY.value = Math.max(minY, Math.min(maxY, next));
    })
    .onEnd((e) => {
      'worklet';
      const projected = translateY.value + e.velocityY * 0.18;
      const rawIndex = (centerOffsetY - projected) / ROW_HEIGHT;
      const snapped = Math.round(rawIndex);
      const normalizedIndex = ((snapped % values.length) + values.length) % values.length;
      const middleIndex = normalizedIndex + offset;
      const targetY = centerOffsetY - middleIndex * ROW_HEIGHT;
      runOnJS(onIndexChange)(normalizedIndex);
      runOnJS(triggerHaptic)();
      translateY.value = withSpring(targetY, {
        damping: 26,
        stiffness: 280,
        mass: 0.5,
        velocity: e.velocityY,
      });
      prevY.value = targetY;
    });

  const trackStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <View style={[styles.drumFrame, { width }]}>
      {/* P3: selection capsule — corner radius derived (SLEEP_LAYOUT token - inset) */}
      <View pointerEvents="none" style={styles.selectionCapsule} />
      <GestureDetector gesture={panGesture}>
        <View style={styles.drumViewport}>
          <Animated.View
            style={[styles.drumTrack, { height: totalItems * ROW_HEIGHT }, trackStyle]}>
            {tripled.map((value, index) => (
              <DrumRow
                key={index}
                absoluteIndex={index}
                value={value}
                valuesLength={values.length}
                translateY={translateY}
                centerOffsetY={centerOffsetY}
              />
            ))}
          </Animated.View>
        </View>
      </GestureDetector>
      {/* P0: edge fade gradients — pure CSS overlay, UI thread, no animation overhead */}
      <LinearGradient
        colors={[SHEET_BG, 'transparent']}
        pointerEvents="none"
        style={styles.drumFadeTop}
      />
      <LinearGradient
        colors={['transparent', SHEET_BG]}
        pointerEvents="none"
        style={styles.drumFadeBottom}
      />
    </View>
  );
});

export const AddSleepRecordModal = ({
  isVisible,
  onClose,
  onSave,
  date,
  userId,
}: AddSleepRecordModalProps) => {
  const insets = useSafeAreaInsets();

  const translateY = useSharedValue(height);
  const backdropOpacity = useSharedValue(0);
  const slideAnim = useSharedValue(0);

  const [page, setPage] = useState<0 | 1>(0);
  const [bedHour, setBedHour] = useState(23);
  const [bedMinute, setBedMinute] = useState(0);
  const [wakeHour, setWakeHour] = useState(7);
  const [wakeMinute, setWakeMinute] = useState(0);
  const [headerDate, setHeaderDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const stableDateKey = date?.getTime();
  const stableDate = useMemo(() => {
    return stableDateKey !== undefined ? new Date(stableDateKey) : new Date();
  }, [stableDateKey]);

  const durationStr = useMemo(() => {
    let diff = wakeHour * 60 + wakeMinute - (bedHour * 60 + bedMinute);
    if (diff <= 0) diff += 24 * 60;
    const dh = Math.floor(diff / 60);
    const dm = diff % 60;
    return `${dh}h ${dm.toString().padStart(2, '0')}m`;
  }, [bedHour, bedMinute, wakeHour, wakeMinute]);

  const handleBedMinuteIndexChange = useCallback((index: number) => setBedMinute(index * 5), []);
  const handleWakeMinuteIndexChange = useCallback((index: number) => setWakeMinute(index * 5), []);

  useEffect(() => {
    if (isVisible) {
      setHeaderDate(getSmartDateLabel(stableDate));
      setIsSaving(false);
      setValidationError(null);
      setBedHour(23);
      setBedMinute(0);
      setWakeHour(7);
      setWakeMinute(0);
      setPage(0);
      slideAnim.value = 0;
      backdropOpacity.value = withTiming(1, { duration: 280 });
      translateY.value = withSpring(0, SHEET_SPRING);
    } else {
      backdropOpacity.value = 0;
      translateY.value = height;
    }
  }, [backdropOpacity, isVisible, slideAnim, stableDate, translateY]);

  const closeWithAnimation = useCallback(() => {
    backdropOpacity.value = withTiming(0, { duration: 220 });
    translateY.value = withTiming(
      height,
      { duration: 250, easing: Easing.in(Easing.cubic) },
      (finished) => {
        'worklet';
        if (finished) runOnJS(onClose)();
      }
    );
  }, [backdropOpacity, onClose, translateY]);

  const goToPage2 = useCallback(() => {
    setPage(1);
    slideAnim.value = withSpring(1, SLIDE_SPRING);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [slideAnim]);

  const goToPage1 = useCallback(() => {
    setPage(0);
    slideAnim.value = withSpring(0, SLIDE_SPRING);
  }, [slideAnim]);

  const sheetGesture = Gesture.Pan()
    .manualActivation(true)
    .onTouchesDown((e, state) => {
      'worklet';
      const touch = e.changedTouches[0];
      if (!touch) { state.fail(); return; }
      if (touch.y <= 80) state.activate();
      else state.fail();
    })
    .onUpdate((e) => {
      'worklet';
      if (e.translationY > 0) translateY.value = e.translationY;
    })
    .onEnd((e) => {
      'worklet';
      if (translateY.value > 120 || e.velocityY > 600) {
        backdropOpacity.value = withTiming(0, { duration: 220 });
        translateY.value = withTiming(
          height,
          { duration: 250, easing: Easing.in(Easing.cubic) },
          (finished) => {
            'worklet';
            if (finished) runOnJS(onClose)();
          }
        );
      } else {
        translateY.value = withSpring(0, { damping: 32, stiffness: 320, mass: 0.6 });
      }
    });

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  const slidingTrackStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(slideAnim.value, [0, 1], [0, -SCREEN_WIDTH]) }],
  }));

  const page1TitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(slideAnim.value, [0, 0.35], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateX: interpolate(slideAnim.value, [0, 1], [0, -14]) }],
  }));

  const page2TitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(slideAnim.value, [0.5, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateX: interpolate(slideAnim.value, [0, 1], [14, 0]) }],
  }));

  const backBtnStyle = useAnimatedStyle(() => ({
    opacity: interpolate(slideAnim.value, [0.3, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateX: interpolate(slideAnim.value, [0, 1], [-8, 0]) }],
  }));

  // P5: active dot = full white, inactive = rgba(255,255,255,0.3) — clearer step contrast
  const dot1Style = useAnimatedStyle(() => ({
    width: interpolate(slideAnim.value, [0, 1], [20, 8], Extrapolation.CLAMP),
    opacity: interpolate(slideAnim.value, [0, 1], [1, 0.3], Extrapolation.CLAMP),
  }));

  const dot2Style = useAnimatedStyle(() => ({
    width: interpolate(slideAnim.value, [0, 1], [8, 20], Extrapolation.CLAMP),
    opacity: interpolate(slideAnim.value, [0, 1], [0.3, 1], Extrapolation.CLAMP),
  }));

  const handleSave = async () => {
    if (isSaving || !userId) return;
    let diff = wakeHour * 60 + wakeMinute - (bedHour * 60 + bedMinute);
    if (diff <= 0) diff += 24 * 60;
    if (diff < 30) {
      setValidationError('Sleep duration must be at least 30 minutes.');
      return;
    }
    setValidationError(null);
    setIsSaving(true);
    const n = new Date(stableDate);
    const s = new Date(n);
    s.setHours(bedHour, bedMinute, 0, 0);
    const e = new Date(n);
    e.setHours(wakeHour, wakeMinute, 0, 0);
    if (s > e) s.setDate(s.getDate() - 1);
    try {
      const success = await onSave(s, e);
      if (success) closeWithAnimation();
      else setIsSaving(false);
    } catch (error) {
      console.error('[AddSleepRecordModal] Save failed:', error);
      setIsSaving(false);
    }
  };

  if (!isVisible) return null;

  const dateSubtitle = stableDate.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <Modal animationType="none" transparent visible={isVisible} onRequestClose={closeWithAnimation}>
      <Pressable style={styles.backdrop} onPress={closeWithAnimation}>
        <Animated.View
          renderToHardwareTextureAndroid
          shouldRasterizeIOS
          style={[StyleSheet.absoluteFill, backdropStyle]}>
          <BlurView intensity={25} style={StyleSheet.absoluteFill} tint="dark" />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} />
        </Animated.View>
      </Pressable>

      <GestureHandlerRootView style={styles.gestureRoot} pointerEvents="box-none">
        <GestureDetector gesture={sheetGesture}>
          <Animated.View
            renderToHardwareTextureAndroid
            shouldRasterizeIOS
            style={[styles.sheet, { paddingBottom: insets.bottom + 20 }, sheetStyle]}>

            <View style={styles.handleContainer}>
              <View style={styles.handle} />
            </View>

            <View style={styles.header}>
              <Animated.View style={backBtnStyle}>
                <Pressable
                  onPress={goToPage1}
                  style={styles.iconBtn}
                  pointerEvents={page === 1 ? 'auto' : 'none'}>
                  <Ionicons name="chevron-back" size={20} color={SLEEP_THEME.textPrimary} />
                </Pressable>
              </Animated.View>

              <View style={styles.headerCenter}>
                <View style={styles.titleSpacer} pointerEvents="none">
                  <View style={styles.titleRow}>
                    <Text style={styles.title}> </Text>
                  </View>
                  <Text style={styles.subtitle}> </Text>
                </View>

                <Animated.View
                  style={[styles.headerTitleAbs, page1TitleStyle]}
                  pointerEvents="none">
                  <View style={styles.titleRow}>
                    <Ionicons
                      name="moon"
                      size={15}
                      color={SLEEP_THEME.colorBedtime}
                      style={styles.titleIcon}
                    />
                    <Text style={styles.title}>Bedtime</Text>
                  </View>
                  <Text style={styles.subtitle}>
                    {headerDate} · {dateSubtitle}
                  </Text>
                </Animated.View>

                <Animated.View
                  style={[styles.headerTitleAbs, page2TitleStyle]}
                  pointerEvents="none">
                  <View style={styles.titleRow}>
                    <Ionicons
                      name="sunny"
                      size={15}
                      color={SLEEP_THEME.colorAwake}
                      style={styles.titleIcon}
                    />
                    <Text style={styles.title}>Wake Up</Text>
                  </View>
                  <Text style={styles.subtitle}>
                    {headerDate} · {dateSubtitle}
                  </Text>
                </Animated.View>
              </View>

              <Pressable onPress={closeWithAnimation} style={styles.iconBtn}>
                <Ionicons name="close" size={18} color={SLEEP_THEME.textMuted1} />
              </Pressable>
            </View>

            <View style={styles.dotsRow}>
              <Animated.View style={[styles.dot, dot1Style]} />
              <Animated.View style={[styles.dot, dot2Style]} />
            </View>

            <View style={styles.contentClip}>
              <Animated.View style={[styles.slidingTrack, slidingTrackStyle]}>

                <View style={styles.pageSlot}>
                  <View style={styles.pickerCentered}>
                    <View style={styles.drumPairRow}>
                      <DrumPicker
                        values={HOUR_VALUES}
                        selectedIndex={bedHour}
                        onIndexChange={setBedHour}
                        width={HOUR_DRUM_WIDTH}
                      />
                      <Text style={styles.colon}>:</Text>
                      <DrumPicker
                        values={MINUTE_VALUES}
                        selectedIndex={bedMinute / 5}
                        onIndexChange={handleBedMinuteIndexChange}
                        width={MINUTE_DRUM_WIDTH}
                      />
                    </View>
                  </View>

                  <View style={styles.page1Spacer} />

                  <Pressable
                    onPress={goToPage2}
                    style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.85 }]}>
                    <Text style={styles.actionBtnText}>Next</Text>
                    <Ionicons
                      name="arrow-forward"
                      size={17}
                      color={CTA_TEXT_COLOR}
                      style={styles.actionBtnIcon}
                    />
                  </Pressable>
                </View>

                <View style={styles.pageSlot}>
                  <View style={styles.durationBadge}>
                    <Text style={styles.durationText}>{durationStr}</Text>
                  </View>

                  <View style={styles.pickerCentered}>
                    <View style={styles.drumPairRow}>
                      <DrumPicker
                        values={HOUR_VALUES}
                        selectedIndex={wakeHour}
                        onIndexChange={setWakeHour}
                        width={HOUR_DRUM_WIDTH}
                      />
                      <Text style={styles.colon}>:</Text>
                      <DrumPicker
                        values={MINUTE_VALUES}
                        selectedIndex={wakeMinute / 5}
                        onIndexChange={handleWakeMinuteIndexChange}
                        width={MINUTE_DRUM_WIDTH}
                      />
                    </View>
                  </View>

                  <View style={styles.validationRow}>
                    {validationError ? (
                      <Text style={styles.validationError}>{validationError}</Text>
                    ) : null}
                  </View>

                  <Pressable
                    onPress={handleSave}
                    disabled={isSaving || !userId}
                    style={({ pressed }) => [
                      styles.actionBtn,
                      (isSaving || !userId) && styles.actionBtnDisabled,
                      pressed && !(isSaving || !userId) && { opacity: 0.85 },
                    ]}>
                    <Text
                      style={[
                        styles.actionBtnText,
                        (isSaving || !userId) && styles.actionBtnTextDisabled,
                      ]}>
                      {isSaving ? 'Saving...' : 'Save Sleep'}
                    </Text>
                  </Pressable>
                </View>

              </Animated.View>
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

  // P1: sheet background — cardBg (#1C1C1E) so elevatedBg capsule reads clearly
  sheet: {
    backgroundColor: SHEET_BG,
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },

  handleContainer: { alignItems: 'center', paddingTop: 16, paddingBottom: 10 },
  handle: {
    width: 36,
    height: HANDLE_HEIGHT,
    backgroundColor: SLEEP_THEME.border,
    borderRadius: HANDLE_RADIUS,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SHEET_PADDING,
    paddingBottom: 14,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: CLOSE_BTN_RADIUS,
    backgroundColor: SLEEP_THEME.cardBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
  },
  headerTitleAbs: {
    position: 'absolute',
    alignItems: 'center',
    width: '100%',
  },
  titleSpacer: {
    alignItems: 'center',
    opacity: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  titleIcon: { marginRight: 6 },
  title: {
    color: SLEEP_THEME.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    fontFamily: SLEEP_FONTS.bold,
  },
  subtitle: {
    color: SLEEP_THEME.textDisabled,
    fontSize: 12,
    fontFamily: SLEEP_FONTS.regular,
  },

  // P5: dots — active at full opacity, inactive at 0.3 (animated via dot1Style/dot2Style)
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    paddingBottom: 18,
  },
  dot: {
    height: 4,
    borderRadius: 2,
    backgroundColor: SLEEP_THEME.textPrimary,
  },

  contentClip: {
    overflow: 'hidden',
    width: SCREEN_WIDTH,
  },
  slidingTrack: {
    flexDirection: 'row',
    width: SCREEN_WIDTH * 2,
  },
  pageSlot: {
    width: SCREEN_WIDTH,
    paddingHorizontal: SHEET_PADDING,
    alignItems: 'center',
  },

  pickerCentered: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  drumPairRow: {
    width: DRUM_PAIR_WIDTH,
    flexDirection: 'row',
    justifyContent: 'space-between',
    position: 'relative',
  },
  drumFrame: {
    height: PICKER_HEIGHT,
    overflow: 'hidden',
    position: 'relative',
  },
  drumViewport: {
    height: PICKER_HEIGHT,
    overflow: 'hidden',
  },
  drumTrack: { position: 'relative' },
  drumRow: {
    position: 'absolute',
    width: '100%',
    height: ROW_HEIGHT,
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
    color: SLEEP_THEME.textPrimary,
    fontSize: 38,
    fontWeight: '500',
    fontFamily: SLEEP_FONTS.medium,
    fontVariant: ['tabular-nums'],
  },
  // P3: capsule radius derived — SLEEP_LAYOUT.cardRadiusInner minus CAPSULE_INSET offset
  selectionCapsule: {
    position: 'absolute',
    top: ROW_HEIGHT * PADDING_ROWS,
    left: CAPSULE_INSET,
    right: CAPSULE_INSET,
    height: ROW_HEIGHT,
    borderRadius: CAPSULE_RADIUS,
    backgroundColor: SLEEP_THEME.elevatedBg,
  },
  // P0: edge-fade gradient overlays — rendered above drum rows, transparent at center
  drumFadeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: ROW_HEIGHT * PADDING_ROWS,
    pointerEvents: 'none',
  },
  drumFadeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: ROW_HEIGHT * PADDING_ROWS,
    pointerEvents: 'none',
  },
  colon: {
    position: 'absolute',
    left: HOUR_DRUM_WIDTH + 4,
    top: ROW_HEIGHT * 2 + ROW_HEIGHT / 2 - 12,
    color: SLEEP_THEME.textMuted2,
    fontSize: 24,
    fontWeight: '300',
  },

  durationBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: SLEEP_THEME.cardBg,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SLEEP_THEME.border,
  },
  durationText: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: SLEEP_FONTS.medium,
    color: SLEEP_THEME.textMuted1,
    letterSpacing: 0.8,
  },

  page1Spacer: { height: 52 },

  validationRow: {
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  validationError: {
    color: SLEEP_THEME.danger,
    fontSize: 13,
    textAlign: 'center',
  },

  // P2: CTA uses system accent (colorBedtime) — matches sleep context, no hardcoded hex
  actionBtn: {
    width: '100%',
    height: 56,
    borderRadius: 28,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: CTA_BG,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    marginTop: 8,
    marginBottom: 4,
  },
  actionBtnDisabled: { backgroundColor: CTA_BG_DISABLED },
  actionBtnText: {
    color: CTA_TEXT_COLOR,
    fontSize: 17,
    fontWeight: '600',
    fontFamily: SLEEP_FONTS.semiBold,
    letterSpacing: 0.2,
  },
  actionBtnTextDisabled: { color: CTA_TEXT_DISABLED },
  actionBtnIcon: { marginLeft: 7 },
});
