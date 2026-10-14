import { Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '@/components/layout/Screen';
import { AppCard } from '@/components/ui/AppCard';
import { AppEmptyState } from '@/components/ui/AppEmptyState';
import { AppHeader } from '@/components/ui/AppHeader';
import { useT } from '@/i18n';
import { requireSupabase } from '@/lib/supabase';
import { useTheme } from '@/theme/ThemeProvider';

export default function EducationScreen() {
  const t = useT();
  const { colors } = useTheme();
  const query = useQuery({
    queryKey: ['courses'],
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('courses').select('id, title, summary, source').eq('published', true);
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <Screen scroll>
      <AppHeader title={t('education')} subtitle={t('educationSubtitle')} />
      {(query.data ?? []).length === 0 ? (
        <AppEmptyState icon="school-outline" title={t('noCourseTitle')} body={t('noCourseBody')} />
      ) : null}
      {query.data?.map((course) => (
        <AppCard key={course.id as string}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>{course.title as string}</Text>
          <Text style={{ color: colors.textSecondary }}>{course.summary as string}</Text>
          <Text style={{ color: colors.primary, marginTop: 6 }}>{course.source as string}</Text>
        </AppCard>
      ))}
    </Screen>
  );
}
