import 'react-native-url-polyfill/auto';
import '@/lib/domExceptionPolyfill';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { DeferredHosts } from '@/components/launch/DeferredHosts';
import { LaunchIntro } from '@/components/launch/LaunchIntro';
import { UsageTracker } from '@/components/usage/UsageTracker';
import { AppToast } from '@/components/ui/AppToast';
import { queryClient } from '@/lib/queryClient';
import { bootstrapLocaleOnce, isRtlLocale, useI18nStore, useLocaleDirectionSync } from '@/i18n';
import { stackScreenOptions } from '@/navigation/screenOptions';
import { ThemeProvider } from '@/theme/ThemeProvider';

export default function RootLayout() {
  const rtl = isRtlLocale(useI18nStore((state) => state.locale));
  useLocaleDirectionSync();

  useEffect(() => {
    void bootstrapLocaleOnce();
    // Native / offline work after first paint — not on the critical path.
    const timer = setTimeout(() => {
      void import('@/lib/livekitBootstrap').then((mod) => {
        mod.bootstrapLiveKit();
      });
      void import('@/services/offline/packs').then((mod) => {
        try {
          mod.refreshPackStats();
        } catch {
          /* web / missing FS */
        }
      });
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, direction: rtl ? 'rtl' : 'ltr' }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <AuthProvider>
              <UsageTracker />
              <Stack screenOptions={stackScreenOptions(rtl)} />
              <DeferredHosts />
              <AppToast />
              <LaunchIntro />
            </AuthProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
