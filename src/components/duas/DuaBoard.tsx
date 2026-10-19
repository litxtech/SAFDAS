import { startTransition, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, SectionList, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
import { DuaVoicePicker } from '@/components/duas/DuaVoicePicker';
import { Cover, ListenBack, PlayFab, TrackRow, coverFor, ink } from '@/components/listen/chrome';
import { useI18nStore, useT } from '@/i18n';
import { playQueue, togglePlayback, useAudioEngine } from '@/services/audio/engine';
import '@/services/audio/bindUriResolver';
import {
  bundledDuasFor,
  duaIsDownloaded,
  filterDuas,
  groupDuasByCategory,
  loadDuas,
  markDuaFavorites,
  mergeDuas,
  refreshDuaCatalogInBackground,
  resolvePlayableDua,
  toggleFavorite,
  tracksFor,
  type DuaItem,
} from '@/services/duas';
import { openPlayer as navigateToPlayer } from '@/services/quran/nav';
import { openStudioRecord } from '@/services/studio/nav';
import { useAuthStore } from '@/stores/authStore';
import { useDuaVoiceStore } from '@/stores/duaVoiceStore';
import { useNetworkStore } from '@/stores/networkStore';
import { useToastStore } from '@/stores/toastStore';

function applyRemoteDuas(prev: DuaItem[] | undefined, remote: DuaItem[], locale: Parameters<typeof bundledDuasFor>[0]) {
  const next = mergeDuas([prev?.length ? prev : bundledDuasFor(locale), remote]);
  if (!next.length && prev?.length) return prev;
  return next.length ? next : bundledDuasFor(locale);
}

export function DuaBoard({ focus }: { focus?: string }) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const locale = useI18nStore((state) => state.locale);
  const userId = useAuthStore((state) => state.session?.user.id);
  const show = useToastStore((state) => state.show);
  const client = useQueryClient();
  // Avoid subscribing to currentTime — it updates many times/sec and freezes the list.
  const { playing, current } = useAudioEngine(
    useShallow((state) => ({
      playing: state.playing,
      current: state.queue[state.index] ?? null,
    })),
  );
  const voiceId = useDuaVoiceStore((state) => state.id);
  const online = useNetworkStore((state) => state.online);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<DuaItem | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [coverage, setCoverage] = useState<{ have: number; expected: number; complete: boolean } | null>(null);
  const placeholder = useMemo(() => bundledDuasFor(locale), [locale]);
  const query = useQuery({
    queryKey: ['duas', locale, userId],
    queryFn: () => loadDuas(locale, userId),
    placeholderData: placeholder,
    staleTime: 60_000,
    networkMode: 'offlineFirst',
  });
  const duas = useMemo(() => {
    const list = [...(query.data?.length ? query.data : placeholder)];
    if (focus) {
      list.sort((a, b) => {
        const score = (item: DuaItem) =>
          Number(item.slug === focus) * 4 +
          Number(item.categoryNumber === focus) * 3 +
          Number(item.categoryNumber === `surah:${focus}`) * 3 +
          Number((item.categoryLabel ?? '').toLocaleLowerCase() === focus.toLocaleLowerCase()) * 2 +
          Number((item.title ?? '').toLocaleLowerCase() === focus.toLocaleLowerCase());
        return score(b) - score(a);
      });
    }
    return list;
  }, [focus, placeholder, query.data]);
  const filtered = useMemo(() => {
    const base = filterDuas(duas, search);
    if (!focus) return base;
    const needle = focus.trim().toLocaleLowerCase();
    const narrowed = base.filter((item) => {
      if (item.slug === focus || item.categoryNumber === focus) return true;
      if (item.categoryNumber === `surah:${focus}`) return true;
      if ((item.categoryLabel ?? '').toLocaleLowerCase() === needle) return true;
      if ((item.title ?? '').toLocaleLowerCase() === needle) return true;
      return false;
    });
    return narrowed.length ? narrowed : base;
  }, [duas, focus, search]);
  const sections = useMemo(
    () => groupDuasByCategory(filtered, t('duas')),
    [filtered, t],
  );
  const pair = coverFor(focus ?? 'duas');
  const queue = useMemo(
    () => tracksFor(filtered, undefined, { offlineOnly: !online }),
    [filtered, voiceId, online],
  );
  const playingDua = current?.kind === 'dua';

  useEffect(() => {
    if (!online) {
      setSyncing(false);
      return;
    }
    let cancelled = false;
    setSyncing(true);
    void refreshDuaCatalogInBackground(locale)
      .then(async (remote) => {
        if (cancelled) return;
        if (remote?.length) {
          startTransition(() => {
            client.setQueryData(['duas', locale, userId], (prev: DuaItem[] | undefined) => {
              const merged = applyRemoteDuas(prev, remote, locale);
              // Keep hearts from the previous list (local + optimistic toggles).
              const hearts = new Set(
                (prev ?? []).filter((item) => item.favorite).flatMap((item) => [item.id, item.slug]),
              );
              return markDuaFavorites(merged, hearts);
            });
          });
        }
        try {
          const duaCatalog = await import('@/services/duaCatalog');
          const { readCached } = await import('@/services/remoteStore');
          const catalog = await readCached<import('@/services/duaCatalog').DuaCatalog>(duaCatalog.DUA_CATALOG_KEY);
          if (!cancelled) setCoverage(duaCatalog.catalogCoverage(catalog));
        } catch {
          /* ignore */
        }
      })
      .finally(() => {
        if (!cancelled) setSyncing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [locale, userId, client, online]);

  async function playAt(dua: DuaItem, openPlayer = false) {
    if (!online && !duaIsDownloaded(dua)) {
      show(t('offlineDuaEmpty'), 'info');
      setSelected(dua);
      return;
    }

    let playableQueue = queue;
    let index = playableQueue.findIndex(
      (track) => track.duaId === dua.id || track.duaSlug === dua.slug || track.id.endsWith(`:${dua.slug}`),
    );

    if (index < 0) {
      const enriched = online ? await resolvePlayableDua(dua) : dua;
      if (online) {
        client.setQueryData(['duas', locale, userId], (prev: DuaItem[] | undefined) => {
          const list = prev?.length ? prev : placeholder;
          return list.map((item) => (item.id === enriched.id || item.slug === enriched.slug ? enriched : item));
        });
      }
      const single = tracksFor([enriched], undefined, { offlineOnly: !online });
      if (!single.length) {
        show(!online ? t('offlineDuaEmpty') : t('audioMissing'), 'info');
        setSelected(enriched);
        return;
      }
      playableQueue = single;
      index = 0;
    }

    const selectedTrack = playableQueue[index];
    // Only pause when already playing this track — otherwise always start (fixes 2-tap).
    if (selectedTrack && current?.id === selectedTrack.id && playing) {
      if (!openPlayer) togglePlayback();
    } else {
      await playQueue(playableQueue, index);
      const err = useAudioEngine.getState().error;
      if (err && err !== 'missing-audio') {
        show(!online ? t('offlineDuaEmpty') : t('audioMissing'), 'error');
        return;
      }
    }
    if (openPlayer) navigateToPlayer();
  }

  async function playAll() {
    if (!queue.length) {
      show(!online ? t('offlineDuaEmpty') : t('audioMissing'), 'info');
      return;
    }
    if (playingDua && playing) {
      togglePlayback();
      return;
    }
    const start = focus ? Math.max(0, queue.findIndex((track) => duas.find((dua) => dua.slug === focus)?.id === track.duaId)) : 0;
    await playQueue(queue, Math.max(0, start));
  }

  return (
    <View style={{ flex: 1, backgroundColor: ink.canvas }}>
      <StatusBar style="light" />
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled
        contentContainerStyle={{ paddingBottom: 140 }}
        extraData={`${playing ? 1 : 0}:${current?.id ?? ''}:${filtered.length}:${voiceId}`}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={12}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
        updateCellsBatchingPeriod={50}
        ListHeaderComponent={
          <View>
            <LinearGradient
              colors={[pair[0], ink.canvas]}
              style={{ paddingTop: insets.top + 4, paddingHorizontal: 16, paddingBottom: 8, gap: 14 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <ListenBack />
                <Pressable onPress={() => router.push('/duas/playlists')}>
                  <Text style={{ color: ink.text, fontWeight: '700' }}>{t('playlists')}</Text>
                </Pressable>
              </View>
              <Cover seed={focus ?? 'duas'} label={t('duas')} size={180} />
              <Text style={{ color: ink.text, fontSize: 32, fontWeight: '800' }}>{t('duas')}</Text>
              <Text style={{ color: ink.muted, lineHeight: 20 }}>{t('duasSubtitle')}</Text>
              {!online ? (
                <Pressable
                  onPress={() => router.push('/settings/downloads')}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    backgroundColor: 'rgba(29,185,84,0.16)',
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                  }}
                >
                  <Ionicons name="cloud-offline-outline" size={18} color={ink.green} />
                  <Text style={{ color: ink.green, fontWeight: '700', flex: 1, lineHeight: 18 }}>
                    {t('offlineDuaOnly')}
                  </Text>
                </Pressable>
              ) : null}
              <View
                style={{
                  backgroundColor: ink.raised,
                  borderRadius: 10,
                  minHeight: 44,
                  paddingHorizontal: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Ionicons name="search" size={18} color={ink.muted} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder={t('searchDua')}
                  placeholderTextColor={ink.muted}
                  style={{ flex: 1, color: ink.text, fontSize: 16, paddingVertical: 10 }}
                  autoCorrect={false}
                  clearButtonMode="while-editing"
                />
                {search ? (
                  <Pressable onPress={() => setSearch('')} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color={ink.muted} />
                  </Pressable>
                ) : null}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <DuaVoicePicker />
                <Pressable onPress={() => router.push('/settings/downloads')} hitSlop={8}>
                  <Text style={{ color: ink.green, fontWeight: '700' }}>{t('offlineDownloads')}</Text>
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: ink.muted, fontWeight: '600' }}>{t('duaCount', { count: filtered.length })}</Text>
                  {coverage?.expected ? (
                    <Text style={{ color: coverage.complete ? ink.muted : ink.green, fontSize: 12 }}>
                      {coverage.complete
                        ? t('duasLiveCount', { categories: String(sections.length), duas: String(coverage.have) })
                        : `${coverage.have}/${coverage.expected}`}
                    </Text>
                  ) : null}
                  {syncing ? <Text style={{ color: ink.muted, fontSize: 12 }}>{t('listUpdating')}</Text> : null}
                </View>
                <PlayFab playing={Boolean(playingDua && playing)} onPress={() => void playAll()} />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('studioVoiceDua')}
                onPress={() => openStudioRecord({ contentType: 'dua', title: t('studioRecordDuaDefault') })}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  backgroundColor: 'rgba(137,87,245,0.18)',
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                }}
              >
                <Ionicons name="mic" size={20} color="#C4A7FF" />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: ink.text, fontWeight: '800' }}>{t('studioVoiceDua')}</Text>
                  <Text style={{ color: ink.muted, fontSize: 12, marginTop: 2 }}>{t('studioVoiceDuaHint')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={ink.muted} />
              </Pressable>
              {query.isLoading ? <ActivityIndicator color={ink.green} /> : null}
              {query.error ? (
                <Text style={{ color: ink.green }} onPress={() => void query.refetch()}>
                  {t('retryAudio')}
                </Text>
              ) : null}
              {coverage && !coverage.complete && !syncing ? (
                <Text
                  style={{ color: ink.green, fontWeight: '700' }}
                  onPress={() => {
                    setSyncing(true);
                    void refreshDuaCatalogInBackground(locale)
                      .then(async (remote) => {
                        if (remote?.length) {
                          client.setQueryData(['duas', locale, userId], (prev: DuaItem[] | undefined) =>
                            applyRemoteDuas(prev, remote, locale),
                          );
                        }
                        const duaCatalog = await import('@/services/duaCatalog');
                        const { readCached } = await import('@/services/remoteStore');
                        const catalog = await readCached<import('@/services/duaCatalog').DuaCatalog>(duaCatalog.DUA_CATALOG_KEY);
                        setCoverage(duaCatalog.catalogCoverage(catalog));
                      })
                      .finally(() => setSyncing(false));
                  }}
                >
                  {t('duasPartial')}
                </Text>
              ) : null}
              {!query.isLoading && !query.isFetching && !filtered.length ? (
                <View style={{ gap: 6, paddingVertical: 8 }}>
                  <Text style={{ color: ink.text, fontWeight: '700' }}>{t('noDuaTitle')}</Text>
                  <Text style={{ color: ink.muted, lineHeight: 20 }}>{t('noDuaBody')}</Text>
                </View>
              ) : null}
            </LinearGradient>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View style={{ backgroundColor: ink.canvas, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 }}>
            <Text style={{ color: ink.text, fontSize: 18, fontWeight: '800' }}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item, index }) => {
          const active =
            current?.duaId === item.id ||
            current?.duaSlug === item.slug ||
            Boolean(current?.id.endsWith(`:${item.slug}`));
          const downloaded = duaIsDownloaded(item);
          const hasAudio = downloaded || Boolean(item.audioUrl || item.openDuaUrl || item.ayahNumber);
          const mutedOffline = !online && !downloaded;
          return (
            <TrackRow
              index={index + 1}
              title={item.title ?? t('noTranslation')}
              subtitle={item.arabic || item.meaning || item.source || undefined}
              active={active}
              playing={active && playing}
              onPress={() => void playAt(item)}
              trailing={
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, opacity: mutedOffline ? 0.45 : 1 }}>
                  <Pressable
                    accessibilityLabel={t('studioVoiceDua')}
                    hitSlop={8}
                    onPress={() =>
                      openStudioRecord({
                        contentType: 'dua',
                        duaId: item.id,
                        title: item.title ?? t('studioRecordDuaDefault'),
                      })
                    }
                  >
                    <Ionicons name="mic-outline" size={18} color="#C4A7FF" />
                  </Pressable>
                  {downloaded ? (
                    <Ionicons name="checkmark-circle" size={16} color={ink.green} />
                  ) : hasAudio ? (
                    <Ionicons name="volume-medium-outline" size={16} color={ink.muted} />
                  ) : (
                    <Ionicons name="book-outline" size={16} color={ink.muted} />
                  )}
                  <Pressable
                    accessibilityLabel={item.favorite ? t('duaFavoriteRemoved') : t('duaFavoriteAdded')}
                    hitSlop={8}
                    onPress={() => {
                      if (!userId) {
                        show(t('duaFavoriteLogin'), 'info');
                        return;
                      }
                      const wasFavorite = item.favorite;
                      client.setQueryData(['duas', locale, userId], (prev: DuaItem[] | undefined) => {
                        const list = prev?.length ? prev : placeholder;
                        return list.map((row) =>
                          row.id === item.id || row.slug === item.slug ? { ...row, favorite: !wasFavorite } : row,
                        );
                      });
                      void toggleFavorite(userId, item.id, wasFavorite)
                        .then(() => {
                          show(wasFavorite ? t('duaFavoriteRemoved') : t('duaFavoriteAdded'), 'success');
                        })
                        .catch((error: Error) => {
                          client.setQueryData(['duas', locale, userId], (prev: DuaItem[] | undefined) => {
                            const list = prev?.length ? prev : placeholder;
                            return list.map((row) =>
                              row.id === item.id || row.slug === item.slug ? { ...row, favorite: wasFavorite } : row,
                            );
                          });
                          show(error.message, 'error');
                        });
                    }}
                  >
                    <Ionicons name={item.favorite ? 'heart' : 'heart-outline'} size={20} color={item.favorite ? ink.green : ink.muted} />
                  </Pressable>
                </View>
              }
            />
          );
        }}
      />

      <Modal visible={Boolean(selected)} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }} onPress={() => setSelected(null)} />
        <View
          style={{
            backgroundColor: ink.card,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: Math.max(insets.bottom, 16),
            maxHeight: '78%',
            gap: 12,
          }}
        >
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: ink.line }} />
          <Text style={{ color: ink.text, fontSize: 20, fontWeight: '800' }}>{selected?.title ?? t('duas')}</Text>
          {selected?.source ? <Text style={{ color: ink.muted }}>{selected.source}</Text> : null}
          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            {selected?.arabic ? (
              <Text
                style={{
                  color: ink.text,
                  fontSize: 26,
                  lineHeight: 42,
                  textAlign: 'right',
                  writingDirection: 'rtl',
                  marginBottom: 14,
                }}
              >
                {selected.arabic}
              </Text>
            ) : null}
            {selected?.transliteration ? (
              <Text style={{ color: ink.muted, fontStyle: 'italic', lineHeight: 22, marginBottom: 10 }}>
                {selected.transliteration}
              </Text>
            ) : null}
            {selected?.meaning ? (
              <Text style={{ color: ink.text, lineHeight: 24 }}>{selected.meaning}</Text>
            ) : (
              <Text style={{ color: ink.muted }}>{t('noTranslation')}</Text>
            )}
          </ScrollView>
          <Pressable
            onPress={() => setSelected(null)}
            style={{
              minHeight: 48,
              borderRadius: 14,
              backgroundColor: ink.green,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: ink.black, fontWeight: '800' }}>{t('back')}</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}
