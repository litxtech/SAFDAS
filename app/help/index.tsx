import { useState } from 'react';
import { Text } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/layout/Screen';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppInput } from '@/components/ui/AppInput';
import { useT } from '@/i18n';
import { requireSupabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/theme/ThemeProvider';

export default function HelpScreen() {
  const t = useT();
  const { colors } = useTheme();
  const userId = useAuthStore((state) => state.session?.user.id);
  const client = useQueryClient();
  const [title, setTitle] = useState('');
  const [city, setCity] = useState('');
  const query = useQuery({
    queryKey: ['help'],
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('help_requests').select('id, title, city, status').order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function create() {
    if (!userId || title.trim().length < 3) return;
    await requireSupabase().from('help_requests').insert({ owner_id: userId, title: title.trim(), city, category: 'other', status: 'open' });
    void client.invalidateQueries({ queryKey: ['help'] });
  }

  return (
    <Screen scroll>
      <AppHeader title={t('help')} subtitle={t('helpSubtitle')} />
      <AppInput label={t('fieldTitle')} value={title} onChangeText={setTitle} />
      <AppInput label={t('city')} value={city} onChangeText={setCity} />
      <AppButton label={t('createCall')} onPress={() => void create()} />
      {query.data?.map((item) => (
        <AppCard key={item.id as string}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>{item.title as string}</Text>
          <Text style={{ color: colors.textSecondary }}>{item.city as string} · {item.status as string}</Text>
        </AppCard>
      ))}
    </Screen>
  );
}
