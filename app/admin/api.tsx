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

export default function AdminApiScreen() {
  const t = useT();
  const isStaff = useAuthStore((state) => state.isStaff);
  const { colors } = useTheme();
  const query = useQuery({
    queryKey: ['api-health'],
    enabled: isStaff,
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('api_health_logs').select('provider_name, status, response_time_ms, error_message, created_at').order('created_at', { ascending: false }).limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });
  if (!isStaff) return <Redirect href="/(tabs)" />;
  return (
    <Screen scroll>
      <AppHeader title={t('navApi')} subtitle={t('apiSubtitle')} />
      {query.data?.map((row, index) => (
        <AppCard key={`${row.created_at as string}${index}`}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>{row.provider_name as string}</Text>
          <Text style={{ color: row.status === 'ok' ? colors.success : colors.error }}>{row.status as string} · {row.response_time_ms as number} ms</Text>
          {row.error_message ? <Text style={{ color: colors.textSecondary }}>{row.error_message as string}</Text> : null}
        </AppCard>
      ))}
    </Screen>
  );
}
