import { Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/layout/Screen';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppProgressBar } from '@/components/ui/AppProgressBar';
import { dateLocale, useI18nStore, useT, type I18nKey } from '@/i18n';
import { requireSupabase } from '@/lib/supabase';
import { useTheme } from '@/theme/ThemeProvider';

const STEPS: { id: string; label: I18nKey }[] = [
  { id: 'received', label: 'statusReceived' },
  { id: 'waiting', label: 'statusWaiting' },
  { id: 'in_review', label: 'statusReview' },
  { id: 'resolved', label: 'statusResolved' },
];

export default function ReportStatusScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const t = useT();
  const locale = useI18nStore((state) => state.locale);
  const query = useQuery({
    queryKey: ['report', id],
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('reports').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const status = (query.data?.status as string | undefined) ?? 'received';
  const index = status === 'action_taken' || status === 'no_violation' || status === 'closed' ? 3 : STEPS.findIndex((step) => step.id === status);
  const due = query.data?.review_due_at ? new Date(query.data.review_due_at as string).toLocaleString(dateLocale(locale)) : '—';

  return (
    <Screen scroll>
      <AppHeader title={t('reportTrack')} subtitle={(query.data?.reference_code as string | undefined) ?? ''} />
      <AppProgressBar value={((Math.max(index, 0) + 1) / STEPS.length) * 100} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {STEPS.map((step, stepIndex) => (
          <Text key={step.id} style={{ color: stepIndex <= index ? colors.primary : colors.textSecondary, fontWeight: '700' }}>{t(step.label)}</Text>
        ))}
      </View>
      <Text style={{ color: colors.textSecondary }}>{t('reportDue', { time: due })}</Text>
    </Screen>
  );
}
