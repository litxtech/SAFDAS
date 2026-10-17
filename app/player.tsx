import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DuaVoicePicker } from '@/components/duas/DuaVoicePicker';
import { Cover, ListenBack, SeekBar, Transport, coverFor, ink } from '@/components/listen/chrome';
import { AutoNextSurahToggle } from '@/components/quran/AutoNextSurahToggle';
import { ContinueSpanPicker } from '@/components/quran/ContinueSpanPicker';
import { ReciterPicker } from '@/components/quran/ReciterPicker';
import { useI18nStore, useT } from '@/i18n';
import { cyclePlaybackRate, cycleRepeatMode, playAdjacent, playQueue, retryPlayback, seekPlayback, togglePlayback, useAudioEngine, type PlayableTrack } from '@/services/audio/engine';
import { loadDuas, type DuaItem } from '@/services/duas';
import { fetchSurah, type Ayah } from '@/services/quran';
import { playSurahAyah, useQuranPlayer } from '@/services/quran/playback';
import { useAuthStore } from '@/stores/authStore';
import { useDuaVoiceStore } from '@/stores/duaVoiceStore';
import { useReadingStore } from '@/stores/readingStore';

export default function PlayerScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const engine = useAudioEngine();
  const track = engine.queue[engine.index];
  const pair = coverFor(track?.id ?? 'idle');
  const [shuffled, setShuffled] = useState(false);
  const original = useRef<PlayableTrack[] | null>(null);

  function shuffle() {
    const next = !shuffled;
    setShuffled(next);
    const { queue, index } = useAudioEngine.getState();
    const current = queue[index];
    if (!current) return;
    if (!next) {
      const restored = original.current;
      original.current = null;
      if (!restored) return;
      const at = Math.max(0, restored.findIndex((item) => item.id === current.id));
      void playQueue(restored, at);
      return;
    }
    original.current = queue;
    const rest = queue.filter((item) => item.id !== current.id).sort(() => Math.random() - 0.5);
    void playQueue([current, ...rest], 0);
  }

  return (
    <View style={{ flex: 1, backgroundColor: ink.canvas }}>
      <StatusBar style="light" />
      <LinearGradient colors={[pair[0], ink.canvas]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.45 }} style={{ flex: 1, paddingTop: insets.top }}>
        <View style={{ paddingHorizontal: 8 }}>
          <ListenBack down />
        </View>
        <View style={{ flex: 1 }}>
          {track?.kind === 'quran' && track.surahNumber ? (
            <QuranLyrics surahNumber={track.surahNumber} title={track.title} />
          ) : (
            <DuaLyrics />
          )}
        </View>
        <View style={{ paddingHorizontal: 16, gap: 8, paddingBottom: Math.max(12, insets.bottom) }}>
          {engine.error ? (
            <Pressable onPress={() => void retryPlayback()}>
              <Text style={{ color: ink.green, fontWeight: '700' }}>{t('retryAudio')}</Text>
            </Pressable>
          ) : null}
          {track?.kind === 'quran' ? (
            <>
              <AutoNextSurahToggle />
              <ContinueSpanPicker />
            </>
          ) : null}
          <SeekBar current={engine.currentTime} duration={engine.duration} onSeek={(seconds) => void seekPlayback(seconds)} />
          <Transport
            playing={engine.playing}
            loading={engine.loading}
            shuffled={shuffled}
            repeatMode={engine.repeatMode}
            playbackRate={engine.playbackRate}
            onToggle={engine.error ? () => void retryPlayback() : togglePlayback}
            onPrevious={() => void playAdjacent(-1)}
            onNext={() => void playAdjacent(1)}
            onShuffle={shuffle}
            onRepeat={cycleRepeatMode}
            onRate={cyclePlaybackRate}
          />
        </View>
      </LinearGradient>
    </View>
  );
}

function lyricColor(distance: number) {
  if (distance === 0) return ink.text;
  if (Math.abs(distance) === 1) return ink.muted;
  return ink.dim;
}

