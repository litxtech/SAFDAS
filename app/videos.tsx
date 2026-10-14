import { Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable } from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { AppEmptyState } from '@/components/ui/AppEmptyState';
import { AppHeader } from '@/components/ui/AppHeader';
import { useT } from '@/i18n';
import { requireSupabase } from '@/lib/supabase';
import { useTheme } from '@/theme/ThemeProvider';

export default function VideosScreen() {
  const { colors } = useTheme();
  const t = useT();
  const query = useQuery({
    queryKey: ['videos'],
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('post_media').select('post_id, url, media_type, posts(body)').eq('media_type', 'video').limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <Screen scroll>
      <AppHeader title={t('videos')} />
      {(query.data ?? []).length === 0 ? <AppEmptyState icon="videocam-outline" title={t('noVideosTitle')} body={t('noVideosBody')} /> : null}
      {query.data?.map((item) => {
        const post = item.posts as { body?: string } | { body?: string }[] | null;
        const body = Array.isArray(post) ? post[0]?.body : post?.body;
        return (
          <Pressable key={item.post_id as string} onPress={() => router.push({ pathname: '/post/[id]', params: { id: item.post_id as string } })}>
            <Image source={{ uri: item.url as string }} style={{ height: 180, borderRadius: 16 }} contentFit="cover" />
            <Text style={{ color: colors.text, marginVertical: 8 }}>{body || 'Video'}</Text>
          </Pressable>
        );
      })}
    </Screen>
  );
}
