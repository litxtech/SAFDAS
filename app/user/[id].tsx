import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProfilePostGrid } from '@/components/profile/ProfilePostGrid';
import {
  ProfileActionButton,
  ProfileAvatarRing,
  ProfileChip,
  ProfileCover,
  ProfileIconButton,
  ProfileStatCard,
} from '@/components/profile/ProfileKit';
import { MembershipTick } from '@/components/membership/MembershipTick';
import { Screen } from '@/components/layout/Screen';
import { AppBottomSheet } from '@/components/ui/AppBottomSheet';
import { AppButton } from '@/components/ui/AppButton';
import { ImageLightbox } from '@/components/ui/ImageLightbox';
import { dateLocale, isRtlLocale, useI18nStore, useT } from '@/i18n';
import { requireSupabase } from '@/lib/supabase';
import { fetchAuthorPosts } from '@/services/feed';
import { blockUser, invalidateAfterBlockChange } from '@/services/safety';
import { useAuthStore } from '@/stores/authStore';
import { useReportSheetStore } from '@/stores/reportSheetStore';
import { useToastStore } from '@/stores/toastStore';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

type VisitProfile = {
  id: string;
  display_name: string | null;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  city: string | null;
  country: string | null;
  is_private: boolean;
  verified: boolean;
  created_at: string | null;
};

