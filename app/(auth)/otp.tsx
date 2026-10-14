import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/layout/Screen';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { useT } from '@/i18n';
import { requireSupabase } from '@/lib/supabase';
import { useToastStore } from '@/stores/toastStore';
import { useTheme } from '@/theme/ThemeProvider';

export default function OtpScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const { colors } = useTheme();
  const t = useT();
  const show = useToastStore((state) => state.show);
  const [code, setCode] = useState('');
  const [seconds, setSeconds] = useState(60);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setSeconds((value) => (value > 0 ? value - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, []);

  async function verify() {
    if (!email || code.length !== 6) {
      show(t('enterSixDigit'), 'error');
      return;
    }
    setLoading(true);
    const { error } = await requireSupabase().auth.verifyOtp({ email, token: code, type: 'signup' });
    setLoading(false);
    if (error) show(error.message.includes('expired') ? t('codeExpired') : error.message, 'error');
    else router.replace('/');
  }

  async function resend() {
    if (!email || seconds > 0) return;
    const { error } = await requireSupabase().auth.resend({ type: 'signup', email });
    if (error) show(error.message, 'error');
    else {
      setSeconds(60);
      show(t('codeResent'), 'success');
    }
  }

  return (
    <Screen scroll>
      <Text style={{ color: colors.text, fontSize: 32, fontWeight: '700' }}>{t('verifyEmail')}</Text>
      <Text style={{ color: colors.textSecondary }}>{t('otpHint', { email: email ?? '', seconds })}</Text>
      <AppInput label={t('otpCode')} keyboardType="number-pad" maxLength={6} value={code} onChangeText={setCode} textContentType="oneTimeCode" />
      <AppButton label={t('verify')} onPress={() => void verify()} loading={loading} />
      <AppButton label={t('resendCode')} variant="secondary" disabled={seconds > 0} onPress={() => void resend()} />
    </Screen>
  );
}
