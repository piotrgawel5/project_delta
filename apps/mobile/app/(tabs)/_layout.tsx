import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, Pressable } from 'react-native';
import { MaterialTopTabs } from '../../components/navigation/MaterialTopTabs';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MaterialTopTabBarProps } from '@react-navigation/material-top-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useAuthStore } from '@store/authStore';
import { SLEEP_FONTS, SLEEP_LAYOUT, SLEEP_THEME } from '@constants';
import {
  cleanupSleepStoreListeners,
  initSleepStoreListeners,
  useSleepStore,
} from '@store/sleepStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TAB_BAR_WIDTH = SCREEN_WIDTH - SLEEP_LAYOUT.navbarSideMargin * 2;
const INDICATOR_WIDTH = 76;
const INDICATOR_HEIGHT = 52;

function getIconName(routeName: string, focused: boolean) {
  switch (routeName) {
    case 'nutrition':
      return focused ? 'food-apple' : 'food-apple-outline';
    case 'workout':
      return 'dumbbell';
    case 'sleep':
      return focused ? 'bed-king' : 'bed-king-outline';
    case 'account':
      return focused ? 'account' : 'account-outline';
    default:
      return 'circle';
  }
}

function TabButton({
  routeName,
  label,
  focused,
  color,
  onPress,
}: {
  routeName: string;
  label: string;
  focused: boolean;
  color: string;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPressIn={() => {
        scale.value = withSpring(0.92, { damping: 15, stiffness: 200 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15, stiffness: 200 });
      }}
      onPress={onPress}
      style={styles.tabItem}>
      <Animated.View style={[styles.tabInner, animatedStyle, !focused && styles.tabInnerInactive]}>
        <MaterialCommunityIcons name={getIconName(routeName, focused)} size={24} color={color} />
        {focused ? <Animated.Text style={styles.activeLabel}>{label}</Animated.Text> : null}
      </Animated.View>
    </Pressable>
  );
}

function FloatingTabBar({ state, descriptors, navigation }: MaterialTopTabBarProps) {
  const insets = useSafeAreaInsets();
  const routes = state.routes;
  const tabWidth = TAB_BAR_WIDTH / routes.length;
  const indicatorLeft = useSharedValue(state.index * tabWidth + (tabWidth - INDICATOR_WIDTH) / 2);

  useEffect(() => {
    indicatorLeft.value = withSpring(state.index * tabWidth + (tabWidth - INDICATOR_WIDTH) / 2, {
      damping: 64,
      stiffness: 256,
    });
  }, [indicatorLeft, state.index, tabWidth]);

  const indicatorStyle = useAnimatedStyle(() => ({
    left: indicatorLeft.value,
  }));

  return (
    <View
      style={[
        styles.tabBarContainer,
        {
          bottom: SLEEP_LAYOUT.navbarBottom + insets.bottom,
        },
      ]}>
      <BlurView
        intensity={SLEEP_THEME.navbarBlurIntensity}
        tint="dark"
        style={styles.blurBackground}
      />
      <Animated.View style={[styles.activeIndicator, indicatorStyle]} />

      <View style={styles.tabsContent}>
        {routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const iconColor = SLEEP_THEME.navbarActiveColor;

          const onPress = () => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TabButton
              key={route.key}
              routeName={route.name}
              label={options.title || route.name}
              focused={isFocused}
              color={iconColor}
              onPress={onPress}
            />
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  const userId = useAuthStore((state) => state.user?.id);
  const checkHealthConnectStatus = useSleepStore((state) => state.checkHealthConnectStatus);
  const fetchSleepData = useSleepStore((state) => state.fetchSleepData);
  const prefetchStartedForUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) {
      prefetchStartedForUserRef.current = null;
      return;
    }

    if (prefetchStartedForUserRef.current === userId) {
      return;
    }
    prefetchStartedForUserRef.current = userId;

    void (async () => {
      try {
        await checkHealthConnectStatus();
        await fetchSleepData(userId);
      } catch (error) {
        console.warn('[TabLayout] Sleep prefetch failed', error);
      }
    })();
  }, [userId, checkHealthConnectStatus, fetchSleepData]);

  useEffect(() => {
    initSleepStoreListeners(userId);
    return () => {
      cleanupSleepStoreListeners();
    };
  }, [userId]);

  return (
    <MaterialTopTabs
      tabBarPosition="bottom"
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        swipeEnabled: false,
        animationEnabled: true,
      }}>
      <MaterialTopTabs.Screen name="nutrition" options={{ title: 'Nutrition' }} />
      <MaterialTopTabs.Screen name="workout" options={{ title: 'Workout' }} />
      <MaterialTopTabs.Screen name="sleep" options={{ title: 'Sleep' }} />
      <MaterialTopTabs.Screen name="account" options={{ title: 'Account' }} />
    </MaterialTopTabs>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    position: 'absolute',
    left: SLEEP_LAYOUT.navbarSideMargin,
    right: SLEEP_LAYOUT.navbarSideMargin,
    width: TAB_BAR_WIDTH,
    height: SLEEP_LAYOUT.navbarHeight,
    borderRadius: SLEEP_LAYOUT.navbarHeight / 2,
    overflow: 'hidden',
    shadowColor: SLEEP_THEME.screenBg,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.42,
    shadowRadius: 24,
    elevation: 16,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: SLEEP_THEME.navbarBorder,
  },
  blurBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,10,10,0.58)',
  },
  tabsContent: {
    flexDirection: 'row',
    height: '100%',
    alignItems: 'center',
  },
  tabItem: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 1,
  },
  tabInnerInactive: {
    opacity: SLEEP_THEME.navbarInactiveOpacity,
  },
  iconGlyphWrap: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIndicator: {
    position: 'absolute',
    top: (SLEEP_LAYOUT.navbarHeight - INDICATOR_HEIGHT) / 2,
    width: INDICATOR_WIDTH,
    height: INDICATOR_HEIGHT,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  activeLabel: {
    marginTop: 2,
    color: SLEEP_THEME.navbarActiveColor,
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 10.5,
    lineHeight: 13,
  },
});
