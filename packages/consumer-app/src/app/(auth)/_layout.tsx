// ============================================================
// SUPER RESERVATION PLATFORM — Auth Group Layout
// Stack navigator for login screen (and future onboarding steps).
// No header, no tab bar — full-screen auth experience.
// ============================================================

import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
    </Stack>
  );
}
