import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import {
  SpotButton,
  SpotGlass,
  SpotShell,
  spot,
  spotEnter,
  spotFade,
} from '@/components/auth/SpotAuth';
import { authRedirectTo } from '@/lib/authDeepLink';
import { getPendingSignupEmail, setPendingSignupEmail } from '@/lib/pendingSignup';
import { requireSupabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { useT } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Waiting room after signup: Supabase sends a confirmation *link* (not a 6-digit code).
 * Tapping the link opens the app via deep link and AuthProvider completes the session.
 */
export default function VerifyEmailScreen() {
  const { email: emailParam } = useLocalSearchParams<{ email: string }>();
  const email = (typeof emailParam === 'string' ? emailParam : emailParam?.[0]) || getPendingSignupEmail() || '';
  const t = useT();
  const show = useToastStore((state) => state.show);
  const session = useAuthStore((state) => state.session);
  const { reduceMotion: themeReduce } = useTheme();
  const systemReduce = useReducedMotion();
  const reduceMotion = themeReduce || Boolean(systemReduce);
  const [seconds, setSeconds] = useState(60);
  const [loading, setLoading] = useState(false);
  const allowed = Boolean(getPendingSignupEmail() || email);

  useEffect(() => {
    if (!getPendingSignupEmail() && !email) {
      router.replace('/(auth)/welcome');
    }
  }, [email]);

  useEffect(() => {
    if (session) {
      setPendingSignupEmail(null);
      router.replace('/');
    }
  }, [session]);

  useEffect(() => {
    const timer = setInterval(() => setSeconds((value) => (value > 0 ? value - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, []);

  async function resend() {
    if (!email || seconds > 0) return;
    setLoading(true);
    const { error } = await requireSupabase().auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: authRedirectTo() },
    });
    setLoading(false);
    if (error) show(error.message, 'error');
    else {
      setSeconds(60);
      show(t('linkResent'), 'success');
    }
  }

  if (!allowed) return null;

  return (
    <SpotShell scroll>
      <StatusBar style="light" />
      <Animated.View entering={spotFade(40, reduceMotion)} style={styles.header}>
        <Text style={styles.kicker}>SAFDAŞ</Text>
        <Text style={styles.title}>{t('verifyEmail')}</Text>
        <Text style={styles.subtitle}>{t('verifyLinkHint', { email })}</Text>
      </Animated.View>

      <Animated.View entering={spotEnter(140, reduceMotion)}>
        <SpotGlass strong>
          <View style={styles.card}>
            <Text style={styles.step}>{t('verifyLinkStep1')}</Text>
            <Text style={styles.step}>{t('verifyLinkStep2')}</Text>
            <Text style={styles.step}>{t('verifyLinkStep3')}</Text>
          </View>
          <SpotButton
            label={seconds > 0 ? t('resendLinkIn', { seconds }) : t('resendLink')}
            variant="glass"
            disabled={seconds > 0 || loading}
            loading={loading}
            onPress={() => void resend()}
          />
          <SpotButton
            label={t('openLogin')}
            variant="ghost"
            onPress={() => {
              setPendingSignupEmail(null);
              router.replace('/(auth)/login');
            }}
          />
        </SpotGlass>
      </Animated.View>
    </SpotShell>
  );
}

const styles = StyleSheet.create({
  header: { gap: 8, marginTop: 4, marginBottom: 2 },
  kicker: {
    color: spot.accent,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: {
    color: spot.ink,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  subtitle: {
    color: spot.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  card: { gap: 10, marginBottom: 4 },
  step: {
    color: spot.ink,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
  },
});
