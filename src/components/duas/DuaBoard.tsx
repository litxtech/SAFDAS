import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, SectionList, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DuaVoicePicker } from '@/components/duas/DuaVoicePicker';
import { Cover, ListenBack, PlayFab, TrackRow, coverFor, ink } from '@/components/listen/chrome';
import { useI18nStore, useT } from '@/i18n';
import { playQueue, togglePlayback, useAudioEngine } from '@/services/audio/engine';
import {
  filterDuas,
  groupDuasByCategory,
  loadDuas,
  mergeDuas,
  refreshDuaCatalogInBackground,
  toggleFavorite,
  tracksFor,
  type DuaItem,
} from '@/services/duas';
import { useAuthStore } from '@/stores/authStore';
import { useDuaVoiceStore } from '@/stores/duaVoiceStore';
import { useToastStore } from '@/stores/toastStore';

export function DuaBoard({ focus }: { focus?: string }) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const locale = useI18nStore((state) => state.locale);
  const userId = useAuthStore((state) => state.session?.user.id);
  const show = useToastStore((state) => state.show);
  const client = useQueryClient();
  const engine = useAudioEngine();
  const voiceId = useDuaVoiceStore((state) => state.id);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<DuaItem | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [coverage, setCoverage] = useState<{ have: number; expected: number; complete: boolean } | null>(null);
  const query = useQuery({
    queryKey: ['duas', locale, userId, voiceId],
    queryFn: () => loadDuas(locale, userId),
  });
  const duas = useMemo(() => {
    const list = [...(query.data ?? [])];
    if (focus) list.sort((a, b) => Number(b.slug === focus) - Number(a.slug === focus));
    return list;
  }, [focus, query.data]);
  const filtered = useMemo(() => filterDuas(duas, search), [duas, search]);
  const sections = useMemo(
    () => groupDuasByCategory(filtered, t('duas')),
    [filtered, t],
  );
  const pair = coverFor(focus ?? 'duas');
  const queue = tracksFor(filtered);
  const current = engine.queue[engine.index];
  const playingDua = current?.kind === 'dua';

  useEffect(() => {
    let cancelled = false;
    setSyncing(true);
    void refreshDuaCatalogInBackground(locale)
      .then(async (remote) => {
        if (cancelled) return;
        if (remote?.length) {
          client.setQueryData(['duas', locale, userId, voiceId], (prev: DuaItem[] | undefined) =>
            mergeDuas([prev ?? [], remote]),
          );
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
  }, [locale, userId, voiceId, client]);

  async function playAt(dua: DuaItem, openPlayer = false) {
    const index = queue.findIndex(
      (track) => track.duaId === dua.id || track.duaSlug === dua.slug || track.id.endsWith(`:${dua.slug}`),
    );
    if (index < 0) {
      setSelected(dua);
      return;
    }
    const selectedTrack = queue[index];
    if (selectedTrack && current?.id === selectedTrack.id) {
      if (!openPlayer) togglePlayback();
    } else {
      await playQueue(queue, index);
    }
    if (openPlayer) router.push('/player');
  }

  async function playAll() {
    if (!queue.length) {
      show(t('audioMissing'), 'info');
      return;
    }
    if (playingDua) {
      togglePlayback();
      return;
    }
    const start = focus ? Math.max(0, queue.findIndex((track) => duas.find((dua) => dua.slug === focus)?.id === track.duaId)) : 0;
    await playQueue(queue, start);
  }

  return (
    <View style={{ flex: 1, backgroundColor: ink.canvas }}>
      <StatusBar style="light" />
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled
        contentContainerStyle={{ paddingBottom: 140 }}
        extraData={engine}
        keyboardShouldPersistTaps="handled"
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
                <PlayFab playing={Boolean(playingDua && engine.playing)} onPress={() => void playAll()} />
              </View>
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
                          client.setQueryData(['duas', locale, userId, voiceId], (prev: DuaItem[] | undefined) =>
                            mergeDuas([prev ?? [], remote]),
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
              {!query.isLoading && !filtered.length ? (
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
          const hasAudio = Boolean(item.audioUrl || item.openDuaUrl || item.ayahNumber);
          return (
            <TrackRow
              index={index + 1}
              title={item.title ?? t('noTranslation')}
              subtitle={item.arabic || item.meaning || item.source || undefined}
              active={active}
              playing={active && engine.playing}
              onPress={() => void playAt(item)}
              trailing={
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  {hasAudio ? (
                    <Ionicons name="volume-medium-outline" size={16} color={ink.green} />
                  ) : (
                    <Ionicons name="book-outline" size={16} color={ink.muted} />
                  )}
                  <Pressable
                    accessibilityLabel={t('duas')}
                    hitSlop={8}
                    onPress={() => {
                      if (!userId) return;
                      void toggleFavorite(userId, item.id, item.favorite)
                        .then(() => client.invalidateQueries({ queryKey: ['duas'] }))
                        .catch((error: Error) => {
                          if (error.message === 'favorite_unavailable') show(t('noTranslation'), 'info');
                          else show(error.message, 'error');
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
