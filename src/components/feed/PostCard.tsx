import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { PostMedia } from '@/components/feed/PostMedia';
import { StudioFeedPlayer } from '@/components/studio/StudioFeedPlayer';
import { AppAvatar } from '@/components/ui/AppAvatar';
import { AppBottomSheet } from '@/components/ui/AppBottomSheet';
import { dateLocale, useI18nStore, useT, type Locale } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { blockUser, invalidateAfterBlockChange } from '@/services/safety';
import { sharePost } from '@/services/share';
import { useAuthStore } from '@/stores/authStore';
import { useReportSheetStore } from '@/stores/reportSheetStore';
import { useToastStore } from '@/stores/toastStore';
import { useTheme } from '@/theme/ThemeProvider';

export type FeedMedia = { url: string; media_type: string | null };
export type FeedComment = { id: string; body: string; username: string | null };

export type QuotedFeedPost = {
  id: string;
  body: string | null;
  author_id: string;
  media: FeedMedia[];
  profiles: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    verified: boolean;
  } | null;
};

export type FeedPost = {
  id: string;
  body: string | null;
  created_at: string;
  author_id: string;
  kind?: string | null;
  location_name: string | null;
  quoted_post_id?: string | null;
  studio_recording_id?: string | null;
  quoted?: QuotedFeedPost | null;
  like_count: number;
  comment_count: number;
  repost_count: number;
  liked: boolean;
  saved: boolean;
  reposted: boolean;
  media: FeedMedia[];
  comments: FeedComment[];
  profiles: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    verified: boolean;
  } | null;
};

const PREVIEW = 280;

function relative(
  iso: string,
  locale: Locale,
  t: (key: 'justNow' | 'minutesAgo' | 'hoursAgo' | 'daysAgo', vars?: Record<string, string | number>) => string,
) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return t('justNow');
  if (minutes < 60) return t('minutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('hoursAgo', { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t('daysAgo', { count: days });
  return new Date(iso).toLocaleDateString(dateLocale(locale), { month: 'short', day: 'numeric' });
}

