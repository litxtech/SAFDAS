import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Screen } from '@/components/layout/Screen';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppEmptyState } from '@/components/ui/AppEmptyState';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppInput } from '@/components/ui/AppInput';
import { useT } from '@/i18n';
import { requireSupabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/theme/ThemeProvider';

export default function RoomsScreen() {
  const { colors } = useTheme();
  const t = useT();
  const userId = useAuthStore((state) => state.session?.user.id);
  const [title, setTitle] = useState('');
  const rooms = useQuery({
    queryKey: ['rooms'],
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('live_rooms').select('id, title, status, host_id').eq('status', 'live').order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function create() {
    if (!userId || title.trim().length < 3) return;
    const { data, error } = await requireSupabase().from('live_rooms').insert({ title: title.trim(), host_id: userId, status: 'live' }).select('id').single();
    if (!error && data) router.push({ pathname: '/rooms/[id]', params: { id: data.id as string } });
  }

  return (
    <Screen scroll>
      <AppHeader title={t('rooms')} subtitle={t('roomsSubtitle')} />
      <AppInput label={t('roomName')} value={title} onChangeText={setTitle} />
      <AppButton label={t('openRoom')} onPress={() => void create()} />
      {(rooms.data ?? []).length === 0 ? <AppEmptyState icon="mic-outline" title={t('noRoomTitle')} body={t('noRoomBody')} /> : null}
      {rooms.data?.map((room) => (
        <Pressable key={room.id as string} onPress={() => router.push({ pathname: '/rooms/[id]', params: { id: room.id as string } })}>
          <AppCard>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{room.title as string}</Text>
            <Text style={{ color: colors.primary }}>{t('live')}</Text>
          </AppCard>
        </Pressable>
      ))}
    </Screen>
  );
}
