import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '@/components/layout/Screen';
import { ProfileMenuHost, useProfileMenu } from '@/components/navigation/ProfileMenu';
import { ProfilePostGrid } from '@/components/profile/ProfilePostGrid';
import { AppAvatar } from '@/components/ui/AppAvatar';
import { AppTabs } from '@/components/ui/AppTabs';
import { ImageLightbox } from '@/components/ui/ImageLightbox';
import { requireSupabase } from '@/lib/supabase';
import { isVideoMedia } from '@/services/media';
import { fetchAuthorPosts } from '@/services/feed';
import { useT } from '@/i18n';
import { useAuthStore } from '@/stores/authStore';
import { useLocationPickStore } from '@/stores/locationPickStore';
import { useToastStore } from '@/stores/toastStore';
import { useTheme } from '@/theme/ThemeProvider';

export default function ProfileScreen() {
  return (
    <ProfileMenuHost>
      <ProfileBody />
    </ProfileMenuHost>
  );
}

function ProfileBody() {
  const { colors, name } = useTheme();
  const t = useT();
  const menu = useProfileMenu();
  const profile = useAuthStore((state) => state.profile);
  const setProfile = useAuthStore((state) => state.setProfile);
  const show = useToastStore((state) => state.show);
  const userId = useAuthStore((state) => state.session?.user.id);
  const [tab, setTab] = useState('posts');
  const [coverOpen, setCoverOpen] = useState(false);
  const insets = useSafeAreaInsets();

  useFocusEffect(
    useCallback(() => {
      if (!profile || useLocationPickStore.getState().owner !== 'profile' || !useLocationPickStore.getState().result) return;
      const place = useLocationPickStore.getState().take('profile');
      if (!place) return;
      const patch = { city: place.city, country: place.countryName };
      setProfile({ ...profile, ...patch });
      void requireSupabase()
        .from('profiles')
        .update(patch)
        .eq('id', profile.id)
        .then(({ error }) => {
          if (error) show(error.message, 'error');
          else show(t('locationUpdated'), 'success');
        });
    }, [profile, setProfile, show, t]),
  );
  const posts = useQuery({
    queryKey: ['author-posts', userId, userId],
    enabled: Boolean(userId),
    queryFn: () => fetchAuthorPosts(userId as string, userId as string),
  });
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      void posts.refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]),
  );
  const visiblePosts = (posts.data ?? []).filter((post) => (tab === 'videos' ? post.media.some((item) => isVideoMedia(item.media_type, item.url)) : true));
  const stats = useQuery({
    queryKey: ['profile-stats', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const client = requireSupabase();
      const [postsCount, followers, following] = await Promise.all([
        client.from('posts').select('id', { count: 'exact', head: true }).eq('author_id', userId).is('archived_at', null),
        client.from('follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', userId).eq('status', 'accepted'),
        client.from('follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', userId).eq('status', 'accepted'),
      ]);
      return { posts: postsCount.count ?? 0, followers: followers.count ?? 0, following: following.count ?? 0 };
    },
  });

  return (
    <Screen scroll tabBar padded={false} bleedTop>
      <View style={{ height: 196 + insets.top, backgroundColor: colors.primaryDark }}>
        {profile?.cover_url ? (
          <Pressable
            accessibilityRole="imagebutton"
            accessibilityLabel={t('cover')}
            onPress={() => setCoverOpen(true)}
            style={StyleSheet.absoluteFillObject}
          >
            <Image source={{ uri: profile.cover_url }} style={{ width: '100%', height: '100%' }} contentFit="cover" contentPosition="top" />
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('moreActions')}
          onPress={menu.open}
          style={[
            styles.menuBtn,
            {
              top: insets.top + 8,
              backgroundColor: name === 'dark' ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.86)',
            },
          ]}
        >
          <Ionicons name="menu-outline" size={22} color={colors.text} />
        </Pressable>
      </View>
      <ImageLightbox uri={profile?.cover_url} visible={coverOpen} onClose={() => setCoverOpen(false)} />
      <View style={{ paddingHorizontal: 16, marginTop: -36, gap: 12 }}>
        <AppAvatar uri={profile?.avatar_url} name={profile?.display_name} size={84} />
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: '700' }}>
          {profile?.display_name} {profile?.verified ? '✓' : ''}
        </Text>
        <Text style={{ color: colors.textSecondary }}>@{profile?.username}</Text>
        {profile?.bio ? <Text style={{ color: colors.text, lineHeight: 22 }}>{profile.bio}</Text> : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('changeLocation')}
          onPress={() => {
            useLocationPickStore.getState().begin('profile');
            router.push({ pathname: '/prayer/location', params: { purpose: 'profile' } });
          }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
        >
          <Ionicons name="location-outline" size={18} color={colors.primary} />
          <Text style={{ color: colors.text, fontWeight: '600', flex: 1 }}>
            {[profile?.city, profile?.country].filter(Boolean).join(', ') || t('chooseLocation')}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 18 }}>
          <Text style={{ color: colors.text }}>
            <Text style={{ fontWeight: '800' }}>{stats.data?.posts ?? 0}</Text> {t('postCountLabel')}
          </Text>
          <Text style={{ color: colors.primary }} onPress={() => router.push({ pathname: '/profile/follows', params: { mode: 'followers' } })}>
            <Text style={{ fontWeight: '800' }}>{stats.data?.followers ?? 0}</Text> {t('followers')}
          </Text>
          <Text style={{ color: colors.primary }} onPress={() => router.push({ pathname: '/profile/follows', params: { mode: 'following' } })}>
            <Text style={{ fontWeight: '800' }}>{stats.data?.following ?? 0}</Text> {t('followingCount')}
          </Text>
        </View>
        <AppTabs
          value={tab}
          onChange={setTab}
          tabs={[
            { key: 'posts', label: t('posts') },
            { key: 'videos', label: t('videos') },
          ]}
        />
        {posts.isLoading ? null : visiblePosts.length === 0 ? (
          <Text style={{ color: colors.textSecondary }}>{t('emptyTab')}</Text>
        ) : (
          <View style={styles.gridBleed}>
            <ProfilePostGrid posts={visiblePosts} />
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gridBleed: { marginHorizontal: -16 },
  menuBtn: {
    position: 'absolute',
    end: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
