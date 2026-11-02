import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AppAvatar } from '@/components/ui/AppAvatar';
import { AppBottomSheet } from '@/components/ui/AppBottomSheet';
import { StoryComments } from '@/components/stories/StoryComments';
import { Screen } from '@/components/layout/Screen';
import { useFeatureT } from '@/i18n/features';
import { dateLocale, useI18nStore, useT } from '@/i18n';
import { useToastStore } from '@/stores/toastStore';
import { useTheme } from '@/theme/ThemeProvider';
import { pausePlayback, useAudioEngine } from '@/services/audio/engine';
import { adoptLinkedReciter, playWorshipContent } from '@/services/liveDua/openContent';
import {
  deleteStory,
  fetchOutgoingStoryContacts,
  fetchStoryDetail,
  reportStory,
  requestStoryContact,
  storyCategoryName,
  supportStory,
  toggleStoryBookmark,
} from '@/services/stories/api';
import {
  isStorySpeechAvailable,
  isStorySpeechFemaleAvailable,
  pauseStorySpeech,
  resumeStorySpeech,
  setStorySpeechRate,
  setStorySpeechVoice,
  SPEECH_RATES,
  startStorySpeech,
  stopStorySpeech,
  useStorySpeech,
} from '@/services/stories/tts';

function storyExcerpt(body: string) {
  return body.replace(/\s+/g, ' ').trim().slice(0, 160);
}

