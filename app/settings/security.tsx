import { useState } from 'react';
import { Screen } from '@/components/layout/Screen';
import { AppButton } from '@/components/ui/AppButton';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppInput } from '@/components/ui/AppInput';
import { useT } from '@/i18n';
import { requireSupabase } from '@/lib/supabase';
import { useToastStore } from '@/stores/toastStore';

export default function SecurityScreen() {
  const t = useT();
  const show = useToastStore((state) => state.show);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function save() {
    if (password.length < 8) {
      show(t('passwordMin'), 'error');
      return;
    }
    setLoading(true);
    const { error } = await requireSupabase().auth.updateUser({ password });
    setLoading(false);
    if (error) show(error.message, 'error');
    else {
      setPassword('');
      show(t('passwordUpdated'), 'success');
    }
  }

  return (
    <Screen scroll>
      <AppHeader title={t('security')} subtitle={t('securitySubtitle')} />
      <AppInput label={t('newPassword')} secureTextEntry value={password} onChangeText={setPassword} />
      <AppButton label={t('changePassword')} loading={loading} onPress={() => void save()} />
    </Screen>
  );
}
