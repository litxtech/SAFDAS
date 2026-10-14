import { Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Redirect } from 'expo-router';
import { Screen } from '@/components/layout/Screen';
import { AppCard } from '@/components/ui/AppCard';
import { AppHeader } from '@/components/ui/AppHeader';
import { useT } from '@/i18n';
import { requireSupabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/theme/ThemeProvider';

export default function AdminEventsScreen() {
  const t = useT();
  const isStaff = useAuthStore((state) => state.isStaff);
  const { colors } = useTheme();
  const query = useQuery({
    queryKey: ['admin-events'],
    enabled: isStaff,
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('events').select('id, title, city, starts_at').order('starts_at', { ascending: false }).limit(40);
      if (error) throw error;
      return data ?? [];
    },
  });
  if (!isStaff) return <Redirect href="/(tabs)" />;
  return (
    <Screen scroll>
      <AppHeader title={t('events')} />
      {query.data?.map((event) => (
        <AppCard key={event.id as string}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>{event.title as string}</Text>
          <Text style={{ color: colors.textSecondary }}>{event.city as string}</Text>
        </AppCard>
      ))}
    </Screen>
  );
}
