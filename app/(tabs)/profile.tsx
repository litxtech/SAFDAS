import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '@/components/layout/Screen';
import { MembershipTick } from '@/components/membership/MembershipTick';
import { ProfileMenuHost, useProfileMenu } from '@/components/navigation/ProfileMenu';
import {
  ProfileActionButton,
  ProfileAvatarRing,
  ProfileChip,
  ProfileCover,
  ProfileIconButton,
  ProfileSegmentedTabs,
  ProfileStatCard,
} from '@/components/profile/ProfileKit';
import { ProfilePostGrid } from '@/components/profile/ProfilePostGrid';
import { ProfileLocationPicker } from '@/components/profile/ProfileLocationPicker';
import { ImageLightbox } from '@/components/ui/ImageLightbox';
import { requireSupabase } from '@/lib/supabase';
import { isVideoMedia } from '@/services/media';
import { fetchAuthorPosts } from '@/services/feed';
import { fetchOwnerRecordings } from '@/services/studio/api';
import { openStudioDetail, openStudioLibrary } from '@/services/studio/nav';
import { useT } from '@/i18n';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

export default function ProfileScreen() {
  return (
    <ProfileMenuHost>
      <ProfileBody />
    </ProfileMenuHost>
  );
}

function ProfileBody() {
  const { colors } = useTheme();
  const t = useT();
  const menu = useProfileMenu();
  const profile = useAuthStore((state) => state.profile);
  const setProfile = useAuthStore((state) => state.setProfile);
  const show = useToastStore((state) => state.show);
  const userId = useAuthStore((state) => state.session?.user.id);
  const [tab, setTab] = useState('posts');
  const [coverOpen, setCoverOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const posts = useQuery({
    queryKey: ['author-posts', userId, userId],
    enabled: Boolean(userId),
    queryFn: () => fetchAuthorPosts(userId as string, userId as string),
  });
  const studio = useQuery({
    queryKey: ['profile-studio', userId],
    enabled: Boolean(userId) && tab === 'voices',
    queryFn: () => fetchOwnerRecordings(userId as string),
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

  const initial = (profile?.display_name ?? profile?.username ?? '?').trim().charAt(0).toUpperCase();
  const placeLabel = [profile?.city, profile?.country].filter(Boolean).join(', ') || t('chooseLocation');
  const applyLocation = (place: { countryCode: string; countryName: string; cityName: string }) => {
    setLocationOpen(false);
    if (!profile) return;
    const patch = { city: place.cityName, country: place.countryName };
    setProfile({ ...profile, ...patch });
    void requireSupabase()
      .from('profiles')
      .update(patch)
      .eq('id', profile.id)
      .then(({ error }) => {
        if (error) show(error.message, 'error');
        else show(t('locationUpdated'), 'success');
      });
    // Keep the private country code in sync so NASİP can prefill reliably.
    void requireSupabase()
      .from('profile_private')
      .upsert({ user_id: profile.id, country_code: place.countryCode || null }, { onConflict: 'user_id' });
  };

  return (
    <Screen scroll tabBar padded={false} bleedTop>
      <ProfileCover
        uri={profile?.cover_url}
        initial={initial}
        height={252 + insets.top}
        onPress={() => setCoverOpen(true)}
        accessibilityLabel={t('cover')}
      >
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <View style={styles.topBarSpacer} />
          <ProfileIconButton icon="menu-outline" label={t('moreActions')} onPress={menu.open} />
        </View>
      </ProfileCover>
      <ImageLightbox uri={profile?.cover_url} visible={coverOpen} onClose={() => setCoverOpen(false)} accessibilityLabel={t('cover')} />
      <ImageLightbox uri={profile?.avatar_url} visible={avatarOpen} onClose={() => setAvatarOpen(false)} accessibilityLabel={t('avatar')} />

      <View style={styles.body}>
        <View style={styles.identityRow}>
          <Pressable accessibilityRole="imagebutton" accessibilityLabel={t('avatar')} onPress={() => setAvatarOpen(true)}>
            <ProfileAvatarRing uri={profile?.avatar_url} name={profile?.display_name} size={96} />
          </Pressable>
          <ProfileActionButton
            icon="create-outline"
            label={t('editProfile')}
            variant="secondary"
            onPress={() => router.push('/profile/edit')}
            style={styles.editAction}
          />
        </View>

        <View style={styles.nameBlock}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
              {profile?.display_name || profile?.username || '—'}
            </Text>
            {profile?.verified ? <Ionicons name="shield-checkmark" size={18} color={colors.primary} /> : null}
            <MembershipTick userId={profile?.id} size={19} />
          </View>
          <Text style={[styles.handle, { color: colors.textSecondary }]}>@{profile?.username || '—'}</Text>
          {profile?.bio ? (
            <Text style={[styles.bio, { color: colors.text }]} numberOfLines={4}>
              {profile.bio}
            </Text>
          ) : null}
          <View style={styles.chips}>
            <ProfileChip
              icon="location-outline"
              label={placeLabel}
              onPress={() => setLocationOpen(true)}
              accessibilityLabel={t('changeLocation')}
            />
          </View>
        </View>

        <ProfileStatCard
          items={[
            { key: 'posts', value: stats.data?.posts ?? 0, label: t('postCountLabel') },
            {
              key: 'followers',
              value: stats.data?.followers ?? 0,
              label: t('followers'),
              onPress: () => router.push({ pathname: '/profile/follows', params: { mode: 'followers' } }),
            },
            {
              key: 'following',
              value: stats.data?.following ?? 0,
              label: t('followingCount'),
              onPress: () => router.push({ pathname: '/profile/follows', params: { mode: 'following' } }),
            },
          ]}
        />

        <ProfileSegmentedTabs
          value={tab}
          onChange={setTab}
          tabs={[
            { key: 'posts', label: t('posts'), icon: 'grid-outline' },
            { key: 'videos', label: t('videos'), icon: 'play-circle-outline' },
            { key: 'voices', label: t('studioVoicesTab'), icon: 'mic-outline' },
          ]}
        />

        {tab === 'voices' ? (
          <View style={[styles.voiceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Pressable onPress={openStudioLibrary} style={styles.voiceLibrary}>
              <View style={[styles.voiceIcon, { backgroundColor: colors.primaryMuted }]}>
                <Ionicons name="albums-outline" size={16} color={colors.primary} />
              </View>
              <Text style={{ color: colors.text, fontWeight: '700', flex: 1 }}>{t('studioLibrary')}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            </Pressable>
            {studio.isLoading ? null : !(studio.data?.length ?? 0) ? (
              <Text style={[styles.muted, { color: colors.textSecondary }]}>{t('studioLibraryEmpty')}</Text>
            ) : (
              (studio.data ?? []).map((item, index) => (
                <Pressable
                  key={item.id}
                  onPress={() => openStudioDetail(item.id)}
                  style={[
                    styles.voiceRow,
                    index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
                  ]}
                >
                  <View style={[styles.voiceIcon, { backgroundColor: colors.primaryMuted }]}>
                    <Ionicons name="musical-notes" size={16} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 11.5 }}>
                      {item.unique_listeners} · {Math.round(item.duration_seconds)}s
                    </Text>
                  </View>
                  <Ionicons name="play-circle" size={24} color={colors.primary} />
                </Pressable>
              ))
            )}
          </View>
        ) : posts.isLoading ? null : visiblePosts.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.primaryMuted }]}>
              <Ionicons name={tab === 'videos' ? 'videocam-outline' : 'images-outline'} size={26} color={colors.primary} />
            </View>
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15 }}>{t('emptyTab')}</Text>
            <Pressable
              onPress={() => router.push('/post/create')}
              style={({ pressed }) => [styles.emptyCta, { backgroundColor: colors.primaryMuted, opacity: pressed ? 0.8 : 1 }]}
            >
              <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
              <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 13 }}>{t('newPost')}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.gridBleed}>
            <ProfilePostGrid
              posts={visiblePosts}
              canManage
              onDeleted={() => {
                void queryClient.invalidateQueries({ queryKey: ['author-posts', userId] });
                void queryClient.invalidateQueries({ queryKey: ['profile-stats', userId] });
                void queryClient.invalidateQueries({ queryKey: ['feed'] });
              }}
            />
          </View>
        )}
      </View>

      <ProfileLocationPicker
        visible={locationOpen}
        initialCountryCode="TR"
        initialCountryName={profile?.country ?? undefined}
        onClose={() => setLocationOpen(false)}
        onSelect={applyLocation}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: 8,
  },
  topBarSpacer: { flex: 1 },
  body: { paddingHorizontal: spacing.lg, marginTop: -46, gap: 14, paddingBottom: 8 },
  identityRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  editAction: { marginBottom: 6 },
  nameBlock: { gap: 5 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name: { fontSize: 25, fontWeight: '800', letterSpacing: -0.6, flexShrink: 1 },
  handle: { fontSize: 13.5, fontWeight: '600' },
  bio: { fontSize: 14.5, lineHeight: 21, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 6 },
  gridBleed: { marginHorizontal: -spacing.lg },
  muted: { fontSize: 13, padding: 14 },
  empty: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 30,
    paddingHorizontal: 18,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
  },
  emptyIcon: { width: 56, height: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    marginTop: 2,
  },
  voiceCard: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  voiceLibrary: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, minHeight: 52 },
  voiceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 11 },
  voiceIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
