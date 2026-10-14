import { useEffect } from 'react';
import { Platform, Text, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as Google from 'expo-auth-session/providers/google';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Screen } from '@/components/layout/Screen';
import { AppButton } from '@/components/ui/AppButton';
import { useT } from '@/i18n';
import { requireSupabase } from '@/lib/supabase';
import { useToastStore } from '@/stores/toastStore';
import { useTheme } from '@/theme/ThemeProvider';

WebBrowser.maybeCompleteAuthSession();

export default function WelcomeScreen() {
  const { colors } = useTheme();
  const t = useT();
  const show = useToastStore((state) => state.show);
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
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

  async function continueWithApple() {
    try {
      const rawNonce = Crypto.randomUUID();
      const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
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
    <Screen>
      <View style={{ flex: 1, justifyContent: 'flex-end', gap: 16, paddingBottom: 12 }}>
        <Text style={{ color: colors.primary, fontWeight: '800', letterSpacing: 2 }}>{t('brand')}</Text>
        <Text style={{ color: colors.text, fontSize: 40, fontWeight: '700', letterSpacing: -1 }}>{t('slogan')}</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 16, lineHeight: 24 }}>{t('tagline')}</Text>
        <AppButton label={t('login')} onPress={() => router.push('/(auth)/login')} />
        <AppButton label={t('register')} variant="secondary" onPress={() => router.push('/(auth)/register')} />
        {Platform.OS === 'ios' ? <AppButton label={t('apple')} variant="secondary" onPress={() => void continueWithApple()} /> : null}
        <AppButton
          label={t('google')}
          variant="ghost"
          disabled={!request}
          onPress={() => {
            if (!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) {
              show(t('googleClientMissing'), 'error');
              return;
            }
            void promptAsync();
          }}
        />
      </View>
    </Screen>
  );
}
