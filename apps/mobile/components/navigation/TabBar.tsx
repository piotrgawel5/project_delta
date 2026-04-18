// components/navigation/TabBar.tsx
import React, { memo } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import { SLEEP_THEME, SLEEP_FONTS } from '@constants';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface TabItem {
  name: string;
  icon: string;
  iconFilled: string;
  label: string;
}

const TABS: TabItem[] = [
  { name: 'nutrition', icon: 'food-apple-outline', iconFilled: 'food-apple', label: 'Nutrition' },
  { name: 'workout', icon: 'dumbbell', iconFilled: 'dumbbell', label: 'Workout' },
  { name: 'sleep', icon: 'power-sleep', iconFilled: 'power-sleep', label: 'Sleep' },
  { name: 'account', icon: 'account-outline', iconFilled: 'account', label: 'Account' },
];

interface TabBarProps {
  activeTab: string;
  onTabPress: (tabName: string) => void;
}

function TabBar({ activeTab, onTabPress }: TabBarProps) {
  return (
    <View style={styles.container}>
      <BlurView intensity={80} tint="dark" style={styles.blurContainer}>
        <View style={styles.tabContainer}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.name;

            return (
              <TabItem
                key={tab.name}
                tab={tab}
                isActive={isActive}
                onPress={() => onTabPress(tab.name)}
              />
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}

export default TabBar;

interface TabItemProps {
  tab: TabItem;
  isActive: boolean;
  onPress: () => void;
}

const TabItem = memo(function TabItem({ tab, isActive, onPress }: TabItemProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.9, { damping: 15, stiffness: 200 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 200 });
  };

  return (
    <Pressable
      style={styles.tabItem}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}>
      <Animated.View style={[styles.tabContent, animatedStyle]}>
        <View style={[styles.iconContainer, isActive && styles.iconContainerActive]}>
          <MaterialCommunityIcons
            name={(isActive ? tab.iconFilled : tab.icon) as any}
            size={24}
            color={isActive ? SLEEP_THEME.success : 'rgba(255,255,255,0.5)'}
          />
        </View>
        <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
      </Animated.View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
  },
  blurContainer: {
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(28, 28, 30, 0.6)',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
  },
  tabContent: {
    alignItems: 'center',
    gap: 4,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainerActive: {
    backgroundColor: 'rgba(48, 209, 88, 0.15)',
  },
  tabLabel: {
    fontSize: 11,
    fontFamily: SLEEP_FONTS.regular,
    color: 'rgba(255,255,255,0.5)',
  },
  tabLabelActive: {
    fontFamily: SLEEP_FONTS.semiBold,
    color: SLEEP_THEME.success,
  },
});
