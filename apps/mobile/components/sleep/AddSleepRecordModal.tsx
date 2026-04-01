import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Dimensions,
  Pressable,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
  withTiming,
  interpolate,
  Extrapolation,
  Easing,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height } = Dimensions.get('window');

// Visual Constants
const SHEET_PADDING = 20;
const SHEET_INNER_RADIUS = 24;
const SHEET_RADIUS = SHEET_INNER_RADIUS + SHEET_PADDING;
const CLOSE_BTN_PADDING = 6;
const CLOSE_BTN_INNER_RADIUS = 6;
const CLOSE_BTN_RADIUS = CLOSE_BTN_INNER_RADIUS + CLOSE_BTN_PADDING;
const HANDLE_HEIGHT = 5;
const HANDLE_RADIUS = HANDLE_HEIGHT / 2;
const CARD_BG = '#000000';
const POPUP_BG = '#0B0B0D';
const SAVE_BTN_BG = '#FFFFFF';
const SAVE_BTN_BORDER = 'rgba(15, 17, 23, 0.14)';
const SAVE_BTN_TEXT = '#111111';
const SAVE_BTN_DISABLED_BG = '#E5E7EB';
const SAVE_BTN_DISABLED_TEXT = '#9CA3AF';
const ROW_HEIGHT = 52;
const VISIBLE_ROWS = 5;
const PADDING_ROWS = 2;
const REPEAT = 60;
const PICKER_HEIGHT = ROW_HEIGHT * VISIBLE_ROWS;
const HOUR_DRUM_WIDTH = 90;
const MINUTE_DRUM_WIDTH = 72;
const DRUM_PAIR_WIDTH = HOUR_DRUM_WIDTH + MINUTE_DRUM_WIDTH + 16;
const HOUR_VALUES = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
const MINUTE_VALUES = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0'));

interface AddSleepRecordModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSave: (startTime: Date, endTime: Date) => Promise<boolean>;
  date?: Date; // Reference date for the sleep record
  userId: string;
}

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

type DrumPickerProps = {
  values: string[];
  selectedIndex: number;
  onIndexChange: (index: number) => void;
  width: number;
};

