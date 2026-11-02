import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/layout/Screen';
import { AppAvatar } from '@/components/ui/AppAvatar';
import { dateLocale, useI18nStore } from '@/i18n';
import { useFeatureT } from '@/i18n/features';
import {
  deleteStory,
  fetchIncomingStoryContacts,
  fetchMyStories,
  respondStoryContact,
  setStoryStatus,
} from '@/services/stories/api';
import { pauseStorySpeech, resumeStorySpeech, useStorySpeech } from '@/services/stories/tts';
import type { StoryIncomingContact, StoryMyItem } from '@/services/stories/types';
import { useToastStore } from '@/stores/toastStore';
import { useTheme } from '@/theme/ThemeProvider';

export default function MyStoriesScreen() {
  const { colors } = useTheme();
  const t = useFeatureT();
  const locale = useI18nStore((state) => state.locale);
  const speech = useStorySpeech();
  const show = useToastStore((state) => state.show);
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const mine = useQuery({
    queryKey: ['stories-mine'],
    staleTime: 30_000,
    queryFn: fetchMyStories,
  });

  const requests = useQuery({
    queryKey: ['story-incoming-contacts'],
    staleTime: 30_000,
    queryFn: fetchIncomingStoryContacts,
  });

  const pendingRequests = useMemo(
    () => (requests.data ?? []).filter((item) => item.status === 'pending'),
    [requests.data],
  );

  async function refresh() {
    await Promise.all([mine.refetch(), requests.refetch()]);
  }

  function invalidateStoryLists() {
    for (const key of ['stories-feed', 'stories-home', 'stories-journey', 'stories-mine']) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
  }

  async function toggleStatus(story: StoryMyItem) {
    if (busy) return;
    const next = story.status === 'published' ? 'draft' : 'published';
    setBusy(story.id);
    try {
      await setStoryStatus(story.id, next);
      await mine.refetch();
      invalidateStoryLists();
      show(next === 'published' ? t('storiesStatusPublished') : t('storiesStatusDraft'), 'success');
    } catch (error) {
      show(error instanceof Error ? error.message : t('storiesSaveFailed'), 'error');
    } finally {
      setBusy(null);
    }
  }

  function confirmDelete(story: StoryMyItem) {
    Alert.alert(t('storiesDelete'), t('storiesDeleteConfirm'), [
      {
        text: t('storiesDelete'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusy(story.id);
            try {
              await deleteStory(story.id);
              queryClient.removeQueries({ queryKey: ['story', story.id] });
              queryClient.removeQueries({ queryKey: ['story-comments', story.id] });
              await mine.refetch();
              invalidateStoryLists();
              show(t('storiesDeleted'), 'success');
            } catch (error) {
              show(error instanceof Error ? error.message : t('storiesSaveFailed'), 'error');
            } finally {
              setBusy(null);
            }
          })();
        },
      },
      { text: 'Vazgeç', style: 'cancel' },
    ]);
  }

  function openStory(story: StoryMyItem) {
    router.push({ pathname: '/stories/[id]', params: { id: story.id } });
  }

  function openCompose(story: StoryMyItem) {
    router.push({ pathname: '/stories/compose', params: { id: story.id } });
  }

  /** Listen from the list: the detail screen owns the text, so it starts the reader there. */
  function toggleListen(story: StoryMyItem) {
    const mine = speech.storyId === story.id;
    if (mine && (speech.status === 'speaking' || speech.status === 'loading')) {
      void pauseStorySpeech();
      return;
    }
    if (mine && speech.status === 'paused') {
      void resumeStorySpeech();
      return;
    }
    router.push({ pathname: '/stories/[id]', params: { id: story.id, listen: '1' } });
  }

  function iconButton(input: {
    key: string;
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    onPress: () => void;
    tone?: 'default' | 'primary' | 'danger';
    disabled?: boolean;
    active?: boolean;
  }) {
    const tone = input.tone ?? 'default';
    const color = tone === 'danger' ? colors.error : tone === 'primary' ? colors.primary : colors.text;
    return (
      <Pressable
        key={input.key}
        accessibilityRole="button"
        accessibilityLabel={input.label}
        accessibilityState={{ disabled: Boolean(input.disabled), selected: Boolean(input.active) }}
        disabled={input.disabled}
        onPress={input.onPress}
        hitSlop={4}
        style={({ pressed }) => [
          styles.iconButton,
          {
            backgroundColor: input.active ? colors.primaryMuted : colors.backgroundSecondary,
            borderColor: input.active ? colors.primary : colors.border,
            opacity: pressed ? 0.78 : 1,
          },
        ]}
      >
        {input.disabled ? (
          <ActivityIndicator color={color} size="small" />
        ) : (
          <Ionicons name={input.icon} size={17} color={color} />
        )}
      </Pressable>
    );
  }

  async function respond(request: StoryIncomingContact, action: 'accept' | 'decline' | 'block') {
    if (busy) return;
    setBusy(request.id);
    try {
      const result = await respondStoryContact(request.id, action);
      await requests.refetch();
      if (action === 'accept' && result.conversation_id) {
        router.push({ pathname: '/chat/[id]', params: { id: result.conversation_id } });
      }
    } catch (error) {
      show(error instanceof Error ? error.message : t('storiesSaveFailed'), 'error');
    } finally {
      setBusy(null);
    }
  }

  const header = (
    <View style={{ gap: 14, paddingTop: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ color: colors.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.4 }}>
            {t('storiesMine')}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t('storiesTagline')}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/stories/compose')}
          style={[styles.writeButton, { backgroundColor: colors.primary }]}
        >
          <Ionicons name="add" size={17} color={colors.onPrimary} />
          <Text style={{ color: colors.onPrimary, fontSize: 12, fontWeight: '800' }}>{t('storiesWrite')}</Text>
        </Pressable>
      </View>

      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: '800' }}>{t('storiesRequests')}</Text>
          {pendingRequests.length ? (
            <View style={[styles.countBadge, { backgroundColor: colors.primaryMuted }]}>
              <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '800' }}>{pendingRequests.length}</Text>
            </View>
          ) : null}
        </View>
        {requests.isLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : pendingRequests.length === 0 ? (
          <View style={[styles.emptyRequests, { backgroundColor: colors.backgroundSecondary }]}>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t('storiesNoRequests')}</Text>
          </View>
        ) : (
          pendingRequests.map((item) => (
            <View
              key={item.id}
              style={[styles.requestCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <AppAvatar uri={item.peer_avatar} name={item.peer_name} size={30} />
                <View style={{ flex: 1, gap: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }} numberOfLines={1}>
                    {item.peer_name}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 11 }} numberOfLines={1}>
                    {item.story_title}
                  </Text>
                </View>
              </View>
              {item.message ? (
                <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18 }}>{item.message}</Text>
              ) : null}
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Pressable
                  accessibilityRole="button"
                  disabled={Boolean(busy)}
                  onPress={() => void respond(item, 'accept')}
                  style={[styles.requestAction, { backgroundColor: colors.primary }]}
                >
                  <Text style={{ color: colors.onPrimary, fontSize: 11, fontWeight: '800' }}>{t('liveDuaAccept')}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={Boolean(busy)}
                  onPress={() => void respond(item, 'decline')}
                  style={[styles.requestAction, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, borderWidth: 1 }]}
                >
                  <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '800' }}>{t('liveDuaDecline')}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={Boolean(busy)}
                  onPress={() => void respond(item, 'block')}
                  style={[styles.requestAction, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, borderWidth: 1 }]}
                >
                  <Text style={{ color: colors.error, fontSize: 11, fontWeight: '800' }}>{t('liveDuaBlock')}</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </View>

      <Text style={{ color: colors.text, fontSize: 15, fontWeight: '800', paddingTop: 2 }}>
        {t('storiesMine')}
      </Text>
    </View>
  );

  return (
    <Screen padded={false} scroll={false}>
      <FlatList
        data={mine.data ?? []}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 10 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={mine.isRefetching || requests.isRefetching}
            onRefresh={() => void refresh()}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          mine.isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ paddingVertical: 30 }} />
          ) : (
            <View style={[styles.empty, { backgroundColor: colors.backgroundSecondary }]}>
              <Ionicons name="create-outline" size={22} color={colors.iconMuted} />
              <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: 'center' }}>{t('storiesNoMine')}</Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const statusLabel =
            item.status === 'published'
              ? t('storiesStatusPublished')
              : item.status === 'draft'
                ? t('storiesStatusDraft')
                : item.status === 'hidden'
                  ? t('storiesStatusHidden')
                  : t('storiesStatusRemoved');
          const statusColor =
            item.status === 'published' ? colors.success : item.status === 'hidden' ? colors.warning : colors.textSecondary;
          const editable = item.status !== 'removed';
          const minePlaying =
            speech.storyId === item.id && (speech.status === 'speaking' || speech.status === 'loading');
          const minePaused = speech.storyId === item.id && speech.status === 'paused';
          const updated = new Date(item.updated_at).toLocaleDateString(dateLocale(locale), {
            day: 'numeric',
            month: 'short',
          });
          return (
            <View style={[styles.storyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Pressable accessibilityRole="button" onPress={() => openStory(item)} style={styles.cardRow}>
                {item.cover_url ? (
                  <Image source={{ uri: item.cover_url }} style={styles.thumb} contentFit="cover" transition={150} />
                ) : (
                  <LinearGradient
                    colors={[colors.primaryMuted, colors.backgroundSecondary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.thumb}
                  >
                    <Ionicons name="book-outline" size={20} color={colors.primary} />
                  </LinearGradient>
                )}

                <View style={styles.cardCopy}>
                  <View style={styles.chipRow}>
                    <View style={[styles.statusChip, { backgroundColor: colors.backgroundSecondary }]}>
                      <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                      <Text style={{ color: colors.text, fontSize: 10, fontWeight: '800' }}>{statusLabel}</Text>
                    </View>
                    {item.pseudonymous ? (
                      <View style={[styles.statusChip, { backgroundColor: colors.backgroundSecondary }]}>
                        <Ionicons name="eye-off-outline" size={10} color={colors.textSecondary} />
                      </View>
                    ) : null}
                    {item.linked_label ? (
                      <View style={[styles.statusChip, { backgroundColor: colors.primaryMuted }]}>
                        <Ionicons
                          name={item.linked_kind === 'quran' ? 'book-outline' : 'sparkles-outline'}
                          size={10}
                          color={colors.primary}
                        />
                        <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '800' }} numberOfLines={1}>
                          {item.linked_label}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800', letterSpacing: -0.2 }} numberOfLines={2}>
                    {item.title}
                  </Text>

                  {item.status === 'hidden' && item.hidden_reason ? (
                    <Text style={{ color: colors.warning, fontSize: 11, lineHeight: 16 }} numberOfLines={2}>
                      {item.hidden_reason}
                    </Text>
                  ) : null}

                  <View style={styles.metaRow}>
                    <View style={styles.metaItem}>
                      <Ionicons name="chatbubble-outline" size={11.5} color={colors.iconMuted} />
                      <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{item.comment_count}</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Ionicons name="heart-outline" size={11.5} color={colors.iconMuted} />
                      <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{item.support_count}</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Ionicons name="time-outline" size={11.5} color={colors.iconMuted} />
                      <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                        {item.reading_minutes} {t('storiesRead')}
                      </Text>
                    </View>
                  </View>
                </View>
              </Pressable>

              <View style={[styles.actions, { borderTopColor: colors.divider }]}>
                {iconButton({
                  key: 'listen',
                  icon: minePlaying ? 'pause' : minePaused ? 'play' : 'volume-medium-outline',
                  label: minePlaying ? t('storiesPause') : minePaused ? t('storiesResume') : t('storiesListen'),
                  onPress: () => toggleListen(item),
                  tone: 'primary',
                  active: minePlaying || minePaused,
                })}
                {editable
                  ? iconButton({
                      key: 'edit',
                      icon: 'create-outline',
                      label: t('storiesEdit'),
                      onPress: () => openCompose(item),
                    })
                  : null}
                {editable && (item.status === 'published' || item.status === 'draft')
                  ? iconButton({
                      key: 'status',
                      icon: item.status === 'published' ? 'eye-off-outline' : 'send-outline',
                      label: item.status === 'published' ? t('storiesStatusDraft') : t('storiesPublish'),
                      onPress: () => void toggleStatus(item),
                      disabled: busy === item.id,
                    })
                  : null}
                {editable
                  ? iconButton({
                      key: 'delete',
                      icon: 'trash-outline',
                      label: t('storiesDelete'),
                      onPress: () => confirmDelete(item),
                      tone: 'danger',
                      disabled: busy === item.id,
                    })
                  : null}
                <Text style={{ color: colors.textSecondary, fontSize: 10.5, marginStart: 'auto' }}>{updated}</Text>
              </View>
            </View>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  writeButton: {
    minHeight: 38,
    borderRadius: 11,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  countBadge: { minWidth: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  emptyRequests: { borderRadius: 12, padding: 16, alignItems: 'center' },
  requestCard: { borderRadius: 14, borderWidth: 1, padding: 11, gap: 8 },
  requestAction: { flex: 1, minHeight: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  empty: { marginTop: 4, padding: 22, borderRadius: 16, alignItems: 'center', gap: 8 },
  storyCard: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 12 },
  thumb: {
    width: 76,
    height: 92,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cardCopy: { flex: 1, gap: 6, paddingTop: 1 },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  statusChip: {
    minHeight: 21,
    borderRadius: 999,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
