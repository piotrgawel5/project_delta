import React, { useEffect, useMemo, useRef } from 'react';
import Svg, { G, Circle } from 'react-native-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  View,
  Text,
  Pressable,
  useWindowDimensions,
  Animated,
  AccessibilityInfo,
} from 'react-native';

// This variant uses nativewind (className) for styling and a neutral color palette.
// Accessibility improvements, responsive layout and clearer spacing were prioritized.

type Color = string;

interface ActivityProps {
  radius: number;
  color: Color;
  progress: number; // 0..1
}

const Colors = {
  primary: '#10B981', // Emerald Green – fresh, healthy, success (perfect for main actions & health score)
  secondary: '#3B82F6', // Vibrant Blue – calm, trust (great for sleep/hydration)
  accent: '#F59E0B', // Warm Amber – energy, motivation
};

const ColorsMacros = {
  carbs: '#F59E0B', // Amber – matches accent, classic for carbs
  protein: '#10B981', // Emerald – matches primary, strong & healthy
  fat: '#EF4444', // Soft Red – clear distinction for fats
};

const macros = {
  carbs: { current: 185, goal: 250, unit: 'g' },
  protein: { current: 142, goal: 160, unit: 'g' },
  fat: { current: 62, goal: 80, unit: 'g' },
};

const clamp = (v: number, a = 0, b = 1) => Math.min(Math.max(v, a), b);

const AnimatedCircle: any = Animated.createAnimatedComponent(Circle);

const MacroProgressBar = ({
  label,
  current,
  goal,
  color,
  icon,
}: {
  label: string;
  current: number;
  goal: number;
  color: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
}) => {
  const progress = clamp(current / goal, 0, 1);
  const widthAnim = useRef(new Animated.Value(progress * 100)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: progress * 100,
      duration: 420,
      useNativeDriver: false,
    }).start();
  }, [progress, widthAnim]);

  const percentage = Math.round(progress * 100);

  return (
    <View className="mb-4 w-full">
      <View className="mb-2 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <MaterialCommunityIcons name={icon} size={18} color={color} />
          <Text className="ml-2 text-base font-semibold text-neutral-100">{label}</Text>
        </View>
        <Text className="text-sm text-neutral-300">
          {current}/{goal} {/* unit intentionally inline */}
        </Text>
      </View>

      <View className="h-3 overflow-hidden rounded-full bg-neutral-700">
        <Animated.View
          style={{
            height: '100%',
            borderRadius: 999,
            backgroundColor: color,
            width: widthAnim.interpolate({
              inputRange: [0, 100],
              outputRange: ['0%', '100%'],
            }) as any,
          }}
        />
      </View>

      <Text className="mt-1 text-right text-xs text-neutral-400">{percentage}%</Text>
    </View>
  );
};

const Ring = ({
  radius,
  color,
  progress,
  center,
  strokeWidth,
}: ActivityProps & { center: number; strokeWidth: number }) => {
  const circumference = 2 * Math.PI * radius;
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: clamp(progress, 0, 1),
      duration: 640,
      useNativeDriver: true,
    }).start();
  }, [progress, anim]);

  const strokeDashoffset = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  }) as any;

  return (
    <G rotation="-90" origin={`${center}, ${center}`}>
      <Circle
        cx={center}
        cy={center}
        r={radius}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeOpacity={0.12}
        fill="transparent"
      />
      <AnimatedCircle
        cx={center}
        cy={center}
        r={radius}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={`${circumference}`}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        fill="transparent"
      />
    </G>
  );
};

const SmallMetricCard = ({
  icon,
  label,
  value,
  unit,
  color,
  onPress,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  value: number | string;
  unit: string;
  color: string;
  onPress?: () => void;
}) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={`${label}, ${value}${unit}`}
    className="min-w-[68] items-center px-3 py-2">
    <MaterialCommunityIcons name={icon} size={20} color={color} />
    <Text className="mt-1 text-sm font-bold text-neutral-100">
      {value}
      {unit}
    </Text>
    <Text className="text-xs text-neutral-300">{label}</Text>
  </Pressable>
);

