// ============================================================
// SUPER RESERVATION PLATFORM — Root Layout
// - Forces RTL layout (Arabic-first)
// - Loads Cairo font (Arabic) + Inter (Latin)
// - Initializes auth state
// - Guards authenticated routes
// ============================================================

import { useEffect } from 'react';
import { I18nManager, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth';

// Force RTL for Arabic-first experience
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,   // 2 minutes
      gcTime: 10 * 60 * 1000,     // 10 minutes
      retry: 2,
    },
  },
});

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, segments]);

  return <>{children}</>;
}

export default function RootLayout() {
  const initialize = useAuthStore((s) => s.initialize);

  const [fontsLoaded] = useFonts({
    'Cairo-Regular': require('../../assets/fonts/Cairo-Regular.ttf'),
    'Cairo-Medium': require('../../assets/fonts/Cairo-Medium.ttf'),
    'Cairo-SemiBold': require('../../assets/fonts/Cairo-SemiBold.ttf'),
    'Cairo-Bold': require('../../assets/fonts/Cairo-Bold.ttf'),
    'Inter-Regular': require('../../assets/fonts/Inter-Regular.ttf'),
    'Inter-Medium': require('../../assets/fonts/Inter-Medium.ttf'),
    'Inter-SemiBold': require('../../assets/fonts/Inter-SemiBold.ttf'),
  });

  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <AuthGuard>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="search" options={{ presentation: 'card' }} />
          <Stack.Screen name="business/[id]/index" options={{ presentation: 'card' }} />
          <Stack.Screen name="booking/checkout" options={{ presentation: 'modal' }} />
          <Stack.Screen name="booking/payment" options={{ presentation: 'modal' }} />
          <Stack.Screen name="booking/confirmed" options={{ presentation: 'card', gestureEnabled: false }} />
          <Stack.Screen name="bookings/[id]/index" options={{ presentation: 'card' }} />
        </Stack>
      </AuthGuard>
    </QueryClientProvider>
  );
}
