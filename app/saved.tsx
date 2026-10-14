import { Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable } from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { AppEmptyState } from '@/components/ui/AppEmptyState';
import { AppHeader } from '@/components/ui/AppHeader';
import { useT } from '@/i18n';
import { requireSupabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/theme/ThemeProvider';

export default function SavedScreen() {
  const { colors } = useTheme();
  const t = useT();
  const userId = useAuthStore((state) => state.session?.user.id);
  const query = useQuery({
    queryKey: ['saved', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('saved_posts').select('post_id, posts(body, created_at)').eq('user_id', userId).order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <Screen scroll>
      <AppHeader title={t('saved')} subtitle={t('savedSubtitle')} />
      {(query.data ?? []).length === 0 ? <AppEmptyState icon="bookmark-outline" title={t('noSavedTitle')} body={t('noSavedBody')} /> : null}
      {query.data?.map((item) => {
        const post = item.posts as { body?: string } | { body?: string }[] | null;
        const body = Array.isArray(post) ? post[0]?.body : post?.body;
        return (
          <Pressable key={item.post_id as string} onPress={() => router.push({ pathname: '/post/[id]', params: { id: item.post_id as string } })}>
            <Text style={{ color: colors.text, paddingVertical: 12 }}>{body || t('postFallback')}</Text>
          </Pressable>
        );
      })}
    </Screen>
  );
}
