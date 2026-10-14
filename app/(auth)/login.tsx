import { useState } from 'react';
import { Text } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/layout/Screen';
import { PolicyLinks } from '@/components/legal/PolicyLinks';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { useT } from '@/i18n';
import { requireSupabase } from '@/lib/supabase';
import { useToastStore } from '@/stores/toastStore';
import { useTheme } from '@/theme/ThemeProvider';

export default function LoginScreen() {
  const { colors } = useTheme();
  const t = useT();
  const show = useToastStore((state) => state.show);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    const { error } = await requireSupabase().auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) show(error.message, 'error');
    else router.replace('/');
  }

  return (
    <Screen scroll>
      <Text style={{ color: colors.text, fontSize: 32, fontWeight: '700' }}>{t('login')}</Text>
      <AppInput label={t('email')} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <AppInput label={t('password')} secureTextEntry value={password} onChangeText={setPassword} />
      <AppButton label={t('login')} onPress={() => void submit()} loading={loading} />
      <AppButton label={t('forgot')} variant="ghost" onPress={() => router.push('/(auth)/forgot')} />
      <PolicyLinks />
    </Screen>
  );
}
