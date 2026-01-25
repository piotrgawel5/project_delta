// app/onboarding/_layout.tsx
import { Stack } from 'expo-router';
import { View, StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function OnboardingLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar barStyle="light-content" backgroundColor="#000" translucent />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#000' },
          animation: 'slide_from_right',
          animationDuration: 300,
        }}>
        <Stack.Screen name="username" />
        <Stack.Screen name="birthday" />
        <Stack.Screen name="weight" />
        <Stack.Screen name="height" />
        <Stack.Screen name="sex" />
        <Stack.Screen name="sport" />
        <Stack.Screen name="activity" />
        <Stack.Screen name="goal" />
        <Stack.Screen name="health" />
      </Stack>
    </GestureHandlerRootView>
  );
}
