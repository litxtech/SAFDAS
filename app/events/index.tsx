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

export default function EventsScreen() {
  const t = useT();
  const { colors } = useTheme();
  const userId = useAuthStore((state) => state.session?.user.id);
  const client = useQueryClient();
  const [title, setTitle] = useState('');
  const [city, setCity] = useState('');
  const query = useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('events').select('id, title, city, starts_at').eq('visibility', 'public').order('starts_at');
      if (error) throw error;
      return data ?? [];
    },
  });

  async function create() {
    if (!userId || title.trim().length < 3) return;
    await requireSupabase().from('events').insert({
      title: title.trim(),
      city,
      host_id: userId,
      starts_at: new Date(Date.now() + 86400000).toISOString(),
      visibility: 'public',
    });
    void client.invalidateQueries({ queryKey: ['events'] });
  }

  return (
    <Screen scroll>
      <AppHeader title={t('events')} />
      <AppInput label={t('fieldTitle')} value={title} onChangeText={setTitle} />
      <AppInput label={t('city')} value={city} onChangeText={setCity} />
      <AppButton label={t('createEvent')} onPress={() => void create()} />
      {query.data?.map((event) => (
        <AppCard key={event.id as string}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>{event.title as string}</Text>
          <Text style={{ color: colors.textSecondary }}>{event.city as string} · {new Date(event.starts_at as string).toLocaleString('tr-TR')}</Text>
        </AppCard>
      ))}
    </Screen>
  );
}
