import { Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '@/components/layout/Screen';
import { AppCard } from '@/components/ui/AppCard';
import { AppEmptyState } from '@/components/ui/AppEmptyState';
import { AppHeader } from '@/components/ui/AppHeader';
import { useT } from '@/i18n';
import { requireSupabase } from '@/lib/supabase';
import { useTheme } from '@/theme/ThemeProvider';

export default function MosquesScreen() {
  const t = useT();
  const { colors } = useTheme();
  const query = useQuery({
    queryKey: ['mosques'],
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('mosques').select('id, name, city, verified').order('name');
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <Screen scroll>
      <AppHeader title={t('mosques')} subtitle={t('mosquesSubtitle')} />
      {(query.data ?? []).length === 0 ? <AppEmptyState icon="business-outline" title={t('noMosqueTitle')} body={t('noMosqueBody')} /> : null}
      {query.data?.map((mosque) => (
        <AppCard key={mosque.id as string}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>{mosque.name as string} {mosque.verified ? '✓' : ''}</Text>
          <Text style={{ color: colors.textSecondary }}>{mosque.city as string}</Text>
        </AppCard>
      ))}
    </Screen>
  );
}
