import { useState } from 'react';
import { Text } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/layout/Screen';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { useT } from '@/i18n';
import { requireSupabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { useTheme } from '@/theme/ThemeProvider';

export default function CompleteProfileScreen() {
  const profile = useAuthStore((state) => state.profile);
  const session = useAuthStore((state) => state.session);
  const { colors } = useTheme();
  const t = useT();
  const show = useToastStore((state) => state.show);
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [loading, setLoading] = useState(false);

  async function save() {
    if (!session || username.trim().length < 3 || displayName.trim().length < 2) {
      show(t('nameAndUsernameRequired'), 'error');
      return;
    }
    setLoading(true);
    const client = requireSupabase();
    const { data: existing } = await client.from('profiles').select('id').eq('username', username.trim().toLowerCase()).neq('id', session.user.id).maybeSingle();
    if (existing) {
      setLoading(false);
      show(t('usernameTaken'), 'error');
      return;
    }
    const { error } = await client.from('profiles').update({
      display_name: displayName.trim(),
      username: username.trim().toLowerCase(),
    }).eq('id', session.user.id);
    setLoading(false);
    if (error) show(error.message, 'error');
    else router.replace('/');
  }

  return (
    <Screen scroll>
      <Text style={{ color: colors.text, fontSize: 32, fontWeight: '700' }}>{t('completeProfile')}</Text>
      <Text style={{ color: colors.textSecondary }}>{t('completeProfileBody')}</Text>
      <AppInput label={t('displayName')} value={displayName} onChangeText={setDisplayName} />
      <AppInput label={t('username')} autoCapitalize="none" value={username} onChangeText={setUsername} />
      <AppButton label={t('continueAction')} loading={loading} onPress={() => void save()} />
    </Screen>
  );
}
