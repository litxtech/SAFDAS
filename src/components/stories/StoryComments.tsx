import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { AppAvatar } from '@/components/ui/AppAvatar';
import { AppBottomSheet } from '@/components/ui/AppBottomSheet';
import { dateLocale, useI18nStore, useT, type Locale } from '@/i18n';
import { useFeatureT } from '@/i18n/features';
import {
  addStoryComment,
  deleteStoryComment,
  fetchStoryComments,
  reportStoryComment,
} from '@/services/stories/api';
import type { StoryComment } from '@/services/stories/types';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { useTheme } from '@/theme/ThemeProvider';

const PAGE_SIZE = 30;

type Props = {
  storyId: string;
  /** Comments can be read (the story is published). */
  enabled: boolean;
  /** The author allowed new comments. */
  canWrite: boolean;
  commentCount: number;
};

function relative(iso: string, locale: Locale, t: ReturnType<typeof useT>) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return t('justNow');
  if (minutes < 60) return t('minutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('hoursAgo', { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t('daysAgo', { count: days });
  return new Date(iso).toLocaleDateString(dateLocale(locale));
}

/**
 * Story comments.
 *
 * Uses the same interaction language as the rest of the app: card rows with
 * avatar + name, relative time, reply, long-press actions and a composer with
 * the signed-in avatar. Threading is one level deep (root + replies), matching
 * the post comment screen.
 */
