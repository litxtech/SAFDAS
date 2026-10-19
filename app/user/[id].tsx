import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProfilePostGrid } from '@/components/profile/ProfilePostGrid';
import { Screen } from '@/components/layout/Screen';
import { AppAvatar } from '@/components/ui/AppAvatar';
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
  const { colors, name } = useTheme();
  const t = useT();
  const locale = useI18nStore((state) => state.locale);
  const rtl = isRtlLocale(locale);
  const me = useAuthStore((state) => state.session?.user.id);
  const show = useToastStore((state) => state.show);
  const client = useQueryClient();
  const insets = useSafeAreaInsets();
  const [menu, setMenu] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);
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
      return data?.status as string | undefined;
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

  return (
    <Screen scroll padded={false} bleedTop back={false}>
      <View style={[styles.cover, { height: 168 + insets.top, backgroundColor: colors.primaryDark }]}>
        {person?.cover_url ? (
          <Pressable
            accessibilityRole="imagebutton"
            accessibilityLabel={t('cover')}
            onPress={() => setCoverOpen(true)}
            style={StyleSheet.absoluteFillObject}
          >
            <Image source={{ uri: person.cover_url }} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" />
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('back')}
          onPress={() => router.back()}
          style={[styles.float, { top: insets.top + 8, start: 12, backgroundColor: name === 'dark' ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.86)' }]}
        >
          <Ionicons name={rtl ? 'chevron-forward' : 'chevron-back'} size={22} color={colors.text} />
        </Pressable>
        {mine ? null : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('moreActions')}
            onPress={() => setMenu(true)}
            style={[styles.float, { top: insets.top + 8, end: 12, backgroundColor: name === 'dark' ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.86)' }]}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
          </Pressable>
        )}
      </View>
      <ImageLightbox uri={person?.cover_url} visible={coverOpen} onClose={() => setCoverOpen(false)} />
      <View style={styles.body}>
        <View style={styles.identity}>
          <View style={[styles.avatarRing, { borderColor: colors.background }]}>
            <AppAvatar uri={person?.avatar_url} name={person?.display_name} size={84} />
          </View>
          {mine ? (
            <Pressable accessibilityRole="button" onPress={() => router.push('/profile/edit')} style={[styles.follow, { borderColor: colors.border }]}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{t('editProfile')}</Text>
            </Pressable>
          ) : (
            <View style={styles.actions}>
              <Pressable accessibilityRole="button" accessibilityLabel={t('sendMessage')} onPress={() => void message()} style={[styles.iconAction, { borderColor: colors.border }]}>
                <Ionicons name="mail-outline" size={18} color={colors.text} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => void toggleFollow()}
                style={[styles.follow, { backgroundColor: following || pending ? 'transparent' : colors.text, borderColor: following || pending ? colors.border : colors.text }]}
              >
                <Text style={{ color: following || pending ? colors.text : colors.background, fontWeight: '700' }}>
                  {pending ? t('followRequested') : following ? t('unfollow') : t('follow')}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
        <Text style={[styles.name, { color: colors.text }]}>{person?.display_name}{person?.verified ? ' ✓' : ''}</Text>
        <Text style={{ color: colors.textSecondary }}>@{person?.username}</Text>
        {person?.bio ? <Text style={{ color: colors.text, lineHeight: 22 }}>{person.bio}</Text> : null}
        <View style={styles.meta}>
          {place ? (
            <View style={styles.metaItem}>
              <Ionicons name="location-outline" size={15} color={colors.textSecondary} />
              <Text style={{ color: colors.textSecondary }}>{place}</Text>
            </View>
          ) : null}
          {joined ? (
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={15} color={colors.textSecondary} />
              <Text style={{ color: colors.textSecondary }}>{t('joinedOn', { date: joined })}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.stats}>
          <Text style={{ color: colors.text }} onPress={() => openFollows('following')}>
            <Text style={styles.count}>{stats.data?.following ?? 0}</Text> {t('followingCount')}
          </Text>
          <Text style={{ color: colors.text }} onPress={() => openFollows('followers')}>
            <Text style={styles.count}>{stats.data?.followers ?? 0}</Text> {t('followers')}
          </Text>
        </View>
        <Text style={[styles.section, { color: colors.text, borderBottomColor: colors.primary }]}>{t('posts')}</Text>
        {locked ? (
          <View style={styles.locked}>
            <Ionicons name="lock-closed-outline" size={28} color={colors.textSecondary} />
            <Text style={{ color: colors.text, fontWeight: '700' }}>{t('privateAccount')}</Text>
            <Text style={{ color: colors.textSecondary, textAlign: 'center', lineHeight: 20 }}>{t('privatePosts')}</Text>
          </View>
        ) : (
          posts.isLoading ? null : (posts.data ?? []).length === 0 ? (
            <Text style={{ color: colors.textSecondary }}>{t('emptyTab')}</Text>
          ) : (
            <View style={styles.gridBleed}>
              <ProfilePostGrid posts={posts.data ?? []} />
            </View>
          )
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
  cover: { width: '100%' },
  float: { position: 'absolute', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 16, paddingBottom: 28, gap: 8 },
  identity: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  avatarRing: { marginTop: -42, borderWidth: 4, borderRadius: 999 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  iconAction: { width: 36, height: 36, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  follow: { minHeight: 36, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 22, fontWeight: '800', marginTop: 4 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stats: { flexDirection: 'row', gap: 16, marginTop: 4 },
  count: { fontWeight: '800' },
  section: { marginTop: 8, paddingBottom: 10, borderBottomWidth: 2, alignSelf: 'flex-start', fontWeight: '700' },
  gridBleed: { marginHorizontal: -16 },
  locked: { alignItems: 'center', gap: 8, paddingVertical: 28, paddingHorizontal: 12 },
});
