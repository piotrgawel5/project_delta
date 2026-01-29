// app/(tabs)/_layout.tsx
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, Pressable, Animated } from 'react-native';
import { MaterialTopTabs } from '../../components/navigation/MaterialTopTabs';
import { BlurView } from 'expo-blur';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MaterialTopTabBarProps } from '@react-navigation/material-top-tabs';
import Svg, { Circle, Path, G } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ACCENT = '#30D158';
const SLEEP_ACCENT = '#3E42A9'; // Blue for sleep page
const TAB_BAR_MARGIN = 16;
const TAB_BAR_WIDTH = SCREEN_WIDTH - TAB_BAR_MARGIN * 2;

// Animated SVG components
const AnimatedG = Animated.createAnimatedComponent(G);

function CustomTabBar({ state, descriptors, navigation, position }: MaterialTopTabBarProps) {
  const routes = state.routes;
  const tabWidth = TAB_BAR_WIDTH / routes.length;
  const isSleepActive = state.index === 2; // sleep is at index 2

  // Indicator position
  const indicatorLeft = position.interpolate({
    inputRange: routes.map((_, i) => i),
    outputRange: routes.map((_, i) => i * tabWidth),
  });

  // Determine current accent color based on active tab
  const currentAccent = isSleepActive ? SLEEP_ACCENT : ACCENT;

  return (
    <View style={styles.tabBarContainer}>
      <BlurView intensity={30} tint="dark" style={styles.blurBackground} />

      <View style={styles.tabsContent}>
        {/* Animated Pill Indicator */}
        <Animated.View
          style={[
            styles.activeIndicator,
            {
              width: tabWidth,
              transform: [{ translateX: indicatorLeft }],
            },
          ]}>
          <View
            style={[
              styles.activeIndicatorInner,
              isSleepActive && { backgroundColor: 'rgba(62, 66, 169, 0.2)' },
            ]}
          />
        </Animated.View>

        {routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const isSleep = route.name === 'sleep';

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          // Determine icon color
          const iconColor = isFocused ? (isSleep ? SLEEP_ACCENT : ACCENT) : 'rgba(255,255,255,0.4)';

          return (
            <Pressable key={route.key} onPress={onPress} style={styles.tabItem}>
              {isSleep ? (
                <SleepTabIcon
                  focused={isFocused}
                  color={iconColor}
                  label={options.title || route.name}
                />
              ) : (
                <TabIcon
                  name={getIconName(route.name, isFocused)}
                  color={iconColor}
                  focused={isFocused}
                  label={options.title || route.name}
                />
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// Sleep Tab Icon with Moon + Star animation
function SleepTabIcon({
  focused,
  color,
  label,
}: {
  focused: boolean;
  color: string;
  label: string;
}) {
  const starAnim = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(starAnim, {
      toValue: focused ? 1 : 0,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [focused]);

  const starTranslateX = starAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-4, 6],
  });

  const starTranslateY = starAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [4, -8],
  });

  const starOpacity = starAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.5, 1],
  });

  const starScale = starAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1],
  });

  return (
    <View style={styles.iconContainer}>
      <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={28} height={28} viewBox="0 0 24 24">
          {/* Moon crescent */}
          <Path
            d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454z"
            fill={color}
          />

          {/* Animated Star */}
          <AnimatedG
            {...({
              style: {
                transform: [
                  { translateX: starTranslateX },
                  { translateY: starTranslateY },
                  { scale: starScale },
                ],
                opacity: starOpacity,
              },
            } as any)}>
            <Path
              d="M19 5l.5 1l1 .5l-1 .5l-.5 1l-.5-1l-1-.5l1-.5z"
              fill={focused ? '#FFD60A' : color}
            />
          </AnimatedG>
        </Svg>
      </View>
      <Animated.Text style={[styles.label, { color, opacity: focused ? 1 : 0.7 }]}>
        {label}
      </Animated.Text>
    </View>
  );
}

// Standard Icon for other tabs
function getIconName(routeName: string, focused: boolean): any {
  switch (routeName) {
    case 'nutrition':
      return focused ? 'food-apple' : 'food-apple-outline';
    case 'workout':
      return 'dumbbell';
    case 'account':
      return focused ? 'account' : 'account-outline';
    default:
      return 'circle';
  }
}

function TabIcon({
  name,
  color,
  focused,
  label,
}: {
  name: any;
  color: string;
  focused: boolean;
  label: string;
}) {
  return (
    <View style={styles.iconContainer}>
      <MaterialCommunityIcons name={name} size={24} color={color} />
      <Animated.Text style={[styles.label, { color, opacity: focused ? 1 : 0.7 }]}>
        {label}
      </Animated.Text>
    </View>
  );
}

export default function TabLayout() {
  return (
    <MaterialTopTabs
      tabBarPosition="bottom"
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        swipeEnabled: true,
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
    bottom: 24,
    left: TAB_BAR_MARGIN,
    right: TAB_BAR_MARGIN,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  blurBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20, 20, 22, 0.75)',
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
  activeIndicator: {
    position: 'absolute',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 0,
  },
  activeIndicatorInner: {
    width: 80,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(48, 209, 88, 0.15)',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
});
