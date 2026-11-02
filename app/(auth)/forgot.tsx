import { useState } from 'react';
import { Text } from 'react-native';
import { AuthCanvas, GlassButton, GlassCard, GlassField } from '@/components/auth/GlassAuth';
import { authRedirectTo } from '@/lib/authDeepLink';
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
    const { error } = await requireSupabase().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: authRedirectTo(),
    });
    setLoading(false);
    if (error) show(error.message, 'error');
    else show(t('resetSent'), 'success');
  }

  return (
    <AuthCanvas scroll>
      <GlassCard>
        <Text style={{ color: colors.text, fontSize: 34, fontWeight: '700', letterSpacing: -0.8 }}>{t('resetPassword')}</Text>
        <GlassField label={t('email')} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <GlassButton label={t('sendLink')} loading={loading} onPress={() => void submit()} />
      </GlassCard>
    </AuthCanvas>
  );
}
