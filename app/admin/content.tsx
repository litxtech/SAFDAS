import { useState } from 'react';
import { Text } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect } from 'expo-router';
import { Screen } from '@/components/layout/Screen';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppInput } from '@/components/ui/AppInput';
import { useT } from '@/i18n';
import { requireSupabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/theme/ThemeProvider';

export default function AdminContentScreen() {
  const isStaff = useAuthStore((state) => state.isStaff);
  const { colors } = useTheme();
  const t = useT();
  const client = useQueryClient();
  const [title, setTitle] = useState('');
  const [source, setSource] = useState('');
  const query = useQuery({
    queryKey: ['admin-courses'],
    enabled: isStaff,
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('courses').select('id, title, published, source').order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  if (!isStaff) return <Redirect href="/(tabs)" />;

  async function publish() {
    if (title.trim().length < 3 || source.trim().length < 3) return;
    await requireSupabase().from('courses').insert({ title: title.trim(), source: source.trim(), summary: title.trim(), published: false });
    setTitle('');
    setSource('');
    void client.invalidateQueries({ queryKey: ['admin-courses'] });
  }

  return (
    <Screen scroll>
      <AppHeader title={t('contentTitle')} subtitle={t('contentSubtitle')} />
      <AppInput label={t('lessonTitle')} value={title} onChangeText={setTitle} />
      <AppInput label={t('source')} value={source} onChangeText={setSource} />
      <AppButton label={t('addDraft')} onPress={() => void publish()} />
      {query.data?.map((course) => (
        <AppCard key={course.id as string}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>{course.title as string}</Text>
          <Text style={{ color: colors.textSecondary }}>{course.source as string}</Text>
          <AppButton
            label={course.published ? t('unpublish') : t('publish')}
            variant="secondary"
            onPress={() => {
              void requireSupabase().from('courses').update({ published: !course.published }).eq('id', course.id).then(() => client.invalidateQueries({ queryKey: ['admin-courses'] }));
            }}
          />
        </AppCard>
      ))}
    </Screen>
  );
}
