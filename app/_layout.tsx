import 'react-native-get-random-values';
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
    let stopNetwork: (() => void) | undefined;
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Light work right after first paint.
    timers.push(
      setTimeout(() => {
        void import('@/stores/networkStore').then((mod) => {
          stopNetwork = mod.startNetworkMonitoring();
        });
      }, 0),
    );
    // Audio URI binding — needed before MiniPlayer, not for first paint.
    timers.push(
      setTimeout(() => {
        void import('@/services/audio/bindUriResolver').then((mod) => {
          mod.bindAudioUriResolver();
        });
      }, 600),
    );
    // Offline pack stats — UI-only counters, defer.
    timers.push(
      setTimeout(() => {
        void import('@/services/offline/packs').then((mod) => {
          try {
            mod.refreshPackStats();
          } catch {
            /* web / missing FS */
          }
        });
      }, 2200),
    );
    // LiveKit globals bootstrap on call/live/rooms entry — not at cold start.

    return () => {
      timers.forEach(clearTimeout);
      stopNetwork?.();
    };
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
