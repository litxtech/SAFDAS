import { Pressable, Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/layout/Screen';
import { AppEmptyState } from '@/components/ui/AppEmptyState';
import { AppHeader } from '@/components/ui/AppHeader';
import { useT } from '@/i18n';
import { requireSupabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/theme/ThemeProvider';

export default function FollowsScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const followers = mode !== 'following';
  const { colors } = useTheme();
  const t = useT();
  const userId = useAuthStore((state) => state.session?.user.id);
  const query = useQuery({
    queryKey: ['follows-list', userId, mode],
    enabled: Boolean(userId),
    queryFn: async () => {
      const client = requireSupabase();
      const filter = followers ? 'following_id' : 'follower_id';
      const column = followers ? 'follower_id' : 'following_id';
      const { data, error } = await client.from('follows').select('follower_id, following_id').eq(filter, userId).eq('status', 'accepted');
      if (error) throw error;
      const ids = (data ?? []).map((row) => row[column] as string);
      if (!ids.length) return [];
      const profiles = await client.from('profiles').select('id, username, display_name').in('id', ids);
      if (profiles.error) throw profiles.error;
      return profiles.data ?? [];
    },
  });

  return (
    <Screen scroll>
      <AppHeader title={followers ? t('followersList') : t('followingList')} />
      {(query.data ?? []).length === 0 ? <AppEmptyState icon="people-outline" title={t('emptyListTitle')} body={t('emptyListBody')} /> : null}
      {query.data?.map((profile) => (
        <Pressable key={profile.id as string} onPress={() => router.push({ pathname: '/user/[id]', params: { id: profile.id as string } })}>
          <Text style={{ color: colors.text, paddingVertical: 12, fontSize: 16 }}>{profile.display_name as string} · @{profile.username as string}</Text>
        </Pressable>
      ))}
    </Screen>
  );
}
