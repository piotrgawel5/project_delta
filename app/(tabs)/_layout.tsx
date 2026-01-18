// app/(tabs)/_layout.tsx
import React from 'react';
import { View, StyleSheet, Dimensions, Pressable, Animated } from 'react-native';
import { MaterialTopTabs } from '../../components/navigation/MaterialTopTabs';
import { BlurView } from 'expo-blur';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MaterialTopTabBarProps } from '@react-navigation/material-top-tabs';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ACCENT = '#30D158';
const TAB_BAR_MARGIN = 16;
const TAB_BAR_WIDTH = SCREEN_WIDTH - TAB_BAR_MARGIN * 2;

function CustomTabBar({ state, descriptors, navigation, position }: MaterialTopTabBarProps) {
  const routes = state.routes;
  const tabWidth = TAB_BAR_WIDTH / routes.length;

  // Enhance animating the indicator using the position value from MaterialTopTabs
  const indicatorLeft = position.interpolate({
    inputRange: routes.map((_, i) => i),
    outputRange: routes.map((_, i) => i * tabWidth),
  });

  return (
    <View style={styles.tabBarContainer}>
      <BlurView intensity={30} tint="dark" style={styles.blurBackground} />

      <View style={styles.tabsContent}>
        {/* Animated Pill Indicator */}
        <Animated.View
          style={[
            styles.activeIndicator,
            {
              width: tabWidth, // It fills the tab slot width (minus padding if we want)
              transform: [{ translateX: indicatorLeft }],
            },
          ]}>
          <View style={styles.activeIndicatorInner} />
        </Animated.View>

        {routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

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

          return (
            <Pressable key={route.key} onPress={onPress} style={styles.tabItem}>
              <TabIcon
                name={getIconName(route.name, isFocused)}
                color={isFocused ? ACCENT : 'rgba(255,255,255,0.4)'}
                focused={isFocused}
                label={options.title || route.name}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// Separate Icon logic for cleanliness
function getIconName(routeName: string, focused: boolean): any {
  switch (routeName) {
    case 'nutrition':
      return focused ? 'food-apple' : 'food-apple-outline';
    case 'workout':
      return 'dumbbell';
    case 'sleep':
      return 'power-sleep';
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
  // Simple scale effect logic could be added here if needed,
  // but for now we focus on the swipe transition
  return (
    <View style={styles.iconContainer}>
      <MaterialCommunityIcons name={name} size={24} color={color} />
      {/* Optional: Add label back if user wants, currently user asked for "wider options" and "pill" */}
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
  },
  blurBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20, 20, 22, 0.7)',
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
    zIndex: 1, // Above indicator
  },
  activeIndicator: {
    position: 'absolute',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 0, // Behind text/icon
  },
  activeIndicatorInner: {
    width: 80, // The green pill width
    height: 56, // The green pill height
    borderRadius: 28,
    backgroundColor: 'rgba(48, 209, 88, 0.15)', // Wider green elise
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
