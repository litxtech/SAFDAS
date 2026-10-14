import { Share, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Screen } from '@/components/layout/Screen';
import { AppAvatar } from '@/components/ui/AppAvatar';
import { AppButton } from '@/components/ui/AppButton';
import { AppTabs } from '@/components/ui/AppTabs';
import { LinkRow } from '@/components/ui/LinkRow';
import { requireSupabase } from '@/lib/supabase';
import { useT } from '@/i18n';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/theme/ThemeProvider';
import { useState } from 'react';

export default function ProfileScreen() {
  const { colors } = useTheme();
  const t = useT();
  const profile = useAuthStore((state) => state.profile);
  const userId = useAuthStore((state) => state.session?.user.id);
  const [tab, setTab] = useState('posts');
  const posts = useQuery({
    queryKey: ['my-posts', userId, tab],
    enabled: Boolean(userId) && tab !== 'about',
    queryFn: async () => {
      const client = requireSupabase();
      if (tab === 'videos') {
        const { data, error } = await client.from('post_media').select('post_id, posts!inner(id, body, author_id)').eq('media_type', 'video').eq('posts.author_id', userId).limit(20);
        if (error) throw error;
        return data ?? [];
      }
      const { data, error } = await client.from('posts').select('id, body, created_at').eq('author_id', userId).is('archived_at', null).order('created_at', { ascending: false }).limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });
  const stats = useQuery({
    queryKey: ['profile-stats', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const client = requireSupabase();
      const [posts, followers, following] = await Promise.all([
        client.from('posts').select('id', { count: 'exact', head: true }).eq('author_id', userId).is('archived_at', null),
        client.from('follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', userId).eq('status', 'accepted'),
        client.from('follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', userId).eq('status', 'accepted'),
      ]);
      return { posts: posts.count ?? 0, followers: followers.count ?? 0, following: following.count ?? 0 };
    },
  });

  return (
    <Screen scroll tabBar padded={false}>
      <View style={{ height: 160, backgroundColor: colors.primaryDark }}>
        {profile?.cover_url ? <Image source={{ uri: profile.cover_url }} style={{ width: '100%', height: 160 }} contentFit="cover" /> : null}
      </View>
      <View style={{ paddingHorizontal: 16, marginTop: -36, gap: 12 }}>
        <AppAvatar uri={profile?.avatar_url} name={profile?.display_name} size={84} />
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: '700' }}>
          {profile?.display_name} {profile?.verified ? '✓' : ''}
        </Text>
        <Text style={{ color: colors.textSecondary }}>@{profile?.username}</Text>
        {profile?.bio ? <Text style={{ color: colors.text, lineHeight: 22 }}>{profile.bio}</Text> : null}
        <Text style={{ color: colors.textSecondary }}>{[profile?.city, profile?.country].filter(Boolean).join(', ')}</Text>
        <View style={{ flexDirection: 'row', gap: 18 }}>
          <Text style={{ color: colors.text }}><Text style={{ fontWeight: '800' }}>{stats.data?.posts ?? 0}</Text> {t('postCountLabel')}</Text>
          <Text style={{ color: colors.primary }} onPress={() => router.push({ pathname: '/profile/follows', params: { mode: 'followers' } })}><Text style={{ fontWeight: '800' }}>{stats.data?.followers ?? 0}</Text> {t('followers')}</Text>
          <Text style={{ color: colors.primary }} onPress={() => router.push({ pathname: '/profile/follows', params: { mode: 'following' } })}><Text style={{ fontWeight: '800' }}>{stats.data?.following ?? 0}</Text> {t('followingCount')}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><AppButton label={t('editProfile')} onPress={() => router.push('/profile/edit')} /></View>
          <View style={{ flex: 1 }}>
            <AppButton
              label={t('shareProfile')}
              variant="secondary"
              onPress={() => void Share.share({ message: `${profile?.display_name ?? 'SAFDAŞ'} · @${profile?.username ?? ''}` })}
            />
          </View>
        </View>
        <AppTabs
          value={tab}
          onChange={setTab}
          tabs={[
            { key: 'posts', label: t('posts') },
            { key: 'videos', label: t('videos') },
            { key: 'about', label: t('about') },
          ]}
        />
        {tab === 'about' ? (
          <View style={{ gap: 10 }}>
            <LinkRow icon="bookmark-outline" label={t('saved')} onPress={() => router.push('/saved')} />
            <LinkRow icon="journal-outline" label={t('journal')} onPress={() => router.push('/journal')} />
            <LinkRow icon="videocam-outline" label={t('videos')} onPress={() => router.push('/videos')} />
            <LinkRow icon="settings-outline" label={t('settings')} onPress={() => router.push('/settings')} />
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {(posts.data ?? []).length === 0 ? <Text style={{ color: colors.textSecondary }}>{t('emptyTab')}</Text> : null}
            {posts.data?.map((item) => {
              const id = ('post_id' in item ? item.post_id : item.id) as string;
              const nested = 'posts' in item ? (item.posts as { body?: string } | { body?: string }[] | null) : null;
              const body = 'body' in item ? (item.body as string) : Array.isArray(nested) ? nested[0]?.body : nested?.body;
              return (
                <Text key={id} style={{ color: colors.text }} onPress={() => router.push({ pathname: '/post/[id]', params: { id } })}>
                  {body || t('postFallback')}
                </Text>
              );
            })}
          </View>
        )}
      </View>
    </Screen>
  );
}
