import { useState } from 'react';
import { router } from 'expo-router';
import { Screen } from '@/components/layout/Screen';
import { AppButton } from '@/components/ui/AppButton';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppInput } from '@/components/ui/AppInput';
import { useT } from '@/i18n';
import { requireSupabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';

export default function CreateCircleScreen() {
  const t = useT();
  const userId = useAuthStore((state) => state.session?.user.id);
  const show = useToastStore((state) => state.show);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  async function create() {
    if (!userId || name.trim().length < 3) return;
    setLoading(true);
    const client = requireSupabase();
    const { data, error } = await client.from('circles').insert({ name: name.trim(), description, owner_id: userId, visibility: 'public' }).select('id').single();
    if (error || !data) {
      setLoading(false);
      show(error?.message ?? t('createFailed'), 'error');
      return;
    }
    await client.from('circle_members').insert({ circle_id: data.id, user_id: userId, role: 'owner' });
    setLoading(false);
    router.replace({ pathname: '/circles/[id]', params: { id: data.id as string } });
  }

  return (
    <Screen scroll>
      <AppHeader title={t('createCircle')} />
      <AppInput label={t('fieldName')} value={name} onChangeText={setName} />
      <AppInput label={t('fieldDescription')} multiline value={description} onChangeText={setDescription} style={{ minHeight: 120, textAlignVertical: 'top' }} />
      <AppButton label={t('create')} loading={loading} onPress={() => void create()} />
    </Screen>
  );
}
