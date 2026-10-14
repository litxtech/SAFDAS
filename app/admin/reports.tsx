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

export default function AdminReportsScreen() {
  const isStaff = useAuthStore((state) => state.isStaff);
  const { colors } = useTheme();
  const t = useT();
  const query = useQuery({
    queryKey: ['admin-reports'],
    enabled: isStaff,
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('reports').select('id, reference_code, status, priority, review_due_at, reason').order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
  if (!isStaff) return <Redirect href="/(tabs)" />;
  const now = Date.now();
  return (
    <Screen scroll>
      <AppHeader title={t('reportQueue')} />
      {query.data?.map((report) => {
        const due = new Date(report.review_due_at as string).getTime();
        const late = due < now && !['action_taken', 'no_violation', 'closed'].includes(report.status as string);
        return (
          <AppCard key={report.id as string}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{report.reference_code as string}</Text>
            <Text style={{ color: report.priority === 'urgent' ? colors.error : colors.textSecondary }}>{report.reason as string} · {report.status as string}</Text>
            <Text style={{ color: late ? colors.warning : colors.textSecondary }}>{late ? t('slaOverdue') : t('slaOnTime')}</Text>
          </AppCard>
        );
      })}
    </Screen>
  );
}
