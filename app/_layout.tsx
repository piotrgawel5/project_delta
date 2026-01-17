// app/_layout.tsx
import { useEffect, useCallback, useState } from 'react';
import { Stack, router } from 'expo-router';
import { useAuthStore } from '@store/authStore';
import { View, Animated, Easing, StatusBar } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts, Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { Poppins_700Bold } from '@expo-google-fonts/poppins';
import '../global.css';

// Keep splash visible while loading
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { initialize, initialized, session } = useAuthStore();
  const [appReady, setAppReady] = useState(false);
  const [splashHidden, setSplashHidden] = useState(false);

  const [fontsLoaded, fontError] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-SemiBold': Inter_600SemiBold,
    'Poppins-Bold': Poppins_700Bold,
  });

  // Initialize auth
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Check if everything is ready
  useEffect(() => {
    if ((fontsLoaded || fontError) && initialized) {
      setAppReady(true);
    }
  }, [fontsLoaded, fontError, initialized]);

  // Hide splash when ready
  const onLayoutRootView = useCallback(async () => {
    if (appReady && !splashHidden) {
      // Small delay for smoother transition
      await new Promise((resolve) => setTimeout(resolve, 100));
      await SplashScreen.hideAsync();
      setSplashHidden(true);

      // Route based on auth state
      if (session) {
        router.replace('/account');
      }
    }
  }, [appReady, splashHidden, session]);

  // Keep splash visible until ready
  if (!appReady) {
    return null;
  }

  return (
    <GestureHandlerRootView
      style={{ flex: 1, backgroundColor: '#000' }}
      onLayout={onLayoutRootView}>
      <StatusBar barStyle="light-content" backgroundColor="#000" translucent />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#000' },
          animation: 'fade',
          animationDuration: 200,
        }}>
        <Stack.Screen name="index" />
        <Stack.Screen
          name="account/index"
          options={{
            animation: 'fade',
            animationDuration: 250,
          }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}

export function useAuth() {
  const { user, session, loading } = useAuthStore();
  return {
    user,
    session,
    loading,
    isAuthenticated: !!session && !!user,
  };
}