export default function UserScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const t = useT();
  const locale = useI18nStore((state) => state.locale);
  const rtl = isRtlLocale(locale);
  const me = useAuthStore((state) => state.session?.user.id);
  const show = useToastStore((state) => state.show);
  const client = useQueryClient();
  const insets = useSafeAreaInsets();
  const [menu, setMenu] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const mine = Boolean(me && id && me === id);
  const profile = useQuery({
    queryKey: ['user', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('profiles')
        .select('id, display_name, username, bio, avatar_url, cover_url, city, country, is_private, verified, created_at')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data as VisitProfile | null;
    },
  });
  const follow = useQuery({
    queryKey: ['follow', me, id],
    enabled: Boolean(me && id && !mine),
    queryFn: async () => {
      const { data } = await requireSupabase().from('follows').select('status').eq('follower_id', me).eq('following_id', id).maybeSingle();
      // React Query forbids undefined — use null when there is no follow row.
      return (data?.status as string | null | undefined) ?? null;
    },
  });
  const stats = useQuery({
    queryKey: ['profile-stats', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const db = requireSupabase();
      const [posts, followers, following] = await Promise.all([
        db.from('posts').select('id', { count: 'exact', head: true }).eq('author_id', id).is('archived_at', null),
        db.from('follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', id).eq('status', 'accepted'),
        db.from('follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', id).eq('status', 'accepted'),
      ]);
      return { posts: posts.count ?? 0, followers: followers.count ?? 0, following: following.count ?? 0 };
    },
  });
  const locked = Boolean(profile.data?.is_private && !mine && follow.data !== 'accepted');
  const posts = useQuery({
    queryKey: ['author-posts', id, me],
    enabled: Boolean(id && me && !locked),
    queryFn: () => fetchAuthorPosts(id as string, me as string),
  });
  const person = profile.data;
  const place = [person?.city, person?.country].filter(Boolean).join(', ');
  const joined = person?.created_at ? new Date(person.created_at).toLocaleDateString(dateLocale(locale), { month: 'long', year: 'numeric' }) : '';

  async function toggleFollow() {
    if (!me || !id || mine) return;
    if (follow.data) {
      await requireSupabase().from('follows').delete().eq('follower_id', me).eq('following_id', id);
    } else {
      const status = person?.is_private ? 'pending' : 'accepted';
      const { error } = await requireSupabase().from('follows').insert({ follower_id: me, following_id: id, status });
      if (error) show(error.message, 'error');
    }
    void client.invalidateQueries({ queryKey: ['follow', me, id] });
    void client.invalidateQueries({ queryKey: ['profile-stats', id] });
    void client.invalidateQueries({ queryKey: ['author-posts', id, me] });
  }

  async function message() {
    if (!me || !id) return;
    const { data, error } = await requireSupabase().rpc('get_or_create_direct_conversation', { other_user: id });
    if (error || !data) show(error?.message ?? t('chatFailed'), 'error');
    else router.push({ pathname: '/chat/[id]', params: { id: data as string } });
  }

  function openFollows(mode: 'followers' | 'following') {
    router.push({ pathname: '/profile/follows', params: { mode, user: id } });
  }

  const following = follow.data === 'accepted';
  const pending = follow.data === 'pending';
  const initial = (person?.display_name ?? person?.username ?? '?').trim().charAt(0).toUpperCase();

  return (
    <Screen scroll padded={false} bleedTop back={false}>
      <ProfileCover
        uri={person?.cover_url}
        initial={initial}
        height={236 + insets.top}
        onPress={() => setCoverOpen(true)}
        accessibilityLabel={t('cover')}
      >
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <ProfileIconButton
            icon={rtl ? 'chevron-forward' : 'chevron-back'}
            label={t('back')}
            onPress={() => router.back()}
          />
          <View style={styles.topBarSpacer} />
          {mine ? null : (
            <ProfileIconButton icon="ellipsis-horizontal" label={t('moreActions')} onPress={() => setMenu(true)} />
          )}
        </View>
      </ProfileCover>
      <ImageLightbox uri={person?.cover_url} visible={coverOpen} onClose={() => setCoverOpen(false)} accessibilityLabel={t('cover')} />
      <ImageLightbox uri={person?.avatar_url} visible={avatarOpen} onClose={() => setAvatarOpen(false)} accessibilityLabel={t('avatar')} />

      <View style={styles.body}>
        <View style={styles.identityRow}>
          <Pressable accessibilityRole="imagebutton" accessibilityLabel={t('avatar')} onPress={() => setAvatarOpen(true)}>
            <ProfileAvatarRing uri={person?.avatar_url} name={person?.display_name} size={96} />
          </Pressable>
          {mine ? (
            <ProfileActionButton
              icon="create-outline"
              label={t('editProfile')}
              variant="secondary"
              onPress={() => router.push('/profile/edit')}
              style={styles.identityAction}
            />
          ) : (
            <View style={styles.actions}>
              <ProfileIconButton icon="mail-outline" label={t('sendMessage')} onPress={() => void message()} variant="surface" />
              <ProfileActionButton
                icon={pending ? 'hourglass-outline' : following ? 'checkmark' : 'person-add-outline'}
                label={pending ? t('followRequested') : following ? t('unfollow') : t('follow')}
                variant={following || pending ? 'secondary' : 'primary'}
                onPress={() => void toggleFollow()}
                style={styles.identityAction}
              />
            </View>
          )}
        </View>

        <View style={styles.nameBlock}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
              {person?.display_name || person?.username || '—'}
            </Text>
            {person?.verified ? <Ionicons name="shield-checkmark" size={18} color={colors.primary} /> : null}
            <MembershipTick userId={person?.id} size={19} />
          </View>
          <Text style={[styles.handle, { color: colors.textSecondary }]}>@{person?.username || '—'}</Text>
          {person?.bio ? (
            <Text style={[styles.bio, { color: colors.text }]} numberOfLines={5}>
              {person.bio}
            </Text>
          ) : null}
          {place || joined ? (
            <View style={styles.chips}>
              {place ? <ProfileChip icon="location-outline" label={place} /> : null}
              {joined ? <ProfileChip icon="calendar-outline" label={t('joinedOn', { date: joined })} /> : null}
            </View>
          ) : null}
        </View>

        <ProfileStatCard
          items={[
            { key: 'posts', value: stats.data?.posts ?? 0, label: t('postCountLabel') },
            {
              key: 'followers',
              value: stats.data?.followers ?? 0,
              label: t('followers'),
              onPress: () => openFollows('followers'),
            },
            {
              key: 'following',
              value: stats.data?.following ?? 0,
              label: t('followingCount'),
              onPress: () => openFollows('following'),
            },
          ]}
        />

        <View style={styles.postsHead}>
          <Text style={[styles.postsTitle, { color: colors.text }]}>{t('posts')}</Text>
          <View style={[styles.postsLine, { backgroundColor: colors.primary }]} />
        </View>

        {locked ? (
          <View style={[styles.lockedCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.lockedIcon, { backgroundColor: colors.primaryMuted }]}>
              <Ionicons name="lock-closed-outline" size={24} color={colors.primary} />
            </View>
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15 }}>{t('privateAccount')}</Text>
            <Text style={{ color: colors.textSecondary, textAlign: 'center', lineHeight: 20, fontSize: 13 }}>{t('privatePosts')}</Text>
          </View>
        ) : posts.isLoading ? null : (posts.data ?? []).length === 0 ? (
          <View style={[styles.lockedCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.lockedIcon, { backgroundColor: colors.primaryMuted }]}>
              <Ionicons name="images-outline" size={24} color={colors.primary} />
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{t('emptyTab')}</Text>
          </View>
        ) : (
          <View style={styles.gridBleed}>
            <ProfilePostGrid posts={posts.data ?? []} />
          </View>
        )}
      </View>

      <AppBottomSheet visible={menu} title={person?.display_name || t('moreActions')} onClose={() => setMenu(false)}>
        <AppButton
          label={t('reportAction')}
          variant="secondary"
          onPress={() => {
            setMenu(false);
            if (!id) return;
            useReportSheetStore.getState().present({ targetType: 'profile', targetId: id, reportedUserId: id });
          }}
        />
        <AppButton
          label={t('reportPhoto')}
          variant="secondary"
          onPress={() => {
            setMenu(false);
            if (!id) return;
            useReportSheetStore.getState().present({ targetType: 'profile_photo', targetId: id, reportedUserId: id });
          }}
        />
        <AppButton
          label={t('block')}
          variant="danger"
          onPress={() => {
            setMenu(false);
            if (!me || !id) return;
            void blockUser(id)
              .then(() => {
                show(t('userBlocked'), 'success');
                invalidateAfterBlockChange(client, me);
                router.back();
              })
              .catch((error: Error) => show(error.message, 'error'));
          }}
        />
      </AppBottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: 8, gap: 8 },
  topBarSpacer: { flex: 1 },
  body: { paddingHorizontal: spacing.lg, marginTop: -46, gap: 14, paddingBottom: 28 },
  identityRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  identityAction: { marginBottom: 6 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  nameBlock: { gap: 5 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name: { fontSize: 25, fontWeight: '800', letterSpacing: -0.6, flexShrink: 1 },
  handle: { fontSize: 13.5, fontWeight: '600' },
  bio: { fontSize: 14.5, lineHeight: 21, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 6 },
  postsHead: { gap: 8, marginTop: 2 },
  postsTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  postsLine: { height: 2, width: 36, borderRadius: 2 },
  gridBleed: { marginHorizontal: -spacing.lg },
  lockedCard: {
    alignItems: 'center',
    gap: 9,
    paddingVertical: 28,
    paddingHorizontal: 18,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
  },
  lockedIcon: { width: 54, height: 54, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