function formatCount(n: number) {
  if (n <= 0) return '';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}K`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

export function PostCard({ post, onChange }: { post: FeedPost; onChange: () => void }) {
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const t = useT();
  const locale = useI18nStore((state) => state.locale);
  const userId = useAuthStore((state) => state.session?.user.id);
  const show = useToastStore((state) => state.show);

  const [liked, setLiked] = useState(post.liked);
  const [saved, setSaved] = useState(post.saved);
  const [reposted, setReposted] = useState(post.reposted);
  const [likes, setLikes] = useState(post.like_count);
  const [reposts, setReposts] = useState(post.repost_count);
  const [expanded, setExpanded] = useState(false);
  const [menu, setMenu] = useState(false);
  const [repostMenu, setRepostMenu] = useState(false);

  const heartScale = useRef(new Animated.Value(1)).current;
  const saveScale = useRef(new Animated.Value(1)).current;
  const repostScale = useRef(new Animated.Value(1)).current;
  const lastTap = useRef(0);

  const displayName = post.profiles?.display_name || post.profiles?.username || t('userFallback');
  const handle = post.profiles?.username ?? t('userFallback');
  const body = post.body ?? '';
  const long = body.length > PREVIEW;
  const mine = userId === post.author_id;
  const hasMedia = post.media.length > 0;

  const animateBounce = useCallback((anim: Animated.Value) => {
    Animated.sequence([
      Animated.spring(anim, { toValue: 0.82, useNativeDriver: true, tension: 300, friction: 8 }),
      Animated.spring(anim, { toValue: 1.15, useNativeDriver: true, tension: 300, friction: 8 }),
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, tension: 300, friction: 8 }),
    ]).start();
  }, []);

  async function toggleLike(fromDoubleTap = false) {
    if (!supabase || !userId) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const next = fromDoubleTap ? true : !liked;
    if (fromDoubleTap && liked) return;
    animateBounce(heartScale);
    setLiked(next);
    setLikes((count) => count + (next ? 1 : -1));
    const query = next
      ? supabase.from('post_likes').insert({ post_id: post.id, user_id: userId })
      : supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', userId);
    const { error } = await query;
    if (error) {
      setLiked(!next);
      setLikes((count) => count + (next ? -1 : 1));
      show(error.message, 'error');
    }
  }

  const openPost = useCallback(() => {
    router.push({ pathname: '/post/[id]', params: { id: post.id } });
  }, [post.id]);

  const handleCardPress = useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current < 280) {
      lastTap.current = 0;
      void toggleLike(true);
      return;
    }
    lastTap.current = now;
    setTimeout(() => {
      if (lastTap.current === now) openPost();
    }, 280);
  }, [openPost]);

  async function toggleSave() {
    if (!supabase || !userId) return;
    void Haptics.selectionAsync();
    animateBounce(saveScale);
    const next = !saved;
    setSaved(next);
    const query = next
      ? supabase.from('saved_posts').insert({ post_id: post.id, user_id: userId })
      : supabase.from('saved_posts').delete().eq('post_id', post.id).eq('user_id', userId);
    const { error } = await query;
    if (error) {
      setSaved(!next);
      show(error.message, 'error');
    }
  }

  async function toggleRepost() {
    if (!supabase || !userId) return;
    void Haptics.selectionAsync();
    animateBounce(repostScale);
    setRepostMenu(false);
    const next = !reposted;
    setReposted(next);
    setReposts((count) => count + (next ? 1 : -1));
    const query = next
      ? supabase.from('post_reposts').insert({ post_id: post.id, user_id: userId })
      : supabase.from('post_reposts').delete().eq('post_id', post.id).eq('user_id', userId);
    const { error } = await query;
    if (error) {
      setReposted(!next);
      setReposts((count) => count + (next ? -1 : 1));
      show(error.message, 'error');
    }
  }

  function openQuoteComposer() {
    const targetId = post.id;
    setRepostMenu(false);
    // Wait a tick so the sheet unmount doesn't swallow the route params.
    setTimeout(() => {
      router.push({ pathname: '/post/create', params: { quoteId: targetId } });
    }, 50);
  }

  async function removePost() {
    if (!supabase) return;
    const { error } = await supabase.from('posts').update({ archived_at: new Date().toISOString() }).eq('id', post.id);
    setMenu(false);
    if (error) show(error.message, 'error');
    else {
      show(t('postDeleted'), 'success');
      onChange();
    }
  }

  function openProfile() {
    router.push({ pathname: '/user/[id]', params: { id: post.author_id } });
  }

  return (
    <Pressable
      onPress={handleCardPress}
      style={[styles.card, { borderBottomColor: colors.divider }]}
    >
      {/* Avatar column */}
      <Pressable onPress={openProfile} hitSlop={4} style={styles.avatarCol}>
        <AppAvatar uri={post.profiles?.avatar_url} name={displayName} size={40} />
      </Pressable>

      {/* Content column */}
      <View style={styles.content}>
        {/* Name row */}
        <View style={styles.nameRow}>
          <Pressable onPress={openProfile} style={styles.nameBlock}>
            <Text style={[styles.displayName, { color: colors.text }]} numberOfLines={1}>
              {displayName}
            </Text>
            {post.profiles?.verified ? (
              <Ionicons name="checkmark-circle" size={15} color={colors.primary} style={{ marginLeft: 2 }} />
            ) : null}
            <Text style={[styles.handle, { color: colors.textSecondary }]} numberOfLines={1}>
              @{handle}
            </Text>
            <Text style={[styles.dot, { color: colors.textSecondary }]}>·</Text>
            <Text style={[styles.time, { color: colors.textSecondary }]} numberOfLines={1}>
              {relative(post.created_at, locale, t)}
            </Text>
          </Pressable>
          <Pressable
            accessibilityLabel={t('postMenu')}
            onPress={() => setMenu(true)}
            hitSlop={10}
            style={styles.menuBtn}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.iconMuted} />
          </Pressable>
        </View>

        {post.location_name ? (
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={12} color={colors.iconMuted} />
            <Text style={{ color: colors.textSecondary, fontSize: 12 }} numberOfLines={1}>
              {post.location_name}
            </Text>
          </View>
        ) : null}

        {/* Body */}
        {body ? (
          <Text style={[styles.body, { color: colors.text }]}>
            {expanded || !long ? body : `${body.slice(0, PREVIEW).trim()}…`}
            {long ? (
              <Text
                onPress={() => setExpanded((v) => !v)}
                style={{ color: colors.primary, fontWeight: '600' }}
              >
                {expanded ? ` ${t('showLess')}` : ` ${t('readMore')}`}
              </Text>
            ) : null}
          </Text>
        ) : null}

        {/* Media */}
        {hasMedia ? (
          <View style={[styles.mediaWrap, { borderColor: colors.border }]}>
            <PostMedia media={post.media} variant="tweet" />
          </View>
        ) : null}

        {post.studio_recording_id || post.kind === 'studio' ? (
          post.studio_recording_id ? <StudioFeedPlayer recordingId={post.studio_recording_id} /> : null
        ) : null}

        {post.quoted || post.quoted_post_id ? <QuotedPostEmbed quoted={post.quoted} /> : null}

        {/* Actions — reply · repost · like · share · bookmark */}
        <View style={styles.actions}>
          <Pressable
            onPress={() => router.push({ pathname: '/post/[id]', params: { id: post.id } })}
            style={styles.action}
            hitSlop={6}
          >
            <Ionicons name="chatbubble-outline" size={18} color={colors.iconMuted} />
            {post.comment_count > 0 ? (
              <Text style={[styles.count, { color: colors.textSecondary }]}>{formatCount(post.comment_count)}</Text>
            ) : null}
          </Pressable>

          <Pressable
            onPress={() => {
              void Haptics.selectionAsync();
              setRepostMenu(true);
            }}
            style={styles.action}
            hitSlop={6}
            accessibilityLabel={t('repost')}
          >
            <Animated.View style={{ transform: [{ scale: repostScale }] }}>
              <Ionicons name="repeat" size={20} color={reposted ? '#00BA7C' : colors.iconMuted} />
            </Animated.View>
            {reposts > 0 ? (
              <Text style={[styles.count, { color: reposted ? '#00BA7C' : colors.textSecondary }]}>{formatCount(reposts)}</Text>
            ) : null}
          </Pressable>

          <Pressable onPress={() => void toggleLike()} style={styles.action} hitSlop={6} accessibilityLabel={t('likeAction')}>
            <Animated.View style={{ transform: [{ scale: heartScale }] }}>
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={19} color={liked ? '#F91880' : colors.iconMuted} />
            </Animated.View>
            {likes > 0 ? (
              <Text style={[styles.count, { color: liked ? '#F91880' : colors.textSecondary }]}>{formatCount(likes)}</Text>
            ) : null}
          </Pressable>

          <Pressable
            onPress={() => {
              void sharePost({
                id: post.id,
                body: post.body,
                kind: post.kind,
                media: post.media,
                profiles: post.profiles,
              }).catch((error: Error) => show(error.message, 'error'));
            }}
            style={styles.action}
            hitSlop={6}
            accessibilityLabel={t('share')}
          >
            <Ionicons name="share-outline" size={18} color={colors.iconMuted} />
          </Pressable>

          <View style={{ flex: 1 }} />

          <Pressable onPress={() => void toggleSave()} style={styles.action} hitSlop={6} accessibilityLabel={t('save')}>
            <Animated.View style={{ transform: [{ scale: saveScale }] }}>
              <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={18} color={saved ? colors.primary : colors.iconMuted} />
            </Animated.View>
          </Pressable>
        </View>
      </View>

      <AppBottomSheet visible={repostMenu} title={t('repost')} onClose={() => setRepostMenu(false)}>
        <Pressable style={styles.menuItem} onPress={() => void toggleRepost()}>
          <Ionicons name="repeat" size={18} color={reposted ? colors.error : colors.text} />
          <Text style={[styles.menuLabel, { color: reposted ? colors.error : colors.text }]}>
            {reposted ? t('undoRepost') : t('repost')}
          </Text>
        </Pressable>
        <Pressable style={styles.menuItem} onPress={openQuoteComposer}>
          <Ionicons name="create-outline" size={18} color={colors.text} />
          <Text style={[styles.menuLabel, { color: colors.text }]}>{t('quotePost')}</Text>
        </Pressable>
      </AppBottomSheet>

      <AppBottomSheet visible={menu} title={t('postMenu')} onClose={() => setMenu(false)}>
        {mine ? (
          <>
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                setMenu(false);
                router.push({ pathname: '/post/create', params: { id: post.id } });
              }}
            >
              <Ionicons name="create-outline" size={18} color={colors.text} />
              <Text style={[styles.menuLabel, { color: colors.text }]}>{t('editPost')}</Text>
            </Pressable>
            <Pressable style={styles.menuItem} onPress={() => void removePost()}>
              <Ionicons name="trash-outline" size={18} color={colors.error} />
              <Text style={[styles.menuLabel, { color: colors.error }]}>{t('deletePost')}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                setMenu(false);
                useReportSheetStore.getState().present({
                  targetType: 'post',
                  targetId: post.id,
                  reportedUserId: post.author_id,
                });
              }}
            >
              <Ionicons name="flag-outline" size={18} color={colors.text} />
              <Text style={[styles.menuLabel, { color: colors.text }]}>{t('reportAction')}</Text>
            </Pressable>
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                setMenu(false);
                if (!userId) return;
                void blockUser(post.author_id)
                  .then(() => {
                    show(t('userBlocked'), 'success');
                    invalidateAfterBlockChange(queryClient, userId);
                    onChange();
                  })
                  .catch((error: Error) => show(error.message, 'error'));
              }}
            >
              <Ionicons name="ban-outline" size={18} color={colors.error} />
              <Text style={[styles.menuLabel, { color: colors.error }]}>{t('block')}</Text>
            </Pressable>
          </>
        )}
      </AppBottomSheet>
    </Pressable>
  );
}

export function QuotedPostEmbed({ quoted }: { quoted?: QuotedFeedPost | null }) {
  const { colors } = useTheme();
  const t = useT();
  if (!quoted) {
    return (
      <View style={[styles.quoteCard, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{t('quoteUnavailable')}</Text>
      </View>
    );
  }
  const name = quoted.profiles?.display_name || quoted.profiles?.username || t('userFallback');
  const handle = quoted.profiles?.username ?? t('userFallback');
  const body = quoted.body?.trim() ?? '';
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/post/[id]', params: { id: quoted.id } })}
      style={[styles.quoteCard, { borderColor: colors.border }]}
    >
      <View style={styles.quoteHeader}>
        <AppAvatar uri={quoted.profiles?.avatar_url} name={name} size={22} />
        <Text style={[styles.quoteName, { color: colors.text }]} numberOfLines={1}>
          {name}
        </Text>
        <Text style={[styles.quoteHandle, { color: colors.textSecondary }]} numberOfLines={1}>
          @{handle}
        </Text>
      </View>
      {body ? (
        <Text style={[styles.quoteBody, { color: colors.text }]} numberOfLines={4}>
          {body}
        </Text>
      ) : null}
      {quoted.media.length > 0 ? (
        <View style={[styles.quoteMedia, { borderColor: colors.border }]}>
          <PostMedia media={quoted.media} variant="tweet" />
        </View>
      ) : null}
      {!body && quoted.media.length === 0 ? (
        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{t('quoteUnavailable')}</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  avatarCol: { paddingTop: 2 },
  content: { flex: 1, minWidth: 0, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  nameBlock: { flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0, gap: 4 },
  displayName: { fontSize: 15, fontWeight: '800', letterSpacing: -0.2, maxWidth: '42%' },
  handle: { fontSize: 14, fontWeight: '400', flexShrink: 1 },
  dot: { fontSize: 14 },
  time: { fontSize: 14, fontWeight: '400' },
  menuBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', marginRight: -6 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: -2 },
  body: { fontSize: 15, lineHeight: 21, letterSpacing: -0.1 },
  mediaWrap: {
    marginTop: 8,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  quoteCard: {
    marginTop: 8,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 10,
    gap: 6,
  },
  quoteHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  quoteName: { fontSize: 13, fontWeight: '700', maxWidth: '46%' },
  quoteHandle: { fontSize: 12, flexShrink: 1 },
  quoteBody: { fontSize: 14, lineHeight: 19 },
  quoteMedia: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginLeft: -6,
    paddingBottom: 4,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 34,
    minWidth: 48,
    paddingHorizontal: 6,
  },
  count: { fontSize: 13, fontWeight: '500', fontVariant: ['tabular-nums'] },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  menuLabel: { fontSize: 16, fontWeight: '600' },
});