const DrumPicker = React.memo(function DrumPicker({
  values,
  selectedIndex,
  onIndexChange,
  width,
}: DrumPickerProps) {
  type DrumRowProps = {
    absoluteIndex: number;
    value: string;
    valuesLength: number;
    scrollY: Readonly<{ value: number }>;
  };

  const repeatedValues = useMemo(
    () => Array.from({ length: values.length * REPEAT }, (_, index) => values[index % values.length]),
    [values]
  );
  const middleBaseIndex = useMemo(
    () => Math.floor(REPEAT / 2) * values.length,
    [values.length]
  );
  const initialAbsoluteIndex = middleBaseIndex + selectedIndex;
  const scrollY = useSharedValue(initialAbsoluteIndex * ROW_HEIGHT);
  const listRef = React.useRef<FlatList<string>>(null);
  const currentAbsoluteIndexRef = React.useRef(initialAbsoluteIndex);
  const lastReportedIndexRef = React.useRef(selectedIndex);
  const DrumRow = useMemo(
    () =>
      React.memo(function DrumRow({
        absoluteIndex,
        value,
        valuesLength,
        scrollY,
      }: DrumRowProps) {
        const animStyle = useAnimatedStyle(() => {
          const centeredIndex = scrollY.value / ROW_HEIGHT;
          const trueCenter = ((centeredIndex % valuesLength) + valuesLength) % valuesLength;
          const trueThis = ((absoluteIndex % valuesLength) + valuesLength) % valuesLength;
          let dist = Math.abs(trueThis - trueCenter);
          dist = Math.min(dist, valuesLength - dist);

          const opacity = interpolate(dist, [0, 1, 2], [1, 0.6, 0.25], Extrapolation.CLAMP);
          const scale = interpolate(dist, [0, 1, 2], [1, 0.72, 0.52], Extrapolation.CLAMP);

          return { opacity, transform: [{ scale }] };
        });

        return (
          <Animated.Text style={[styles.drumRow, animStyle]}>
            {value}
          </Animated.Text>
        );
      }),
    []
  );

  const triggerLightHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  useEffect(() => {
    const targetAbsoluteIndex = middleBaseIndex + selectedIndex;
    lastReportedIndexRef.current = selectedIndex;
    if (currentAbsoluteIndexRef.current === targetAbsoluteIndex) return;

    currentAbsoluteIndexRef.current = targetAbsoluteIndex;
    scrollY.value = targetAbsoluteIndex * ROW_HEIGHT;
    listRef.current?.scrollToOffset({
      offset: targetAbsoluteIndex * ROW_HEIGHT,
      animated: false,
    });
  }, [middleBaseIndex, scrollY, selectedIndex]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const handleSnapEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const rawIndex = Math.round(event.nativeEvent.contentOffset.y / ROW_HEIGHT);
      const normalizedIndex = ((rawIndex % values.length) + values.length) % values.length;
      const middleAbsoluteIndex = middleBaseIndex + normalizedIndex;

      if (rawIndex !== middleAbsoluteIndex) {
        listRef.current?.scrollToOffset({
          offset: middleAbsoluteIndex * ROW_HEIGHT,
          animated: false,
        });
      }

      currentAbsoluteIndexRef.current = middleAbsoluteIndex;
      scrollY.value = middleAbsoluteIndex * ROW_HEIGHT;

      if (lastReportedIndexRef.current !== normalizedIndex) {
        lastReportedIndexRef.current = normalizedIndex;
        triggerLightHaptic();
        onIndexChange(normalizedIndex);
      }
    },
    [middleBaseIndex, onIndexChange, scrollY, triggerLightHaptic, values.length]
  );

  const getItemLayout = useCallback(
    (_: ArrayLike<string> | null | undefined, index: number) => ({
      length: ROW_HEIGHT,
      offset: ROW_HEIGHT * index,
      index,
    }),
    []
  );

  const renderItem = useCallback(
    ({ item, index }: { item: string; index: number }) => (
      <DrumRow
        absoluteIndex={index}
        value={item}
        valuesLength={values.length}
        scrollY={scrollY}
      />
    ),
    [DrumRow, scrollY, values.length]
  );

  const keyExtractor = useCallback((_: string, index: number) => index.toString(), []);

  return (
    <View style={[styles.drumFrame, { width }]}>
      <Animated.FlatList
        ref={listRef}
        data={repeatedValues}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        initialScrollIndex={initialAbsoluteIndex}
        getItemLayout={getItemLayout}
        snapToInterval={ROW_HEIGHT}
        decelerationRate="fast"
        disableIntervalMomentum={false}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        removeClippedSubviews
        scrollEventThrottle={16}
        windowSize={5}
        initialNumToRender={VISIBLE_ROWS + 2}
        maxToRenderPerBatch={VISIBLE_ROWS + 2}
        contentContainerStyle={styles.drumContent}
        style={styles.drumViewport}
        onScroll={scrollHandler}
        onMomentumScrollEnd={handleSnapEnd}
      />

      <View pointerEvents="none" style={styles.selectionLineTop} />
      <View pointerEvents="none" style={styles.selectionLineBottom} />
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

  const [bedHour, setBedHour] = useState(23);
  const [bedMinute, setBedMinute] = useState(0);
  const [wakeHour, setWakeHour] = useState(7);
  const [wakeMinute, setWakeMinute] = useState(0);
  const [headerDate, setHeaderDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Stabilize date to prevent infinite re-renders when parent passes new Date()
  const stableDateKey = date?.getTime();
  const stableDate = useMemo(() => {
    return stableDateKey !== undefined ? new Date(stableDateKey) : new Date();
  }, [stableDateKey]);

  const durationStr = useMemo(() => {
    let startMins = bedHour * 60 + bedMinute;
    let endMins = wakeHour * 60 + wakeMinute;
    let diff = endMins - startMins;
    if (diff <= 0) diff += 24 * 60;
    const dh = Math.floor(diff / 60);
    const dm = diff % 60;
    return `${dh}h ${dm.toString().padStart(2, '0')}m`;
  }, [bedHour, bedMinute, wakeHour, wakeMinute]);

  const handleBedMinuteIndexChange = useCallback((index: number) => {
    setBedMinute(index * 5);
  }, []);

  const handleWakeMinuteIndexChange = useCallback((index: number) => {
    setWakeMinute(index * 5);
  }, []);

  useEffect(() => {
    if (isVisible) {
      setHeaderDate(getSmartDateLabel(stableDate));
      setIsSaving(false);
      setValidationError(null);
      setBedHour(23);
      setBedMinute(0);
      setWakeHour(7);
      setWakeMinute(0);
      backdropOpacity.value = withTiming(1, { duration: 280 });
      translateY.value = withTiming(0, { duration: 350, easing: Easing.out(Easing.cubic) });
    } else {
      backdropOpacity.value = 0;
      translateY.value = height;
    }
  }, [backdropOpacity, isVisible, stableDate, translateY]);

  const finishClose = useCallback(() => {
    setTimeout(onClose, 260);
  }, [onClose]);

  const closeWithAnimation = useCallback(() => {
    backdropOpacity.value = withTiming(0, { duration: 220 });
    translateY.value = withTiming(height, { duration: 250, easing: Easing.in(Easing.cubic) });
    finishClose();
  }, [backdropOpacity, finishClose, translateY]);

  // ------------------------------------------------------------------
  // Sheet Dismiss Gesture
  // ------------------------------------------------------------------
  const sheetGesture = Gesture.Pan()
    .manualActivation(true)
    .onTouchesDown((e, state) => {
      'worklet';
      const touch = e.changedTouches[0];
      if (!touch) {
        state.fail();
        return;
      }

      if (touch.y <= 80) {
        state.activate();
      } else {
        state.fail();
      }
    })
    .onUpdate((e) => {
      'worklet';
      if (e.translationY > 0) {
        translateY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      'worklet';
      if (translateY.value > 120 || e.velocityY > 600) {
        backdropOpacity.value = withTiming(0, { duration: 220 });
        translateY.value = withTiming(height, { duration: 250 });
        runOnJS(finishClose)();
      } else {
        translateY.value = withTiming(0, { duration: 200 });
      }
    });

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
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

    const n = new Date(stableDate); // Use the stabilized date
    const s = new Date(n);
    s.setHours(bedHour, bedMinute, 0, 0);
    const e = new Date(n);
    e.setHours(wakeHour, wakeMinute, 0, 0);

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
            {/* Expanded Header Zone for Gestures */}
            <View style={styles.headerZone}>
              <View style={styles.handleContainer}>
                <View style={styles.handle} />
              </View>

              <View style={styles.header}>
                <View style={styles.headerText}>
                  <Text style={styles.title}>{headerDate}</Text>
                  <Text style={styles.subtitle}>
                    {stableDate.toLocaleDateString('en-GB', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })}
                  </Text>
                </View>
                <Pressable onPress={closeWithAnimation} style={styles.closeBtn}>
                  <Ionicons name="close" size={18} color="#8E8E93" />
                </Pressable>
              </View>
            </View>

            <View style={styles.content}>
              <View style={styles.pickerSection}>
                <View style={styles.pickerColumns}>
                  <View style={styles.drumPairColumn}>
                    <Text style={styles.drumLabel}>BEDTIME</Text>
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
                  <View style={styles.drumPairColumn}>
                    <Text style={styles.drumLabel}>WAKE UP</Text>
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
                </View>
              </View>

              <View style={styles.durationRow}>
                <Text style={styles.durationText}>{durationStr}</Text>
              </View>

              {validationError && <Text style={styles.validationError}>{validationError}</Text>}

              {/* Save button */}
              <Pressable
                onPress={handleSave}
                disabled={isSaving || !userId}
                style={({ pressed }) => [
                  styles.saveBtn,
                  (isSaving || !userId) && styles.saveBtnDisabled,
                  pressed && !(isSaving || !userId) && { opacity: 0.85 },
                ]}>
                <Text
                  style={[styles.saveBtnText, (isSaving || !userId) && styles.saveBtnTextDisabled]}>
                  {isSaving ? 'Saving...' : 'Save Sleep'}
                </Text>
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
    paddingTop: 16,
  },
  handleContainer: { alignItems: 'center', marginBottom: 8 },
  handle: { width: 36, height: 5, backgroundColor: '#48484A', borderRadius: HANDLE_RADIUS },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  headerText: {
    flexDirection: 'column',
    gap: 2,
  },
  title: { color: 'white', fontSize: 19, fontWeight: '700' },
  subtitle: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    fontWeight: '400',
  },
  closeBtn: { padding: 6, backgroundColor: POPUP_BG, borderRadius: CLOSE_BTN_RADIUS },
  content: { alignItems: 'center', paddingHorizontal: 20 },
  pickerSection: {
    width: '100%',
  },
  pickerColumns: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  drumPairColumn: {
    alignItems: 'center',
  },
  drumLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6B7280',
    letterSpacing: 1.4,
    marginBottom: 12,
    textAlign: 'center',
  },
  drumPairRow: {
    width: DRUM_PAIR_WIDTH,
    position: 'relative',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  drumFrame: {
    height: PICKER_HEIGHT,
    overflow: 'hidden',
    position: 'relative',
  },
  drumViewport: {
    height: PICKER_HEIGHT,
  },
  drumContent: {
    paddingTop: ROW_HEIGHT * PADDING_ROWS,
    paddingBottom: ROW_HEIGHT * PADDING_ROWS,
  },
  drumRow: {
    width: '100%',
    height: ROW_HEIGHT,
    textAlignVertical: 'center',
    textAlign: 'center',
    color: '#F9FAFB',
    fontSize: 38,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
  selectionLineTop: {
    position: 'absolute',
    top: ROW_HEIGHT * 2,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  selectionLineBottom: {
    position: 'absolute',
    top: ROW_HEIGHT * 3,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  colon: {
    position: 'absolute',
    left: HOUR_DRUM_WIDTH + 4,
    top: ROW_HEIGHT * 2 + ROW_HEIGHT / 2 - 12,
    color: '#4B5563',
    fontSize: 24,
    fontWeight: '300',
  },
  durationRow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  durationText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#6B7280',
    letterSpacing: 1.2,
  },
  validationError: {
    color: '#FF6B6B',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
  },
  saveBtn: {
    width: '100%',
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: SAVE_BTN_BG,
    borderWidth: 1,
    borderColor: SAVE_BTN_BORDER,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  saveBtnDisabled: {
    backgroundColor: SAVE_BTN_DISABLED_BG,
  },
  saveBtnText: { color: SAVE_BTN_TEXT, fontSize: 17, fontWeight: '600', letterSpacing: 0.2 },
  saveBtnTextDisabled: { color: SAVE_BTN_DISABLED_TEXT },
});
