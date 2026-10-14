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

export default function AdminHelpScreen() {
  const t = useT();
  const isStaff = useAuthStore((state) => state.isStaff);
  const { colors } = useTheme();
  const query = useQuery({
    queryKey: ['admin-help'],
    enabled: isStaff,
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('help_requests').select('id, title, city, status').order('created_at', { ascending: false }).limit(40);
      if (error) throw error;
      return data ?? [];
    },
  });
  if (!isStaff) return <Redirect href="/(tabs)" />;
  return (
    <Screen scroll>
      <AppHeader title={t('helpCallsTitle')} />
      {query.data?.map((item) => (
        <AppCard key={item.id as string}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>{item.title as string}</Text>
          <Text style={{ color: colors.textSecondary }}>{item.city as string} · {item.status as string}</Text>
        </AppCard>
      ))}
    </Screen>
  );
}
