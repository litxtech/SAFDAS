import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as Google from 'expo-auth-session/providers/google';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { openPolicy } from '@/components/legal/PolicyLinks';
import {
  SpotButton,
  SpotField,
  SpotGlass,
  SpotShell,
  spot,
  spotEnter,
  spotFade,
} from '@/components/auth/SpotAuth';
import { REQUIRED_POLICIES } from '@/content/policies';
import { useT } from '@/i18n';
import { requireSupabase } from '@/lib/supabase';
import { useToastStore } from '@/stores/toastStore';
import { useTheme } from '@/theme/ThemeProvider';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const t = useT();
  const show = useToastStore((state) => state.show);
  const { reduceMotion: themeReduce } = useTheme();
  const systemReduce = useReducedMotion();
  const reduceMotion = themeReduce || Boolean(systemReduce);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const googleClientId =
    Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
      : Platform.OS === 'android'
        ? process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
        : process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '',
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '',
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '',
  });

  useEffect(() => {
    const idToken = response?.type === 'success' ? response.authentication?.idToken : undefined;
    if (!idToken) return;
    void requireSupabase()
      .auth.signInWithIdToken({ provider: 'google', token: idToken })
      .then(({ error }) => {
        if (error) show(error.message, 'error');
        else router.replace('/');
      });
  }, [response, show]);

  async function submit() {
    setLoading(true);
    const { error } = await requireSupabase().auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) show(error.message, 'error');
    else router.replace('/');
  }

  async function continueWithApple() {
    try {
      const rawNonce = Crypto.randomUUID();
      const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashed,
      });
      if (!credential.identityToken) {
        show(t('appleTokenMissing'), 'error');
        return;
      }
      const { error } = await requireSupabase().auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
        nonce: rawNonce,
      });
      if (error) show(error.message, 'error');
      else router.replace('/');
    } catch (error) {
      if (error instanceof Error && error.message.includes('ERR_REQUEST_CANCELED')) return;
      show(error instanceof Error ? error.message : t('appleSignInFailed'), 'error');
    }
  }

  return (
    <SpotShell scroll>
      <StatusBar style="light" />
      <Animated.View entering={spotFade(40, reduceMotion)} style={styles.header}>
        <Text style={styles.kicker}>SAFDAŞ</Text>
        <Text style={styles.title}>{t('login')}</Text>
        <Text style={styles.subtitle}>{t('tagline')}</Text>
      </Animated.View>

      <Animated.View entering={spotEnter(140, reduceMotion)}>
        <SpotGlass strong>
          <SpotField
            label={t('email')}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            value={email}
            onChangeText={setEmail}
          />
          <SpotField
            label={t('password')}
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            value={password}
            onChangeText={setPassword}
          />
          <SpotButton label={t('login')} onPress={() => void submit()} loading={loading} />
          <SpotButton label={t('forgot')} variant="ghost" onPress={() => router.push('/(auth)/forgot')} />

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>{t('orContinue')}</Text>
            <View style={styles.divider} />
          </View>

          {Platform.OS === 'ios' ? (
            <SpotButton label={t('apple')} variant="glass" onPress={() => void continueWithApple()} />
          ) : null}
          <SpotButton
            label={t('google')}
            variant="glass"
            disabled={Boolean(googleClientId) && !request}
            onPress={() => {
              if (!googleClientId) {
                show(t('googleClientMissing'), 'error');
                return;
              }
              void promptAsync();
            }}
          />

          <View style={styles.policy}>
            {REQUIRED_POLICIES.map((policy, index) => (
              <View key={policy.slug} style={styles.policyItem}>
                {index > 0 ? <Text style={styles.policyDot}>·</Text> : null}
                <Pressable onPress={() => openPolicy(policy.slug)} hitSlop={8}>
                  <Text style={styles.policyLink}>{t(policy.label)}</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </SpotGlass>
      </Animated.View>

      <Animated.View entering={spotEnter(260, reduceMotion)} style={styles.footer}>
        <Text style={styles.footerMuted}>{t('noAccount')}</Text>
        <SpotButton label={t('register')} variant="ghost" onPress={() => router.push('/(auth)/register')} />
      </Animated.View>
    </SpotShell>
  );
}

const styles = StyleSheet.create({
  header: { gap: 8, marginTop: 8, marginBottom: 4 },
  kicker: {
    color: spot.accent,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: {
    color: spot.ink,
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.9,
  },
  subtitle: {
    color: spot.muted,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 320,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 2,
  },
  divider: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: spot.line },
  dividerText: { color: spot.dim, fontSize: 12, fontWeight: '600' },
  policy: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    paddingTop: 4,
  },
  policyItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  policyDot: { color: spot.dim, fontSize: 12 },
  policyLink: { color: spot.muted, fontSize: 12, fontWeight: '600', textDecorationLine: 'underline' },
  footer: { alignItems: 'center', gap: 2, marginTop: 4 },
  footerMuted: { color: spot.dim, fontSize: 13, fontWeight: '600' },
});