export function StoryComments({ storyId, enabled, canWrite, commentCount }: Props) {
  const { colors } = useTheme();
  const t = useFeatureT();
  const tc = useT();
  const locale = useI18nStore((state) => state.locale);
  const show = useToastStore((state) => state.show);
  const queryClient = useQueryClient();
  const me = useAuthStore((state) => state.profile);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<StoryComment | null>(null);
  const [sending, setSending] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [menuFor, setMenuFor] = useState<StoryComment | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [count, setCount] = useState(commentCount);

  useEffect(() => {
    setCount(commentCount);
  }, [commentCount]);

  const query = useInfiniteQuery({
    queryKey: ['story-comments', storyId],
    enabled,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => fetchStoryComments(storyId, pageParam, PAGE_SIZE),
    getNextPageParam: (last) => (last.length >= PAGE_SIZE ? last[last.length - 1]?.created_at ?? null : null),
    staleTime: 30_000,
  });

  const rows = useMemo(() => {
    const seen = new Set<string>();
    const list: StoryComment[] = [];
    for (const page of query.data?.pages ?? []) {
      for (const row of page) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        list.push(row);
      }
    }
    return list.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }, [query.data]);

  const roots = useMemo(
    () => rows.filter((row) => !row.parent_id || !rows.some((item) => item.id === row.parent_id)),
    [rows],
  );

  const refreshStory = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['story', storyId] }),
      queryClient.invalidateQueries({ queryKey: ['stories-feed'] }),
      queryClient.invalidateQueries({ queryKey: ['stories-home'] }),
      queryClient.invalidateQueries({ queryKey: ['stories-mine'] }),
    ]);
  }, [queryClient, storyId]);

  function startReply(item: StoryComment) {
    setMenuFor(null);
    setReplyTo(item);
  }

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const result = await addStoryComment(storyId, body, replyTo?.id ?? null);
      if (replyTo) {
        const rootId = replyTo.parent_id ?? replyTo.id;
        setExpanded((current) => ({ ...current, [rootId]: true }));
      }
      setDraft('');
      setReplyTo(null);
      setCount(result.comment_count);
      await query.refetch();
      await refreshStory();
    } catch (error) {
      show(error instanceof Error ? error.message : t('storiesCommentFailed'), 'error');
    } finally {
      setSending(false);
    }
  }

  function askDelete(item: StoryComment) {
    setMenuFor(null);
    Alert.alert(t('storiesDelete'), t('storiesCommentDeleteConfirm'), [
      {
        text: t('storiesDelete'),
        style: 'destructive',
        onPress: () => {
          setDeletingId(item.id);
          void deleteStoryComment(item.id)
            .then(async () => {
              setCount((current) => Math.max(0, current - 1));
              await query.refetch();
              await refreshStory();
              show(t('storiesCommentDeleted'), 'success');
            })
            .catch((error: unknown) =>
              show(error instanceof Error ? error.message : t('storiesCommentFailed'), 'error'),
            )
            .finally(() => setDeletingId(null));
        },
      },
      { text: t('storiesCancel'), style: 'cancel' },
    ]);
  }

  function askReport(item: StoryComment) {
    setMenuFor(null);
    const sendReport = (reason: string) => {
      setReportingId(item.id);
      void reportStoryComment(item.id, reason)
        .then(() => show(t('storiesReportSent'), 'success'))
        .catch((error: unknown) =>
          show(error instanceof Error ? error.message : t('storiesSaveFailed'), 'error'),
        )
        .finally(() => setReportingId(null));
    };
    Alert.alert(t('storiesReport'), item.body.slice(0, 120), [
      { text: t('storiesReportHarassment'), onPress: () => sendReport('harassment') },
      { text: t('storiesReportSpam'), onPress: () => sendReport('spam') },
      { text: t('storiesReportOther'), onPress: () => sendReport('other') },
      { text: t('storiesCancel'), style: 'cancel' },
    ]);
  }

  function renderComment(item: StoryComment, nested = false) {
    const replies = rows.filter((row) => row.parent_id === item.id);
    const open = expanded[item.id];
    const busy = deletingId === item.id || reportingId === item.id;
    return (
      <View key={item.id} style={{ gap: 8 }}>
        <Pressable
          accessibilityRole="button"
          onLongPress={() => setMenuFor(item)}
          delayLongPress={320}
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              marginStart: nested ? 26 : 0,
            },
          ]}
        >
          <View style={styles.cardHead}>
            <AppAvatar uri={item.author_avatar} name={item.author_name} size={nested ? 28 : 34} />
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                {item.author_name}
              </Text>
              <Text style={[styles.time, { color: colors.textSecondary }]}>
                {relative(item.created_at, locale, tc)}
              </Text>
            </View>
            {busy ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={tc('moreActions')}
                hitSlop={8}
                onPress={() => setMenuFor(item)}
                style={styles.moreButton}
              >
                <Ionicons name="ellipsis-horizontal" size={16} color={colors.textSecondary} />
              </Pressable>
            )}
          </View>

          <Text style={[styles.body, { color: colors.text }]}>{item.body}</Text>

          <View style={styles.cardActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => startReply(item)}
              hitSlop={6}
              style={styles.action}
            >
              <Ionicons name="arrow-undo-outline" size={13} color={colors.textSecondary} />
              <Text style={[styles.actionText, { color: colors.textSecondary }]}>{tc('reply')}</Text>
            </Pressable>
            {item.own ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => askDelete(item)}
                hitSlop={6}
                style={styles.action}
              >
                <Ionicons name="trash-outline" size={13} color={colors.error} />
                <Text style={[styles.actionText, { color: colors.error }]}>{t('storiesDelete')}</Text>
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={() => askReport(item)}
                hitSlop={6}
                style={styles.action}
              >
                <Ionicons name="flag-outline" size={13} color={colors.textSecondary} />
                <Text style={[styles.actionText, { color: colors.textSecondary }]}>{t('storiesReport')}</Text>
              </Pressable>
            )}
          </View>
        </Pressable>

        {replies.length ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setExpanded((current) => ({ ...current, [item.id]: !current[item.id] }))}
            style={[styles.repliesToggle, { marginStart: nested ? 26 : 0 }]}
          >
            <View style={[styles.replyLine, { backgroundColor: colors.border }]} />
            <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700' }}>
              {open ? tc('hideReplies') : tc('viewReplies', { count: replies.length })}
            </Text>
          </Pressable>
        ) : null}

        {open ? replies.map((reply) => renderComment(reply, true)) : null}
      </View>
    );
  }

  return (
    <View style={{ gap: 12, marginTop: 4 }}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>{t('storiesComments')}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 11.5 }}>
            {canWrite ? t('storiesCommentsHint') : t('storiesCommentsClosed')}
          </Text>
        </View>
        <View style={[styles.countPill, { backgroundColor: colors.primaryMuted }]}>
          <Ionicons name="chatbubble-ellipses-outline" size={12} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '800' }}>{count}</Text>
        </View>
      </View>

      {rows.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.surface }]}>
            <Ionicons name="chatbubbles-outline" size={18} color={colors.iconMuted} />
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 12.5, textAlign: 'center' }}>
            {canWrite ? t('storiesNoComments') : t('storiesCommentsClosed')}
          </Text>
        </View>
      ) : (
        <View style={{ gap: 8 }}>{roots.map((item) => renderComment(item))}</View>
      )}

      {query.hasNextPage ? (
        <Pressable
          accessibilityRole="button"
          disabled={query.isFetchingNextPage}
          onPress={() => void query.fetchNextPage()}
          style={[styles.loadMore, { borderColor: colors.border }]}
        >
          {query.isFetchingNextPage ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '800' }}>
              {t('liveDuaLoadOlder')}
            </Text>
          )}
        </Pressable>
      ) : null}

      {canWrite ? (
        <View style={[styles.composer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {replyTo ? (
            <View style={styles.replying}>
              <Ionicons name="arrow-undo-outline" size={12} color={colors.primary} />
              <Text style={{ color: colors.textSecondary, fontSize: 11.5, flex: 1 }} numberOfLines={1}>
                {tc('replyingTo', { name: replyTo.author_name })}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('storiesCancel')}
                hitSlop={8}
                onPress={() => setReplyTo(null)}
              >
                <Ionicons name="close" size={15} color={colors.iconMuted} />
              </Pressable>
            </View>
          ) : null}
          <View style={styles.composerRow}>
            <AppAvatar uri={me?.avatar_url ?? null} name={me?.display_name || me?.username || ''} size={32} />
            <View style={[styles.inputShell, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder={replyTo ? tc('replyingTo', { name: replyTo.author_name }) : t('storiesCommentPlaceholder')}
                placeholderTextColor={colors.textSecondary}
                multiline
                maxLength={1200}
                style={[styles.input, { color: colors.text }]}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={tc('send')}
                disabled={sending || !draft.trim()}
                onPress={() => void send()}
                style={[
                  styles.sendButton,
                  { backgroundColor: draft.trim() ? colors.primary : colors.backgroundSecondary },
                ]}
              >
                {sending ? (
                  <ActivityIndicator color={colors.onPrimary} size="small" />
                ) : (
                  <Ionicons
                    name="arrow-up"
                    size={16}
                    color={draft.trim() ? colors.onPrimary : colors.iconMuted}
                  />
                )}
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      <AppBottomSheet visible={Boolean(menuFor)} title={tc('moreActions')} onClose={() => setMenuFor(null)}>
        {menuFor ? (
          <View style={{ gap: 2 }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => startReply(menuFor)}
              style={[styles.menuRow, { borderColor: colors.divider }]}
            >
              <Ionicons name="arrow-undo-outline" size={18} color={colors.text} />
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>{tc('reply')}</Text>
            </Pressable>
            {menuFor.own ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => askDelete(menuFor)}
                style={[styles.menuRow, { borderColor: colors.divider }]}
              >
                <Ionicons name="trash-outline" size={18} color={colors.error} />
                <Text style={{ color: colors.error, fontSize: 15, fontWeight: '600' }}>{t('storiesDelete')}</Text>
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={() => askReport(menuFor)}
                style={[styles.menuRow, { borderColor: colors.divider }]}
              >
                <Ionicons name="flag-outline" size={18} color={colors.error} />
                <Text style={{ color: colors.error, fontSize: 15, fontWeight: '600' }}>{t('storiesReport')}</Text>
              </Pressable>
            )}
          </View>
        ) : null}
      </AppBottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  countPill: {
    minHeight: 26,
    borderRadius: 999,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  empty: { borderRadius: 16, borderWidth: 1, padding: 20, alignItems: 'center', gap: 8 },
  emptyIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 16, borderWidth: 1, padding: 12, gap: 8 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  name: { fontSize: 12.5, fontWeight: '700' },
  time: { fontSize: 10.5, fontWeight: '500' },
  moreButton: { width: 28, minHeight: 28, alignItems: 'flex-end', justifyContent: 'center' },
  body: { fontSize: 13.5, lineHeight: 20 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 24 },
  actionText: { fontSize: 11.5, fontWeight: '700' },
  repliesToggle: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 26 },
  replyLine: { width: 24, height: StyleSheet.hairlineWidth },
  loadMore: {
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composer: { borderRadius: 18, borderWidth: 1, padding: 10, gap: 8 },
  replying: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 2 },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  inputShell: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  input: { flex: 1, fontSize: 13.5, lineHeight: 19, maxHeight: 100, paddingTop: 6, paddingBottom: 6 },
  sendButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