export default function StoryDetailScreen() {
  const { colors } = useTheme();
  const t = useFeatureT();
  const tc = useT();
  const locale = useI18nStore((state) => state.locale);
  const show = useToastStore((state) => state.show);
  const queryClient = useQueryClient();
  const { id, listen: listenParam } = useLocalSearchParams<{ id: string; listen?: string }>();
  const storyId = typeof id === 'string' ? id : '';
  const autoListen = listenParam === '1';
  const [fontSize, setFontSize] = useState(17);
  const [contactOpen, setContactOpen] = useState(false);
  const [contactMessage, setContactMessage] = useState('');
  const [sendingContact, setSendingContact] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [supportState, setSupportState] = useState<{ supported: boolean; support_count: number } | null>(null);
  const [supportPending, setSupportPending] = useState(false);
  const [savedState, setSavedState] = useState<{ saved: boolean; bookmark_count: number } | null>(null);
  const [busyLinked, setBusyLinked] = useState(false);
  const [ownerMenuOpen, setOwnerMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const speech = useStorySpeech();
  const audioPlaying = useAudioEngine((state) => state.playing);

  const detail = useQuery({
    queryKey: ['story', storyId],
    enabled: Boolean(storyId),
    staleTime: 60_000,
    queryFn: () => fetchStoryDetail(storyId),
  });

  const outgoing = useQuery({
    queryKey: ['story-outgoing-contacts', storyId],
    enabled: Boolean(storyId) && Boolean(detail.data) && !detail.data?.own,
    staleTime: 30_000,
    queryFn: fetchOutgoingStoryContacts,
  });

  useEffect(() => {
    if (!contactOpen) setContactMessage(t('storiesContactDefault'));
  }, [contactOpen, t]);

  useEffect(() => {
    if (!detail.data) return;
    setSupportState({ supported: detail.data.supported, support_count: detail.data.support_count });
    setSavedState({ saved: detail.data.saved, bookmark_count: detail.data.bookmark_count });
  }, [detail.data]);

  useEffect(() => {
    return () => {
      void stopStorySpeech();
    };
  }, [storyId]);

  // Ses üretilemezse kullanıcıyı sessiz bırakma.
  const lastSpeechError = useRef<string | null>(null);
  useEffect(() => {
    if (speech.status !== 'error') {
      lastSpeechError.current = null;
      return;
    }
    if (lastSpeechError.current === speech.error) return;
    lastSpeechError.current = speech.error;
    show(t('storiesSpeechUnavailable'), 'error');
  }, [speech.status, speech.error, show, t]);

  // Cihaz TTS'i bu derlemede yoksa "Cihaz" sesi seçeneğini gizle; kullanıcı
  // çalışmayan bir seçeneğe dokunup hata görmesin.
  const deviceSpeechReady = useMemo(() => isStorySpeechAvailable(), []);
  // Cihaz sesi yokken arayüz kadın sesini seçili gösterir (otomatik geri düşüş).
  const effectiveVoice = speech.voice === 'female' || !deviceSpeechReady ? 'female' : 'device';

  async function listen(story = detail.data) {
    if (!story) return;
    const femaleReady = isStorySpeechFemaleAvailable();
    const deviceReady = isStorySpeechAvailable();
    if (!femaleReady && !deviceReady) {
      show(t('storiesSpeechUnavailable'), 'error');
      return;
    }
    if (audioPlaying) pausePlayback();
    const mine = speech.storyId === story.id;
    if (mine && (speech.status === 'speaking' || speech.status === 'loading')) {
      await pauseStorySpeech();
      return;
    }
    if (mine && speech.status === 'paused') {
      await resumeStorySpeech();
      return;
    }
    await startStorySpeech({ storyId: story.id, text: story.body, rate: speech.rate });
  }

  // Opened from a card's listen button: start reading as soon as the body arrives.
  const autoListenRef = useRef(false);
  useEffect(() => {
    if (!autoListen || autoListenRef.current) return;
    const story = detail.data;
    if (!story?.body) return;
    autoListenRef.current = true;
    void listen(story);
  }, [autoListen, detail.data]);

  function chooseVoice(voice: 'female' | 'device') {
    if (voice === 'female' && speech.voice !== 'female') {
      Alert.alert(t('storiesVoiceExternalTitle'), t('storiesVoiceExternalBody'), [
        { text: 'Vazgeç', style: 'cancel' },
        { text: t('storiesContinue'), onPress: () => void setStorySpeechVoice('female') },
      ]);
      return;
    }
    void setStorySpeechVoice(voice);
  }

  async function onSupport() {
    if (!detail.data || supportPending) return;
    const current = supportState ?? { supported: detail.data.supported, support_count: detail.data.support_count };
    if (current.supported) return;
    setSupportPending(true);
    setSupportState({ supported: true, support_count: current.support_count + 1 });
    try {
      const result = await supportStory(detail.data.id);
      setSupportState(result);
    } catch (error) {
      setSupportState(current);
      show(error instanceof Error ? error.message : t('storiesSaveFailed'), 'error');
    } finally {
      setSupportPending(false);
    }
  }

  async function onBookmark() {
    if (!detail.data) return;
    const current = savedState ?? { saved: detail.data.saved, bookmark_count: detail.data.bookmark_count };
    setSavedState({ saved: !current.saved, bookmark_count: Math.max(0, current.bookmark_count + (current.saved ? -1 : 1)) });
    try {
      const result = await toggleStoryBookmark(detail.data.id, !current.saved);
      setSavedState(result);
    } catch (error) {
      setSavedState(current);
      show(error instanceof Error ? error.message : t('storiesSaveFailed'), 'error');
    }
  }

  async function onShare() {
    if (!detail.data) return;
    try {
      await Share.share({ message: `${detail.data.title}\n\n${storyExcerpt(detail.data.body)}` });
    } catch {
      /* share cancelled */
    }
  }

  function onReport() {
    if (!detail.data) return;
    setReportOpen(true);
  }

  async function submitReport(reason: string) {
    if (!detail.data || reporting) return;
    setReporting(true);
    try {
      await reportStory(detail.data.id, reason);
      setReportOpen(false);
      show(t('storiesReportSent'), 'success');
    } catch (error) {
      show(error instanceof Error ? error.message : t('storiesSaveFailed'), 'error');
    } finally {
      setReporting(false);
    }
  }

  function confirmDeleteStory() {
    const story = detail.data;
    if (!story || deleting) return;
    setOwnerMenuOpen(false);
    Alert.alert(t('storiesDelete'), t('storiesDeleteConfirm'), [
      {
        text: t('storiesDelete'),
        style: 'destructive',
        onPress: () => {
          setDeleting(true);
          void deleteStory(story.id)
            .then(async () => {
              queryClient.removeQueries({ queryKey: ['story', story.id] });
              await Promise.all(
                ['stories-feed', 'stories-home', 'stories-journey', 'stories-mine'].map((key) =>
                  queryClient.invalidateQueries({ queryKey: [key] }),
                ),
              );
              show(t('storiesDeleted'), 'success');
              router.replace('/stories/my');
            })
            .catch((error: unknown) =>
              show(error instanceof Error ? error.message : t('storiesSaveFailed'), 'error'),
            )
            .finally(() => setDeleting(false));
        },
      },
      { text: t('storiesCancel'), style: 'cancel' },
    ]);
  }

  async function onContact() {
    if (!detail.data || sendingContact) return;
    setSendingContact(true);
    try {
      await requestStoryContact(detail.data.id, contactMessage);
      setContactOpen(false);
      show(t('storiesContactSent'), 'success');
      await outgoing.refetch();
    } catch (error) {
      show(error instanceof Error ? error.message : t('storiesSaveFailed'), 'error');
    } finally {
      setSendingContact(false);
    }
  }

  async function onLinked() {
    if (!detail.data?.linked || busyLinked) return;
    setBusyLinked(true);
    try {
      adoptLinkedReciter(detail.data.linked.reciter_id);
      await stopStorySpeech();
      await playWorshipContent(detail.data.linked.key, { force: true });
    } catch (error) {
      show(error instanceof Error ? error.message : t('liveDuaLoadFailed'), 'error');
    } finally {
      setBusyLinked(false);
    }
  }

  if (detail.isLoading) {
    return (
      <Screen back>
        <View style={{ paddingTop: 60, alignItems: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (detail.isError || !detail.data) {
    return (
      <Screen back>
        <View style={{ paddingTop: 48, alignItems: 'center', gap: 12 }}>
          <Ionicons name="book-outline" size={28} color={colors.iconMuted} />
          <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>{t('storiesNotFound')}</Text>
          <Pressable accessibilityRole="button" onPress={() => void detail.refetch()}>
            <Text style={{ color: colors.primary, fontWeight: '800' }}>{t('storiesLoadMore')}</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const d = detail.data;
  const category = storyCategoryName(d.category_names, locale);
  const support = supportState ?? { supported: d.supported, support_count: d.support_count };
  const saved = savedState ?? { saved: d.saved, bookmark_count: d.bookmark_count };
  const pendingContact = outgoing.data?.some((request) => request.story_id === d.id && request.status === 'pending');
  const canContact = !d.own && d.contact_enabled && !d.pseudonymous;
  const mySpeech = speech.storyId === d.id;
  const speaking = mySpeech && (speech.status === 'speaking' || speech.status === 'loading');
  const paused = mySpeech && speech.status === 'paused';
  const paragraphs = d.body.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);

  return (
    <Screen scroll back>
      <View style={{ gap: 8, paddingTop: 4 }}>
        {category ? (
          <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '800', letterSpacing: 0.3 }}>{category}</Text>
        ) : null}
        <Text style={{ color: colors.text, fontSize: 27, lineHeight: 36, fontWeight: '800', letterSpacing: -0.5 }}>
          {d.title}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
          {d.pseudonymous ? (
            <View style={[styles.aliasAvatar, { backgroundColor: colors.primaryMuted }]}>
              <Ionicons name="eye-off-outline" size={17} color={colors.primary} />
            </View>
          ) : (
            <AppAvatar uri={d.author_avatar} name={d.author_name} size={34} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }} numberOfLines={1}>
              {d.author_name}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
              {d.reading_minutes} {t('storiesRead')}
              {d.published_at
                ? ` · ${new Date(d.published_at).toLocaleDateString(dateLocale(locale))}`
                : ''}
            </Text>
          </View>
          {d.pseudonymous ? (
            <View style={[styles.badge, { backgroundColor: colors.backgroundSecondary }]}>
              <Text style={{ color: colors.textSecondary, fontSize: 10, fontWeight: '800' }}>
                {t('storiesPseudonymousShare')}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={[styles.listenCard, { backgroundColor: colors.primaryMuted, borderColor: colors.primary }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={speaking ? t('storiesPause') : paused ? t('storiesResume') : t('storiesListen')}
          onPress={() => void listen()}
          style={({ pressed }) => [styles.listenRow, pressed && { opacity: 0.9 }]}
        >
          <View style={[styles.listenPlay, { backgroundColor: colors.primary }]}>
            <Ionicons name={speaking ? 'pause' : 'play'} size={20} color={colors.onPrimary} />
          </View>
          <View style={{ flex: 1, gap: 1 }}>
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '800' }}>
              {speaking ? t('storiesPause') : paused ? t('storiesResume') : t('storiesListen')}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 11 }} numberOfLines={1}>
              {mySpeech && speech.chunkCount > 1
                ? `${Math.min(speech.chunkIndex + 1, speech.chunkCount)}/${speech.chunkCount}`
                : `${d.reading_minutes} ${t('storiesRead')}`}
              {' · '}
              {effectiveVoice === 'female' ? t('storiesVoiceFemale') : t('storiesVoiceDevice')}
            </Text>
          </View>
          {mySpeech && speech.status !== 'idle' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('storiesStop')}
              onPress={() => void stopStorySpeech()}
              style={[styles.listenStop, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Ionicons name="stop" size={15} color={colors.textSecondary} />
            </Pressable>
          ) : (
            <Ionicons name="volume-high-outline" size={17} color={colors.primary} />
          )}
        </Pressable>

        {mySpeech && speech.chunkCount > 0 ? (
          <View style={[styles.listenTrack, { backgroundColor: colors.divider }]}>
            <View
              style={[
                styles.listenFill,
                {
                  width: `${Math.min(100, ((speech.chunkIndex + 1) / Math.max(1, speech.chunkCount)) * 100)}%`,
                  backgroundColor: colors.primary,
                },
              ]}
            />
          </View>
        ) : null}

        {mySpeech && speech.status !== 'idle' ? (
          <>
            <View style={styles.settingsRow}>
              <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{t('storiesSpeechRate')}</Text>
              {SPEECH_RATES.map((rate) => {
                const active = Math.abs(speech.rate - rate) < 0.01;
                return (
                  <Pressable
                    key={rate}
                    accessibilityRole="button"
                    onPress={() => void setStorySpeechRate(rate)}
                    style={[
                      styles.rate,
                      {
                        backgroundColor: active ? colors.primary : 'transparent',
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={{ color: active ? colors.onPrimary : colors.textSecondary, fontSize: 11, fontWeight: '800' }}
                    >
                      {rate.toFixed(2)}×
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={[styles.settingsRow, { flexWrap: 'wrap' }]}>
              <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{t('storiesVoiceLabel')}</Text>
              {(
                [
                  ['female', t('storiesVoiceFemale')],
                  ...(deviceSpeechReady ? [['device', t('storiesVoiceDevice')] as const] : []),
                ] as readonly (readonly ['female' | 'device', string])[]
              ).map(([voice, label]) => {
                const active = effectiveVoice === voice;
                return (
                  <Pressable
                    key={voice}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => chooseVoice(voice)}
                    style={[
                      styles.rate,
                      {
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 3,
                        backgroundColor: active ? colors.primary : 'transparent',
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    {voice === 'female' ? (
                      <Ionicons name="female" size={10} color={active ? colors.onPrimary : colors.textSecondary} />
                    ) : null}
                    <Text
                      style={{ color: active ? colors.onPrimary : colors.textSecondary, fontSize: 11, fontWeight: '800' }}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}
      </View>

      {d.cover_url ? (
        <View style={[styles.coverWrap, { backgroundColor: colors.backgroundSecondary }]}>
          <Image source={{ uri: d.cover_url }} style={styles.coverImage} contentFit="cover" transition={160} />
        </View>
      ) : null}

      {d.status !== 'published' ? (
        <View style={[styles.notice, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
          <Ionicons name="lock-closed-outline" size={15} color={colors.primary} />
          <Text style={{ color: colors.textSecondary, fontSize: 12, flex: 1 }}>
            {d.status === 'draft'
              ? t('storiesStatusDraft')
              : d.status === 'hidden'
                ? t('storiesStatusHidden')
                : t('storiesStatusRemoved')}
          </Text>
          {d.own ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/stories/compose', params: { id: d.id } })}
            >
              <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '800' }}>{t('storiesEdit')}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={[styles.reader, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.readerBar}>
          <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '700' }}>Aa</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="A-"
              onPress={() => setFontSize((value) => Math.max(15, value - 1))}
              style={[styles.smallButton, { borderColor: colors.border }]}
            >
              <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '800' }}>A-</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="A+"
              onPress={() => setFontSize((value) => Math.min(23, value + 1))}
              style={[styles.smallButton, { borderColor: colors.border }]}
            >
              <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '800' }}>A+</Text>
            </Pressable>
          </View>
        </View>
        {paragraphs.map((paragraph, index) => (
          <Text
            key={`${index}-${paragraph.slice(0, 8)}`}
            style={{
              color: colors.text,
              fontSize,
              lineHeight: Math.round(fontSize * 1.78),
              marginBottom: 14,
            }}
          >
            {paragraph}
          </Text>
        ))}
      </View>

      {d.linked ? (
        <View style={[styles.linked, { backgroundColor: colors.primaryMuted, borderColor: colors.border }]}>
          <View style={[styles.linkedIcon, { backgroundColor: colors.surface }]}>
            <Ionicons
              name={d.linked.kind === 'quran' ? 'book-outline' : 'sparkles-outline'}
              size={18}
              color={colors.primary}
            />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{t('storiesLink')}</Text>
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '800' }} numberOfLines={1}>
              {d.linked.label ?? d.linked.key}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={busyLinked}
            onPress={() => void onLinked()}
            style={[styles.linkedButton, { backgroundColor: colors.primary }]}
          >
            {busyLinked ? (
              <ActivityIndicator color={colors.onPrimary} size="small" />
            ) : (
              <Text style={{ color: colors.onPrimary, fontSize: 12, fontWeight: '800' }}>
                {t('storiesLinkedListen')}
              </Text>
            )}
          </Pressable>
        </View>
      ) : null}

      {d.support_enabled && !d.own ? (
        <Pressable
          accessibilityRole="button"
          disabled={support.supported}
          onPress={() => void onSupport()}
          style={[
            styles.supportButton,
            {
              backgroundColor: support.supported ? colors.primaryMuted : colors.primary,
              borderColor: support.supported ? colors.primary : colors.primary,
            },
          ]}
        >
          <Ionicons
            name={support.supported ? 'heart' : 'heart-outline'}
            size={18}
            color={support.supported ? colors.primary : colors.onPrimary}
          />
          <Text
            style={{
              color: support.supported ? colors.primary : colors.onPrimary,
              fontSize: 14,
              fontWeight: '800',
            }}
          >
            {support.supported ? t('storiesSupported') : t('storiesSupport')}
          </Text>
          {support.support_count > 0 ? (
            <Text style={{ color: support.supported ? colors.primary : colors.onPrimary, fontSize: 12 }}>
              {t('storiesSupportCount', { count: support.support_count })}
            </Text>
          ) : null}
        </Pressable>
      ) : null}

      <View style={styles.actionRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: saved.saved }}
          onPress={() => void onBookmark()}
          style={({ pressed }) => [styles.iconActionCol, pressed && { opacity: 0.8 }]}
        >
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor: saved.saved ? colors.primaryMuted : colors.backgroundSecondary,
                borderColor: saved.saved ? colors.primary : colors.border,
              },
            ]}
          >
            <Ionicons name={saved.saved ? 'bookmark' : 'bookmark-outline'} size={18} color={colors.primary} />
          </View>
          <Text style={[styles.iconCaption, { color: colors.textSecondary }]} numberOfLines={1}>
            {saved.saved ? t('storiesSavedAction') : t('storiesSave')}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => void onShare()}
          style={({ pressed }) => [styles.iconActionCol, pressed && { opacity: 0.8 }]}
        >
          <View style={[styles.iconCircle, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
            <Ionicons name="share-outline" size={18} color={colors.text} />
          </View>
          <Text style={[styles.iconCaption, { color: colors.textSecondary }]} numberOfLines={1}>
            {t('storiesShare')}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={speaking ? t('storiesPause') : t('storiesListen')}
          onPress={() => void listen()}
          style={({ pressed }) => [styles.iconActionCol, pressed && { opacity: 0.8 }]}
        >
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor: speaking ? colors.primary : colors.backgroundSecondary,
                borderColor: speaking ? colors.primary : colors.border,
              },
            ]}
          >
            <Ionicons
              name={speaking ? 'pause' : 'volume-medium-outline'}
              size={18}
              color={speaking ? colors.onPrimary : colors.text}
            />
          </View>
          <Text style={[styles.iconCaption, { color: colors.textSecondary }]} numberOfLines={1}>
            {speaking ? t('storiesPause') : t('storiesListen')}
          </Text>
        </Pressable>

        <View style={{ flex: 1 }} />

        {!d.own ? (
          <Pressable
            accessibilityRole="button"
            onPress={onReport}
            style={({ pressed }) => [styles.iconActionCol, pressed && { opacity: 0.8 }]}
          >
            <View style={[styles.iconCircle, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
              <Ionicons name="flag-outline" size={18} color={colors.textSecondary} />
            </View>
            <Text style={[styles.iconCaption, { color: colors.textSecondary }]} numberOfLines={1}>
              {t('storiesReport')}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tc('moreActions')}
            disabled={deleting}
            onPress={() => setOwnerMenuOpen(true)}
            style={({ pressed }) => [styles.iconActionCol, pressed && { opacity: 0.8 }]}
          >
            <View style={[styles.iconCircle, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
              {deleting ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
              )}
            </View>
            <Text style={[styles.iconCaption, { color: colors.textSecondary }]} numberOfLines={1}>
              {tc('moreActions')}
            </Text>
          </Pressable>
        )}
      </View>

      {canContact ? (
        <View style={[styles.contactCard, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: '800' }}>{t('storiesContact')}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
              {pendingContact ? t('storiesContactPending') : t('storiesContactEnabled')}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={pendingContact}
            onPress={() => setContactOpen(true)}
            style={[
              styles.contactButton,
              {
                backgroundColor: pendingContact ? colors.backgroundSecondary : colors.primary,
                borderColor: pendingContact ? colors.border : colors.primary,
              },
            ]}
          >
            <Text style={{ color: pendingContact ? colors.textSecondary : colors.onPrimary, fontSize: 12, fontWeight: '800' }}>
              {pendingContact ? t('liveDuaPending') : t('liveDuaSendRequest')}
            </Text>
          </Pressable>
        </View>
      ) : !d.own && (d.pseudonymous || !d.contact_enabled) ? (
        <View style={[styles.contactCard, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
          <Ionicons name="lock-closed-outline" size={16} color={colors.textSecondary} />
          <Text style={{ color: colors.textSecondary, fontSize: 12, flex: 1 }}>
            {d.pseudonymous ? t('storiesPseudonymousContact') : t('storiesContactClosed')}
          </Text>
        </View>
      ) : null}

      <StoryComments
        storyId={d.id}
        enabled={d.status === 'published'}
        canWrite={d.comments_enabled && d.status === 'published'}
        commentCount={d.comment_count}
      />

      <AppBottomSheet visible={reportOpen} title={t('storiesReport')} onClose={() => setReportOpen(false)}>
        <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginBottom: 8 }}>
          {t('storiesReport')}
        </Text>
        {[
          { label: t('storiesReportSpam'), reason: 'spam' },
          { label: t('storiesReportHarassment'), reason: 'harassment' },
          { label: t('storiesReportMisattribution'), reason: 'misattribution' },
          { label: t('storiesReportOther'), reason: 'other' },
        ].map((option) => (
          <Pressable
            key={option.reason}
            accessibilityRole="button"
            disabled={reporting}
            onPress={() => void submitReport(option.reason)}
            style={[styles.reportRow, { borderColor: colors.border }]}
          >
            {reporting ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>{option.label}</Text>
            )}
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setReportOpen(false);
            router.push('/safety/support');
          }}
          style={{ minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          <Ionicons name="help-buoy-outline" size={15} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '800' }}>
            {t('storiesSupportResources')}
          </Text>
        </Pressable>
      </AppBottomSheet>

      <AppBottomSheet visible={contactOpen} title={t('storiesContact')} onClose={() => setContactOpen(false)}>
        <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginBottom: 8 }}>
          {t('storiesContactEnabled')}
        </Text>
        <TextInput
          value={contactMessage}
          onChangeText={setContactMessage}
          multiline
          maxLength={500}
          placeholder={t('storiesContactDefault')}
          placeholderTextColor={colors.textSecondary}
          style={[
            styles.contactInput,
            { color: colors.text, backgroundColor: colors.backgroundSecondary, borderColor: colors.border },
          ]}
        />
        <Pressable
          accessibilityRole="button"
          disabled={sendingContact}
          onPress={() => void onContact()}
          style={[styles.contactSend, { backgroundColor: colors.primary }]}
        >
          {sendingContact ? (
            <ActivityIndicator color={colors.onPrimary} size="small" />
          ) : (
            <Text style={{ color: colors.onPrimary, fontSize: 13, fontWeight: '800' }}>{t('liveDuaSendRequest')}</Text>
          )}
        </Pressable>
      </AppBottomSheet>

      <AppBottomSheet
        visible={ownerMenuOpen}
        title={tc('moreActions')}
        onClose={() => setOwnerMenuOpen(false)}
      >
        <Pressable
          accessibilityRole="button"
          disabled={deleting}
          onPress={() => {
            setOwnerMenuOpen(false);
            router.push({ pathname: '/stories/compose', params: { id: d.id } });
          }}
          style={[styles.ownerRow, { borderColor: colors.divider }]}
        >
          <Ionicons name="create-outline" size={18} color={colors.text} />
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>{t('storiesEdit')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={deleting}
          onPress={confirmDeleteStory}
          style={[styles.ownerRow, { borderColor: colors.divider }]}
        >
          {deleting ? (
            <ActivityIndicator color={colors.error} size="small" />
          ) : (
            <Ionicons name="trash-outline" size={18} color={colors.error} />
          )}
          <Text style={{ color: colors.error, fontSize: 15, fontWeight: '600' }}>{t('storiesDelete')}</Text>
        </Pressable>
      </AppBottomSheet>

      <Text style={{ color: colors.textSecondary, fontSize: 10, textAlign: 'center', paddingTop: 4 }}>
        {t('storiesSpeechHint')}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  aliasAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  coverWrap: { borderRadius: 18, overflow: 'hidden' },
  coverImage: { width: '100%', height: 180 },
  notice: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reader: { borderRadius: 18, borderWidth: 1, padding: 18 },
  readerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  smallButton: {
    minWidth: 36,
    minHeight: 30,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listenCard: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 10, gap: 8 },
  listenRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  listenPlay: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listenStop: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listenTrack: { height: 4, borderRadius: 999, overflow: 'hidden', marginHorizontal: 2 },
  listenFill: { height: '100%', borderRadius: 999 },
  settingsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 2 },
  rate: {
    minHeight: 26,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linked: { borderRadius: 16, borderWidth: 1, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  linkedIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  linkedButton: { minHeight: 34, borderRadius: 10, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  supportButton: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  actionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  iconActionCol: { alignItems: 'center', gap: 5, width: 58 },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCaption: { fontSize: 10, fontWeight: '700' },
  contactCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  contactButton: {
    minHeight: 34,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactInput: {
    minHeight: 90,
    borderRadius: 12,
    borderWidth: 1,
    padding: 11,
    fontSize: 14,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  contactSend: { minHeight: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  reportRow: {
    minHeight: 46,
    borderRadius: 11,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 12,
    marginBottom: 6,
  },
});
