import { Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Redirect } from 'expo-router';
import { Screen } from '@/components/layout/Screen';
import { AppCard } from '@/components/ui/AppCard';
import { AppEmptyState } from '@/components/ui/AppEmptyState';
import { AppHeader } from '@/components/ui/AppHeader';
import { useT } from '@/i18n';
import { requireSupabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/theme/ThemeProvider';

export default function AdminAuditScreen() {
  const isStaff = useAuthStore((state) => state.isStaff);
  const { colors } = useTheme();
  const t = useT();
  const query = useQuery({
    queryKey: ['admin-audit'],
    enabled: isStaff,
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('admin_audit_logs').select('id, action, target, created_at').order('created_at', { ascending: false }).limit(40);
      if (error) throw error;
      return data ?? [];
    },
  });
  if (!isStaff) return <Redirect href="/(tabs)" />;
  return (
    <Screen scroll>
      <AppHeader title={t('auditTitle')} />
      {(query.data ?? []).length === 0 ? <AppEmptyState icon="list-outline" title={t('noRecords')} body={t('auditEmpty')} /> : null}
      {query.data?.map((row) => (
        <AppCard key={row.id as string}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>{row.action as string}</Text>
          <Text style={{ color: colors.textSecondary }}>{row.target as string}</Text>
        </AppCard>
      ))}
    </Screen>
  );
}
