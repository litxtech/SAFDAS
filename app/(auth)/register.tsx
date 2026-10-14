import { useState } from 'react';
import { Text } from 'react-native';
import { router } from 'expo-router';
import { z } from 'zod';
import { Screen } from '@/components/layout/Screen';
import { PolicyConsents } from '@/components/legal/PolicyLinks';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { POLICY_VERSION } from '@/content/policies';
import { useT } from '@/i18n';
import { requireSupabase } from '@/lib/supabase';
import { useToastStore } from '@/stores/toastStore';
import { useTheme } from '@/theme/ThemeProvider';

const schema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  username: z.string().regex(/^[a-z0-9_]{3,20}$/i),
  email: z.string().email(),
  password: z.string().min(8),
  confirm: z.string(),
  terms: z.literal(true),
  privacy: z.literal(true),
  childSafety: z.literal(true),
}).refine((value) => value.password === value.confirm, { path: ['confirm'] });

export default function RegisterScreen() {
  const { colors } = useTheme();
  const t = useT();
  const show = useToastStore((state) => state.show);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    password: '',
    confirm: '',
    terms: false,
    privacy: false,
    childSafety: false,
  });
  const [loading, setLoading] = useState(false);
  const set = (key: keyof typeof form) => (value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));

  async function submit() {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      show(form.terms && form.privacy && form.childSafety ? t('checkFields') : t('requiredPolicies'), 'error');
      return;
    }
    setLoading(true);
    const { data, error } = await requireSupabase().auth.signUp({
      email: parsed.data.email.trim(),
      password: parsed.data.password,
      options: {
        data: {
          first_name: parsed.data.firstName,
          last_name: parsed.data.lastName,
          username: parsed.data.username.toLowerCase(),
          accepted_terms: true,
          accepted_privacy: true,
          accepted_child_safety: true,
          accepted_policies_at: new Date().toISOString(),
          policy_version: POLICY_VERSION,
        },
      },
    });
    setLoading(false);
    if (error) {
      show(error.message, 'error');
      return;
    }
    if (!data.session) router.push({ pathname: '/(auth)/otp', params: { email: parsed.data.email.trim() } });
    else router.replace('/');
  }

  return (
    <Screen scroll>
      <Text style={{ color: colors.text, fontSize: 32, fontWeight: '700' }}>{t('register')}</Text>
      <AppInput label={t('firstName')} value={form.firstName} onChangeText={set('firstName')} />
      <AppInput label={t('lastName')} value={form.lastName} onChangeText={set('lastName')} />
      <AppInput label={t('username')} autoCapitalize="none" value={form.username} onChangeText={set('username')} />
      <AppInput label={t('email')} autoCapitalize="none" keyboardType="email-address" value={form.email} onChangeText={set('email')} />
      <AppInput label={t('password')} secureTextEntry value={form.password} onChangeText={set('password')} />
      <AppInput label={t('confirmPassword')} secureTextEntry value={form.confirm} onChangeText={set('confirm')} />
      <PolicyConsents
        values={{ safety: form.childSafety, terms: form.terms, privacy: form.privacy }}
        onChange={(slug, value) => set(slug === 'safety' ? 'childSafety' : slug)(value)}
      />
      <AppButton label={t('register')} onPress={() => void submit()} loading={loading} disabled={!form.terms || !form.privacy || !form.childSafety} />
    </Screen>
  );
}
