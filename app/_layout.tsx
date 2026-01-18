// app/_layout.tsx
import { useEffect, useCallback, useState } from 'react';
import { Stack, router } from 'expo-router';
import { useAuthStore } from '@store/authStore';
import { useProfileStore } from '@store/profileStore';
import { StatusBar } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts, Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { Poppins_700Bold } from '@expo-google-fonts/poppins';
import { DialogProvider } from '@components/ui/Dialog';
import '../global.css';

// Keep splash visible while loading
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { initialize, initialized, session, user } = useAuthStore();
  const { fetchProfile, profile, loading: profileLoading } = useProfileStore();
  const [appReady, setAppReady] = useState(false);
  const [splashHidden, setSplashHidden] = useState(false);
  const [profileChecked, setProfileChecked] = useState(false);

  const [fontsLoaded, fontError] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-SemiBold': Inter_600SemiBold,
    'Poppins-Bold': Poppins_700Bold,
  });

  // Initialize auth
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Fetch profile when user is available
  useEffect(() => {
    const checkProfile = async () => {
      if (user && !profileChecked) {
        await fetchProfile(user.id);
        setProfileChecked(true);
      }
    };
    checkProfile();
  }, [user, profileChecked]);

  // Check if everything is ready
  useEffect(() => {
    const isReady = (fontsLoaded || fontError) && initialized;
    // If user is logged in, wait for profile check too
    if (isReady && session && user) {
      if (profileChecked) {
        setAppReady(true);
      }
    } else if (isReady && !session) {
      setAppReady(true);
    }
  }, [fontsLoaded, fontError, initialized, session, user, profileChecked]);

  // Hide splash and route based on auth + profile state
  const onLayoutRootView = useCallback(async () => {
    if (appReady && !splashHidden) {
      // Small delay for smoother transition
      await new Promise((resolve) => setTimeout(resolve, 100));
      await SplashScreen.hideAsync();
      setSplashHidden(true);

      // Route based on auth and profile state
      if (session && user) {
        // Use loading screen for smooth transition
        router.replace('/loading');
      }
    }
  }, [appReady, splashHidden, session, user]);

  // Keep splash visible until ready
  if (!appReady) {
    return null;
  }

  return (
    <GestureHandlerRootView
      style={{ flex: 1, backgroundColor: '#000' }}
      onLayout={onLayoutRootView}>
      <DialogProvider>
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
            name="loading"
            options={{
              animation: 'fade',
              animationDuration: 150,
            }}
          />
          <Stack.Screen
            name="(tabs)"
            options={{
              animation: 'fade',
              animationDuration: 250,
            }}
          />
          <Stack.Screen
            name="onboarding"
            options={{
              animation: 'slide_from_right',
              animationDuration: 300,
            }}
          />
        </Stack>
      </DialogProvider>
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
