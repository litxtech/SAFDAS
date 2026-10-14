import 'react-native-url-polyfill/auto';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { LaunchIntro } from '@/components/launch/LaunchIntro';
import { PrayerAlertSync } from '@/components/prayer/PrayerAlertSync';
import { AppToast } from '@/components/ui/AppToast';
import { queryClient } from '@/lib/queryClient';
import { isRtlLocale, useI18nStore } from '@/i18n';
import { ThemeProvider } from '@/theme/ThemeProvider';

export default function RootLayout() {
  const rtl = isRtlLocale(useI18nStore((state) => state.locale));
  return (
    <GestureHandlerRootView style={{ flex: 1, direction: rtl ? 'rtl' : 'ltr' }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <AuthProvider>
              <PrayerAlertSync />
              <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
              <AppToast />
              <LaunchIntro />
            </AuthProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
