import { useCallback, useEffect, useRef, useState } from 'react';
import { Easing, SharedValue, useSharedValue, withTiming } from 'react-native-reanimated';

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
  const [gradientBase, setGradientBase] = useState(defaultColor);
  const [gradientOverlay, setGradientOverlay] = useState(defaultColor);
  const [gradientKey, setGradientKeyState] = useState(initialKey);
  const initialized = useRef(false);

  const setImmediate = useCallback((color: string) => {
    setGradientBase(color);
    setGradientOverlay(color);
    gradientProgress.value = 1;
  }, []);

  const animateTo = useCallback(
    (color: string) => {
      setGradientBase(gradientOverlay);
      setGradientOverlay(color);
      gradientProgress.value = 0;
      gradientProgress.value = withTiming(1, {
        duration: 600,
        easing: Easing.out(Easing.cubic),
      });
    },
    [gradientOverlay]
  );

  const setGradientKey = useCallback(
    (key: string, animate = true) => {
      setGradientKeyState(key);
      const target = getColorForKey(key);
      if (!initialized.current || !animate) {
        setImmediate(target);
        initialized.current = true;
        return;
      }
      if (gradientOverlay !== target) {
        animateTo(target);
      }
    },
    [animateTo, getColorForKey, gradientOverlay, setImmediate]
  );

  useEffect(() => {
    if (initialized.current) return;
    const initial = getColorForKey(gradientKey);
    setImmediate(initial);
    initialized.current = true;
  }, [getColorForKey, gradientKey, setImmediate]);

  return { gradientBase, gradientOverlay, gradientProgress, gradientKey, setGradientKey };
};
