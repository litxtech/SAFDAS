import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Cover, ListenBack, PlayFab, RoundIcon, TrackRow, coverFor, ink } from '@/components/listen/chrome';
import { AutoNextSurahToggle } from '@/components/quran/AutoNextSurahToggle';
import { ContinueSpanPicker } from '@/components/quran/ContinueSpanPicker';
import { ReciterPicker } from '@/components/quran/ReciterPicker';
import { useI18nStore, useT } from '@/i18n';
import { fetchSurah, fetchSurahList, surahFacts, type Ayah } from '@/services/quran';
import { goQuranHome, openSurah } from '@/services/quran/nav';
import { playSurahAyah, toggleQuranPlayback, useQuranPlayer } from '@/services/quran/playback';
import { openStudioRecord } from '@/services/studio/nav';
import { useReadingStore } from '@/stores/readingStore';

export default function SurahScreen() {
  const { surah, ayah } = useLocalSearchParams<{ surah: string; ayah?: string }>();
  const number = Number(surah);
  const rawAyah = Array.isArray(ayah) ? ayah[0] : ayah;
  const targetAyah = Number(rawAyah);
  const t = useT();
  const insets = useSafeAreaInsets();
  const locale = useI18nStore((state) => state.locale);
  const fontSize = useReadingStore((state) => state.fontSize);
  const mealSize = useReadingStore((state) => state.mealSize);
  const setFontSize = useReadingStore((state) => state.setFontSize);
  const setMealSize = useReadingStore((state) => state.setMealSize);
  const [mode, setMode] = useState<'tracks' | 'lyrics'>('tracks');
  const [follow, setFollow] = useState(true);
  const listRef = useRef<FlatList<Ayah>>(null);
  const jumped = useRef(false);
  const surahNumber = useQuranPlayer((state) => state.surahNumber);
  const ayahInSurah = useQuranPlayer((state) => state.ayahInSurah);
  const playing = useQuranPlayer((state) => state.playing);
  const pair = coverFor(Number.isFinite(number) ? number : 0);
  const list = useQuery({ queryKey: ['surahs', locale], queryFn: () => fetchSurahList(locale), staleTime: 60_000 });
  const summary = list.data?.find((item) => item.number === number);
  const query = useQuery({ queryKey: ['surah', number, locale], queryFn: () => fetchSurah(number, locale), enabled: Number.isFinite(number) });
  const listening = surahNumber === number;
  const title = summary ? `${summary.number}. ${summary.englishNameTranslation}` : t('surahTitle', { number });
  const currentIndex = (query.data ?? []).findIndex((item) => listening && ayahInSurah === item.numberInSurah);

  async function play(globalNumber: number) {
    if (!query.data) return;
    await playSurahAyah({
      surahNumber: number,
      surahTitle: title,
      ayahs: query.data.map((item) => ({ number: item.number, numberInSurah: item.numberInSurah })),
      ayahNumber: globalNumber,
    });
  }

  function listen() {
    const ayahs = query.data;
    if (!ayahs?.length) return;
    setFollow(true);
    if (listening) {
      toggleQuranPlayback();
      return;
    }
    const first = ayahs[0];
    if (!first) return;
    void play(first.number);
  }

  useEffect(() => {
    if (mode !== 'lyrics' || !follow || currentIndex < 0) return;
    listRef.current?.scrollToIndex({ index: currentIndex, viewPosition: 0.28, animated: true });
  }, [currentIndex, follow, mode]);

  const followed = useRef(surahNumber === number);

  useEffect(() => {
    if (surahNumber === number) followed.current = true;
  }, [surahNumber, number]);

  useEffect(() => {
    if (!followed.current || !surahNumber || surahNumber === number) return;
    followed.current = false;
    openSurah(surahNumber, ayahInSurah ?? 1, { replace: true });
  }, [ayahInSurah, surahNumber, number]);

  useEffect(() => {
    jumped.current = false;
  }, [number]);

  useEffect(() => {
    if (jumped.current || !query.data || !Number.isFinite(targetAyah) || targetAyah <= 0) return;
    const index = query.data.findIndex((item) => item.numberInSurah === targetAyah);
    if (index < 0) return;
    jumped.current = true;
    requestAnimationFrame(() => listRef.current?.scrollToIndex({ index, viewPosition: 0.28, animated: false }));
  }, [query.data, targetAyah]);

  return (
    <View style={{ flex: 1, backgroundColor: ink.canvas }}>
      <StatusBar style="light" />
      <FlatList
        ref={listRef}
        data={query.data ?? []}
        keyExtractor={(item) => String(item.number)}
        contentContainerStyle={{ paddingBottom: 140 }}
        extraData={{ mode, ayahInSurah, playing, fontSize, mealSize }}
        onScrollBeginDrag={() => {
          if (mode === 'lyrics') setFollow(false);
        }}
        onScrollToIndexFailed={(info) => {
          listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
        }}
        ListHeaderComponent={
          <LinearGradient colors={[pair[0], ink.canvas]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ paddingTop: insets.top + 4, paddingHorizontal: 16, paddingBottom: 12, gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <ListenBack onPress={goQuranHome} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('quranHome')}
                onPress={goQuranHome}
                hitSlop={8}
                style={{ minHeight: 36, paddingHorizontal: 12, borderRadius: 999, backgroundColor: ink.raised, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: ink.muted, fontWeight: '700', fontSize: 13 }}>{t('quranHome')}</Text>
              </Pressable>
            </View>
            <Cover seed={number} label={summary?.name ?? title} size={196} />
            <View>
              <Text style={{ color: ink.text, fontSize: 28, fontWeight: '800' }}>{title}</Text>
              <Text style={{ color: ink.muted, marginTop: 4 }}>{summary ? surahFacts(summary, t) : query.data ? t('ayahCount', { count: query.data.length }) : ''}</Text>
              <ReciterPicker />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <RoundIcon name={mode === 'tracks' ? 'list' : 'list-outline'} label={t('trackList')} color={mode === 'tracks' ? ink.text : ink.muted} onPress={() => setMode('tracks')} />
                <RoundIcon name="text" label={t('meanings')} color={mode === 'lyrics' ? ink.green : ink.muted} onPress={() => setMode('lyrics')} />
                <RoundIcon
                  name="mic-outline"
                  label={t('studioRecordSurah')}
                  color={ink.green}
                  onPress={() =>
                    openStudioRecord({
                      contentType: 'quran',
                      surah: number,
                      ayahStart: 1,
                      ayahEnd: query.data?.length ?? 1,
                      title: title,
                    })
                  }
                />
                <Pressable onPress={() => setFontSize(fontSize - 2)} accessibilityLabel={t('arabicSize')}><Text style={{ color: ink.text, fontWeight: '800' }}>A-</Text></Pressable>
                <Pressable onPress={() => setFontSize(fontSize + 2)} accessibilityLabel={t('arabicSize')}><Text style={{ color: ink.text, fontWeight: '800' }}>A+</Text></Pressable>
                <Pressable onPress={() => setMealSize(mealSize - 1)} accessibilityLabel={t('mealSize')}><Text style={{ color: ink.muted, fontWeight: '800' }}>a-</Text></Pressable>
                <Pressable onPress={() => setMealSize(mealSize + 1)} accessibilityLabel={t('mealSize')}><Text style={{ color: ink.muted, fontWeight: '800' }}>a+</Text></Pressable>
              </View>
              <PlayFab playing={listening && playing} onPress={listen} />
            </View>
            <AutoNextSurahToggle />
            <ContinueSpanPicker />
            {summary && !summary.bismillahPre ? <Text style={{ color: ink.muted }}>{t('noBismillah')}</Text> : null}
            {query.error ? <Text style={{ color: ink.green }} onPress={() => void query.refetch()}>{t('retryAudio')}</Text> : null}
          </LinearGradient>
        }
        ListFooterComponent={<Text style={{ color: ink.dim, marginHorizontal: 16, marginTop: 16, fontSize: 12, lineHeight: 18 }}>{t('quranLicense')}</Text>}
        renderItem={({ item, index }) => {
          const current = listening && ayahInSurah === item.numberInSurah;
          if (mode === 'lyrics') {
            const distance = currentIndex < 0 ? 2 : index - currentIndex;
            const meaning = item.translation ?? t('mealUnavailable');
            return (
              <Pressable onPress={() => { setFollow(true); void play(item.number); }} style={{ paddingHorizontal: 22, paddingVertical: 12, gap: 8 }}>
                {distance === 0 ? (
                  <Text style={{ color: ink.text, fontSize, lineHeight: fontSize * 1.7, textAlign: 'right', writingDirection: 'rtl', fontWeight: '700' }}>{item.text}</Text>
                ) : null}
                <Text style={{ color: distance === 0 ? ink.text : Math.abs(distance) === 1 ? ink.muted : ink.dim, fontSize: distance === 0 ? Math.max(22, mealSize + 2) : 17, lineHeight: distance === 0 ? 32 : 24, fontWeight: distance === 0 ? '800' : '600' }}>
                  {meaning}
                </Text>
              </Pressable>
            );
          }
          return (
            <TrackRow
              index={item.numberInSurah}
              title={t('playbackAyah', { number: item.numberInSurah })}
              subtitle={(item.translation ?? item.text).replace(/\s+/g, ' ').slice(0, 90)}
              active={current}
              playing={current && playing}
              onPress={() => void play(item.number)}
            />
          );
        }}
      />
      {mode === 'lyrics' && !follow && currentIndex >= 0 ? (
        <Pressable
          onPress={() => setFollow(true)}
          style={{ position: 'absolute', alignSelf: 'center', bottom: insets.bottom + 78, backgroundColor: ink.text, borderRadius: 999, paddingHorizontal: 14, minHeight: 32, justifyContent: 'center' }}
        >
          <Text style={{ color: ink.black, fontWeight: '800' }}>{t('nowPlaying')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
