import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  gradientOverlay: string;
  gradientProgress: SharedValue<number>;
  gradientKey: string;
  setGradientKey: (key: string, animate?: boolean) => void;
};

export const useSleepGradient = ({
  initialKey,
  defaultColor,
  getColorForKey,
}: UseSleepGradientArgs): UseSleepGradientResult => {
  const gradientProgress = useSharedValue(1);
  const [colors, setColors] = useState({ base: defaultColor, overlay: defaultColor });
  const [gradientKey, setGradientKeyState] = useState(initialKey);
  const initialized = useRef(false);
  const currentRef = useRef(defaultColor);
  const animatingRef = useRef(false);
  const pendingRef = useRef<string | null>(null);
  const animationIdRef = useRef(0);
  const animateToRef = useRef<(color: string) => void>(() => {});
  const pendingAnimRef = useRef<{ id: number; base: string; overlay: string } | null>(
    null
  );
  const setImmediate = useCallback((color: string) => {
    cancelAnimation(gradientProgress);
    animatingRef.current = false;
    pendingRef.current = null;
    pendingAnimRef.current = null;
    currentRef.current = color;
    setColors({ base: color, overlay: color });
    gradientProgress.value = 1;
  }, []);

  const handleAnimationEnd = useCallback((id: number) => {
    if (id !== animationIdRef.current) return;
    animatingRef.current = false;
    currentRef.current = colors.overlay;
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending && pending !== currentRef.current) {
      animateToRef.current(pending);
    }
  }, [colors.overlay]);

  const animateTo = useCallback((color: string) => {
    const currentOverlay = currentRef.current;
    cancelAnimation(gradientProgress);
    animatingRef.current = true;
    animationIdRef.current += 1;
    const animationId = animationIdRef.current;
    setColors({ base: currentOverlay, overlay: color });
    pendingAnimRef.current = { id: animationId, base: currentOverlay, overlay: color };
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

  useLayoutEffect(() => {
    const pending = pendingAnimRef.current;
    if (!pending) return;
    if (pending.id !== animationIdRef.current) {
      pendingAnimRef.current = null;
      return;
    }
    if (colors.base !== pending.base || colors.overlay !== pending.overlay) return;
    pendingAnimRef.current = null;
    gradientProgress.value = 0;
    gradientProgress.value = withTiming(
      1,
      {
        duration: 600,
        easing: Easing.out(Easing.cubic),
      },
      (finished) => {
        if (!finished) return;
        runOnJS(handleAnimationEnd)(pending.id);
      }
    );
  }, [colors.base, colors.overlay]);

  useEffect(() => {}, []);

  return {
    gradientBase: colors.base,
    gradientOverlay: colors.overlay,
    gradientProgress,
    gradientKey,
    setGradientKey,
  };
};