export default function ActivityMetrics() {
  const { width } = useWindowDimensions();
  const isNarrow = width < 720; // breakpoint: stacked under 720

  const size = Math.min(180, Math.max(140, Math.floor(width * 0.36)));
  const strokeWidth = 10;
  const center = size / 2;

  const macroScore = useMemo(() => {
    const p = clamp((macros.protein.current / macros.protein.goal) * 100, 0, 100);
    const c = clamp((macros.carbs.current / macros.carbs.goal) * 100, 0, 100);
    const f = clamp((macros.fat.current / macros.fat.goal) * 100, 0, 100);
    return Math.round((p + c + f) / 3);
  }, []);

  const sleepScore = 7.5;
  const waterScore = 2.8;

  const overallHealthScore = Math.round(
    macroScore * 0.5 +
      clamp((sleepScore / 8) * 100, 0, 100) * 0.3 +
      clamp((waterScore / 3) * 100, 0, 100) * 0.2
  );

  return (
    <View className="p-3">
      <View
        className={`${isNarrow ? 'flex-col' : 'flex-row'} ${isNarrow ? 'space-y-3' : 'space-x-3'}`}>
        {/* Left: rings */}
        <View className={`${isNarrow ? 'w-full' : 'flex-1'} p-2`}>
          <View className="relative h-72 items-center justify-center rounded-2xl bg-neutral-900 p-3">
            <Svg width={size} height={size}>
              <Ring
                radius={Math.floor(size * 0.36)}
                color={Colors.primary}
                progress={macroScore / 100}
                center={center}
                strokeWidth={strokeWidth}
              />
              <Ring
                radius={Math.floor(size * 0.26)}
                color={Colors.secondary}
                progress={clamp(sleepScore / 9, 0, 1)}
                center={center}
                strokeWidth={strokeWidth}
              />
              <Ring
                radius={Math.floor(size * 0.16)}
                color={Colors.accent}
                progress={clamp(waterScore / 3, 0, 1)}
                center={center}
                strokeWidth={strokeWidth}
              />
            </Svg>

            <View className="mt-3 w-full flex-row justify-around">
              <SmallMetricCard
                icon="food-apple"
                label="Macros"
                value={macroScore}
                unit="%"
                color={Colors.primary}
                onPress={() =>
                  AccessibilityInfo.announceForAccessibility(`Macros ${macroScore} percent`)
                }
              />
              <SmallMetricCard
                icon="sleep"
                label="Sleep"
                value={sleepScore}
                unit="h"
                color={Colors.secondary}
                onPress={() =>
                  AccessibilityInfo.announceForAccessibility(`Sleep ${sleepScore} hours`)
                }
              />
              <SmallMetricCard
                icon="cup-water"
                label="Water"
                value={waterScore}
                unit="L"
                color={Colors.accent}
                onPress={() =>
                  AccessibilityInfo.announceForAccessibility(`Water ${waterScore} liters`)
                }
              />
            </View>

            <View className="absolute top-4 left-4">
              <View className="items-center justify-center rounded-full bg-emerald-500/20 px-3 py-1 backdrop-blur-md">
                <View className="flex-row items-baseline">
                  <Text className="text-lg font-bold text-emerald-400">{overallHealthScore}</Text>
                  <Text className="ml-0.5 text-[9px] font-medium text-emerald-300/80 uppercase">
                    pts
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Right: macros list */}
        <View className={`${isNarrow ? 'w-full' : 'w-80'} p-2`}>
          <View className="h-72 rounded-2xl bg-neutral-900 p-4">
            <View className="mb-3 items-center">
              <Text className="text-lg font-bold text-neutral-100">Daily Macros</Text>
              <Text className="text-xs text-neutral-300">Nutrient breakdown</Text>
            </View>

            <View className="flex-1 justify-center">
              <MacroProgressBar
                label="Carbs"
                current={macros.carbs.current}
                goal={macros.carbs.goal}
                color={ColorsMacros.carbs}
                icon="bread-slice"
              />
              <MacroProgressBar
                label="Protein"
                current={macros.protein.current}
                goal={macros.protein.goal}
                color={ColorsMacros.protein}
                icon="food-drumstick"
              />
              <MacroProgressBar
                label="Fat"
                current={macros.fat.current}
                goal={macros.fat.goal}
                color={ColorsMacros.fat}
                icon="cheese"
              />
            </View>
          </View>
        </View>
      </View>

      <View className="mt-3">
        <View className="h-20 w-full items-center justify-center rounded-xl bg-neutral-700">
          <Text className="text-sm font-semibold text-neutral-100">
            Daily summary & actionable tip
          </Text>
        </View>
      </View>
    </View>
  );
}
