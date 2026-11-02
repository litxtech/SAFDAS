import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { createSessionFromUrl, isAuthCallbackUrl } from '@/lib/authDeepLink';
import { setPendingSignupEmail } from '@/lib/pendingSignup';
import { useT } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Handles safdas://auth/callback (and Expo Linking URLs) after the user taps
 * the confirmation link in email.
 */
export default function AuthCallbackScreen() {
  const t = useT();
  const { colors } = useTheme();
  const params = useLocalSearchParams();
  const [message, setMessage] = useState(t('verifyingLink'));

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const initial = await Linking.getInitialURL();
      const fromParams = Linking.createURL('auth/callback', {
        queryParams: Object.fromEntries(
          Object.entries(params).map(([key, value]) => [key, Array.isArray(value) ? value[0] : String(value ?? '')]),
        ),
      });
      const candidates = [initial, fromParams].filter((url): url is string => Boolean(url && isAuthCallbackUrl(url)));
      // Prefer the richest URL (often the initial deep link with tokens).
      const url = candidates.sort((a, b) => b.length - a.length)[0] ?? fromParams;

      const result = await createSessionFromUrl(url);
      if (cancelled) return;

      if (result.error) {
        setMessage(result.error.message);
        setTimeout(() => router.replace('/(auth)/welcome'), 1600);
        return;
      }

      if (result.session) {
        setPendingSignupEmail(null);
        setMessage(t('emailVerified'));
        router.replace('/');
        return;
      }

      // No tokens in this open — wait briefly for AuthProvider / Linking listener.
      setTimeout(() => {
        if (!cancelled) router.replace('/');
      }, 500);
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [params, t]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, gap: 14, padding: 24 }}>
      <ActivityIndicator color={colors.primary} />
      <Text style={{ color: colors.text, fontWeight: '700', textAlign: 'center' }}>{message}</Text>
    </View>
  );
}
