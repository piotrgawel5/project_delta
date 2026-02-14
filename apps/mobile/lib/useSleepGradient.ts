import { useCallback, useEffect, useRef, useState } from 'react';
import {
  cancelAnimation,
  Easing,
  runOnJS,
  SharedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

type UseSleepGradientArgs = {
  initialKey: string;
  defaultColor: string;
  getColorForKey: (key: string) => string;
};

type UseSleepGradientResult = {
  gradientBase: string;
  overlayAColor: string;
  overlayBColor: string;
  overlayAOpacity: SharedValue<number>;
  overlayBOpacity: SharedValue<number>;
  gradientKey: string;
  setGradientKey: (key: string, animate?: boolean) => void;
};

export const useSleepGradient = ({
  initialKey,
  defaultColor,
  getColorForKey,
}: UseSleepGradientArgs): UseSleepGradientResult => {
  const overlayAOpacity = useSharedValue(1);
  const overlayBOpacity = useSharedValue(0);
  const [colors, setColors] = useState({
    base: defaultColor,
    overlayA: defaultColor,
    overlayB: defaultColor,
  });
  const [gradientKey, setGradientKeyState] = useState(initialKey);
  const initialized = useRef(false);
  const currentRef = useRef(defaultColor);
  const animatingRef = useRef(false);
  const pendingRef = useRef<string | null>(null);
  const animationIdRef = useRef(0);
  const animateToRef = useRef<(color: string) => void>(() => {});
  const activeLayerRef = useRef<'A' | 'B'>('A');

  const setImmediate = useCallback((color: string) => {
    cancelAnimation(overlayAOpacity);
    cancelAnimation(overlayBOpacity);
    animatingRef.current = false;
    pendingRef.current = null;
    currentRef.current = color;
    activeLayerRef.current = 'A';
    setColors({ base: color, overlayA: color, overlayB: color });
    overlayAOpacity.value = 1;
    overlayBOpacity.value = 0;
  }, []);

  const handleAnimationEnd = useCallback(
    (id: number) => {
      if (id !== animationIdRef.current) return;
      animatingRef.current = false;
      const active = activeLayerRef.current;
      const currentColor = active === 'A' ? colors.overlayA : colors.overlayB;
      currentRef.current = currentColor;
      setColors((prev) => ({
        base: currentColor,
        overlayA: prev.overlayA,
        overlayB: prev.overlayB,
      }));
      const pending = pendingRef.current;
      pendingRef.current = null;
      if (pending && pending !== currentRef.current) {
        animateToRef.current(pending);
      }
    },
    [colors.overlayA, colors.overlayB]
  );

  const animateTo = useCallback((color: string) => {
    const currentOverlay = currentRef.current;
    cancelAnimation(overlayAOpacity);
    cancelAnimation(overlayBOpacity);
    animatingRef.current = true;
    animationIdRef.current += 1;
    const animationId = animationIdRef.current;
    const nextLayer = activeLayerRef.current === 'A' ? 'B' : 'A';
    activeLayerRef.current = nextLayer;

    setColors((prev) => ({
      base: currentOverlay,
      overlayA: nextLayer === 'A' ? color : prev.overlayA,
      overlayB: nextLayer === 'B' ? color : prev.overlayB,
    }));

    if (nextLayer === 'A') {
      overlayAOpacity.value = 0;
      overlayBOpacity.value = 1;
      overlayAOpacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
      overlayBOpacity.value = withTiming(
        0,
        { duration: 600, easing: Easing.out(Easing.cubic) },
        (finished) => {
          if (!finished) return;
          runOnJS(handleAnimationEnd)(animationId);
        }
      );
    } else {
      overlayBOpacity.value = 0;
      overlayAOpacity.value = 1;
      overlayBOpacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
      overlayAOpacity.value = withTiming(
        0,
        { duration: 600, easing: Easing.out(Easing.cubic) },
        (finished) => {
          if (!finished) return;
          runOnJS(handleAnimationEnd)(animationId);
        }
      );
    }
  }, []);

  animateToRef.current = animateTo;

  const setGradientKey = useCallback(
    (key: string, animate = true) => {
      setGradientKeyState(key);
      const target = getColorForKey(key);
      if (!initialized.current || !animate) {
        setImmediate(target);
        initialized.current = true;
        return;
      }
      if (animatingRef.current) {
        pendingRef.current = target;
        return;
      }
      if (currentRef.current !== target) {
        animateTo(target);
      }
    },
    [animateTo, getColorForKey, setImmediate]
  );

  useEffect(() => {
    if (initialized.current) return;
    const initial = getColorForKey(gradientKey);
    setImmediate(initial);
    initialized.current = true;
  }, [getColorForKey, gradientKey, setImmediate]);

  return {
    gradientBase: colors.base,
    overlayAColor: colors.overlayA,
    overlayBColor: colors.overlayB,
    overlayAOpacity,
    overlayBOpacity,
    gradientKey,
    setGradientKey,
  };
};
