import { useState } from 'react';
import { Text } from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { useT } from '@/i18n';
import { requireSupabase } from '@/lib/supabase';
import { useToastStore } from '@/stores/toastStore';
import { useTheme } from '@/theme/ThemeProvider';

export default function ForgotScreen() {
  const { colors } = useTheme();
  const t = useT();
  const show = useToastStore((state) => state.show);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    const { error } = await requireSupabase().auth.resetPasswordForEmail(email.trim());
    setLoading(false);
    if (error) show(error.message, 'error');
    else show(t('resetSent'), 'success');
  }

  return (
    <Screen scroll>
      <Text style={{ color: colors.text, fontSize: 32, fontWeight: '700' }}>{t('resetPassword')}</Text>
      <AppInput label={t('email')} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <AppButton label={t('sendLink')} loading={loading} onPress={() => void submit()} />
    </Screen>
  );
}
