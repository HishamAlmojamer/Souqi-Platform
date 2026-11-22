import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FontDisplay, useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors } from '@/components/b2b/palette';
import { fonts } from '@/components/b2b/typography';
import { AuthProvider } from '@/state/AuthContext';

export default function RootLayout() {
  const [queryClient] = useState(
    () => new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 30_000,
          retry: 2,
          refetchOnWindowFocus: false,
        },
      },
    }),
  );

  const [fontsLoaded, fontError] = useFonts({
    [fonts.regular]: {
      uri: require('../../assets/fonts/IBMPlexSansArabic-Regular.ttf'),
      display: FontDisplay.SWAP,
    },
    [fonts.medium]: {
      uri: require('../../assets/fonts/IBMPlexSansArabic-Medium.ttf'),
      display: FontDisplay.SWAP,
    },
    [fonts.semiBold]: {
      uri: require('../../assets/fonts/IBMPlexSansArabic-SemiBold.ttf'),
      display: FontDisplay.SWAP,
    },
    [fonts.bold]: {
      uri: require('../../assets/fonts/IBMPlexSansArabic-Bold.ttf'),
      display: FontDisplay.SWAP,
    },
  });

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.cream },
            }}
          />
        </QueryClientProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
