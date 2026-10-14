import { Text } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect } from 'expo-router';
import { Screen } from '@/components/layout/Screen';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppHeader } from '@/components/ui/AppHeader';
import { useT } from '@/i18n';
import { requireSupabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/theme/ThemeProvider';

export default function AdminRoomsScreen() {
  const isStaff = useAuthStore((state) => state.isStaff);
  const { colors } = useTheme();
  const t = useT();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['admin-rooms'],
    enabled: isStaff,
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('live_rooms').select('id, title, status').order('created_at', { ascending: false }).limit(40);
      if (error) throw error;
      return data ?? [];
    },
  });
  if (!isStaff) return <Redirect href="/(tabs)" />;
  return (
    <Screen scroll>
      <AppHeader title={t('voiceRoomsTitle')} />
      {query.data?.map((room) => (
        <AppCard key={room.id as string}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>{room.title as string}</Text>
          <Text style={{ color: colors.textSecondary }}>{room.status as string}</Text>
          <AppButton
            label={t('closeRoom')}
            variant="secondary"
            onPress={() => {
              void requireSupabase().from('live_rooms').update({ status: 'ended' }).eq('id', room.id).then(() => client.invalidateQueries({ queryKey: ['admin-rooms'] }));
            }}
          />
        </AppCard>
      ))}
    </Screen>
  );
}