function QuranLyrics({ surahNumber, title }: { surahNumber: number; title: string }) {
  const t = useT();
  const locale = useI18nStore((state) => state.locale);
  const mealSize = useReadingStore((state) => state.mealSize);
  const fontSize = useReadingStore((state) => state.fontSize);
  const player = useQuranPlayer();
  const listRef = useRef<FlatList<Ayah>>(null);
  const [follow, setFollow] = useState(true);
  const query = useQuery({ queryKey: ['surah', surahNumber, locale], queryFn: () => fetchSurah(surahNumber, locale) });
  const ayahs = query.data ?? [];
  const currentIndex = ayahs.findIndex((ayah) => ayah.numberInSurah === player.ayahInSurah);

  useEffect(() => {
    if (!follow || currentIndex < 0) return;
    listRef.current?.scrollToIndex({ index: currentIndex, viewPosition: 0.28, animated: true });
  }, [currentIndex, follow]);

  async function jump(ayah: Ayah) {
    setFollow(true);
    await playSurahAyah({
      surahNumber,
      surahTitle: title.split('·')[0]?.trim() || title,
      ayahs: ayahs.map((item) => ({ number: item.number, numberInSurah: item.numberInSurah })),
      ayahNumber: ayah.number,
    });
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        ref={listRef}
        data={ayahs}
        keyExtractor={(item) => String(item.number)}
        contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 24, gap: 22 }}
        extraData={player.ayahInSurah}
        onScrollBeginDrag={() => setFollow(false)}
        onScrollToIndexFailed={(info) => {
          listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
        }}
        ListHeaderComponent={
          <View style={{ alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <Cover seed={surahNumber} label={title} size={168} />
            <Text style={{ color: ink.text, fontSize: 22, fontWeight: '800', textAlign: 'center' }}>{title}</Text>
            <ReciterPicker centered />
          </View>
        }
        renderItem={({ item, index }) => {
          const distance = currentIndex < 0 ? 2 : index - currentIndex;
          const current = distance === 0;
          const meaning = item.translation ?? t('mealUnavailable');
          return (
            <Pressable onPress={() => void jump(item)} style={{ gap: 8 }}>
              {current ? (
                <Text style={{ color: ink.text, fontSize, lineHeight: fontSize * 1.7, textAlign: 'right', writingDirection: 'rtl', fontWeight: '700' }}>
                  {item.text}
                </Text>
              ) : null}
              <Text style={{ color: lyricColor(distance), fontSize: current ? Math.max(22, mealSize + 4) : 18, lineHeight: current ? 34 : 26, fontWeight: current ? '800' : '600' }}>
                {meaning}
              </Text>
            </Pressable>
          );
        }}
      />
      {!follow && currentIndex >= 0 ? (
        <Pressable
          onPress={() => setFollow(true)}
          style={{ position: 'absolute', alignSelf: 'center', bottom: 8, backgroundColor: ink.text, borderRadius: 999, paddingHorizontal: 14, minHeight: 32, justifyContent: 'center' }}
        >
          <Text style={{ color: ink.black, fontWeight: '800' }}>{t('nowPlaying')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function DuaLyrics() {
  const t = useT();
  const locale = useI18nStore((state) => state.locale);
  const userId = useAuthStore((state) => state.session?.user.id);
  const voiceId = useDuaVoiceStore((state) => state.id);
  const engine = useAudioEngine();
  const listRef = useRef<FlatList<PlayableTrack>>(null);
  const [follow, setFollow] = useState(true);
  const duas = useQuery({ queryKey: ['duas', locale, userId, voiceId], queryFn: () => loadDuas(locale, userId) });
  const track = engine.queue[engine.index];

  useEffect(() => {
    if (!follow || engine.index < 0) return;
    listRef.current?.scrollToIndex({ index: engine.index, viewPosition: 0.28, animated: true });
  }, [engine.index, follow]);

  function match(item: PlayableTrack): DuaItem | undefined {
    return duas.data?.find((dua) => dua.id === item.duaId || `dua:${dua.slug}` === item.id);
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        ref={listRef}
        data={engine.queue}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 24, gap: 22 }}
        extraData={engine.index}
        onScrollBeginDrag={() => setFollow(false)}
        onScrollToIndexFailed={(info) => {
          listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
        }}
        ListHeaderComponent={
          <View style={{ alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <Cover seed={track?.id ?? 'dua'} label={track?.title ?? t('nothingPlaying')} size={168} />
            <Text style={{ color: ink.text, fontSize: 22, fontWeight: '800', textAlign: 'center' }}>{track?.title ?? t('nothingPlaying')}</Text>
            <DuaVoicePicker centered />
          </View>
        }
        renderItem={({ item, index }) => {
          const distance = index - engine.index;
          const current = distance === 0;
          const dua = match(item);
          return (
            <Pressable onPress={() => void playQueue(engine.queue, index)} style={{ gap: 8 }}>
              {current && dua ? (
                <Text style={{ color: ink.text, fontSize: 26, lineHeight: 42, textAlign: 'right', writingDirection: 'rtl', fontWeight: '700' }}>{dua.arabic}</Text>
              ) : null}
              {current && dua?.transliteration ? <Text style={{ color: ink.muted, fontSize: 15, lineHeight: 22 }}>{dua.transliteration}</Text> : null}
              <Text style={{ color: lyricColor(distance), fontSize: current ? 26 : 18, lineHeight: current ? 36 : 26, fontWeight: current ? '800' : '600' }}>
                {dua?.meaning ?? (current ? t('noTranslation') : item.title)}
              </Text>
              {current && dua?.source ? <Text style={{ color: ink.dim, fontSize: 13 }}>{dua.source}</Text> : null}
            </Pressable>
          );
        }}
      />
      {!follow ? (
        <Pressable
          onPress={() => setFollow(true)}
          style={{ position: 'absolute', alignSelf: 'center', bottom: 8, backgroundColor: ink.text, borderRadius: 999, paddingHorizontal: 14, minHeight: 32, justifyContent: 'center' }}
        >
          <Text style={{ color: ink.black, fontWeight: '800' }}>{t('nowPlaying')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
