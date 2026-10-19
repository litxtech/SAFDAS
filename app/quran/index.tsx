import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Cover, ListenBack, PlayFab, ink } from '@/components/listen/chrome';
import { useI18nStore, useT } from '@/i18n';
import { fetchSurah, fetchSurahList, surahFacts, syncQuran, type SurahSummary } from '@/services/quran';
import { openPlayer, openRecentListens, openSurah } from '@/services/quran/nav';
import { playSurahAyah } from '@/services/quran/playback';
import { openStudioRecord } from '@/services/studio/nav';
import { useListenHistory, type RecentListen } from '@/stores/listenHistoryStore';

export default function QuranIndex() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const locale = useI18nStore((state) => state.locale);
  const [search, setSearch] = useState('');
  const [prefetchBook, setPrefetchBook] = useState(false);
  const recent = useListenHistory((state) => state.items);
  const query = useQuery({
    queryKey: ['surahs', locale],
    queryFn: () => fetchSurahList(locale),
    staleTime: 6 * 60 * 60 * 1000,
  });
  const book = useQuery({
    queryKey: ['quran-book', locale],
    queryFn: () => syncQuran(locale),
    staleTime: 6 * 60 * 60 * 1000,
    enabled: prefetchBook,
  });

  useEffect(() => {
    const timer = setTimeout(() => setPrefetchBook(true), 600);
    return () => clearTimeout(timer);
  }, [locale]);
  const data = (query.data ?? []).filter((surah) => {
    const haystack = `${surah.englishName} ${surah.englishNameTranslation} ${surah.name} ${surah.number}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  async function playRecent(item: RecentListen, surah: SurahSummary | undefined) {
    const ayahs = await fetchSurah(item.surahNumber, locale);
    const target = ayahs.find((ayah) => ayah.numberInSurah === item.ayahInSurah) ?? ayahs[0];
    if (!target) return;
    const title = surah ? `${surah.number}. ${surah.englishNameTranslation}` : t('surahTitle', { number: item.surahNumber });
    await playSurahAyah({
      surahNumber: item.surahNumber,
      surahTitle: title,
      ayahs: ayahs.map((ayah) => ({ number: ayah.number, numberInSurah: ayah.numberInSurah })),
      ayahNumber: target.number,
    });
    openPlayer();
  }

  return (
    <View style={{ flex: 1, backgroundColor: ink.canvas, paddingTop: insets.top }}>
      <StatusBar style="light" />
      <FlatList
        data={data}
        keyExtractor={(item) => String(item.number)}
        contentContainerStyle={{ paddingBottom: 120 }}
        ListHeaderComponent={
          <View style={{ paddingTop: 4, gap: 18, marginBottom: 8 }}>
            <View style={{ paddingHorizontal: 8 }}>
              <ListenBack
                onPress={() => {
                  if (router.canGoBack()) router.back();
                  else router.navigate('/(tabs)');
                }}
              />
            </View>
            <Text style={{ color: ink.text, fontSize: 32, fontWeight: '800', paddingHorizontal: 16 }}>{t('quran')}</Text>
            <Pressable
              onPress={() => openStudioRecord({ contentType: 'quran', title: t('studioRecordQuranDefault') })}
              style={{
                marginHorizontal: 16,
                minHeight: 44,
                borderRadius: 999,
                backgroundColor: ink.green,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Ionicons name="mic" size={18} color="#000" />
              <Text style={{ color: '#000', fontWeight: '800' }}>{t('studioReadWithMyVoice')}</Text>
            </Pressable>
            <View style={{ marginHorizontal: 16, backgroundColor: ink.raised, borderRadius: 8, minHeight: 44, justifyContent: 'center', paddingHorizontal: 14 }}>
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={t('searchSurah')}
                placeholderTextColor={ink.muted}
                style={{ color: ink.text, fontSize: 16 }}
              />
            </View>
            {book.isFetching || (query.isFetching && query.data) ? <Text style={{ color: ink.muted, paddingHorizontal: 16 }}>{book.isFetching ? t('quranSyncing') : t('listUpdating')}</Text> : null}
            {query.isLoading ? <ActivityIndicator color={ink.green} /> : null}
            {query.error ? <Text style={{ color: ink.green, paddingHorizontal: 16 }} onPress={() => void query.refetch()}>{t('retryAudio')}</Text> : null}
            {recent.length ? (
              <View style={{ gap: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 }}>
                  <Text style={{ color: ink.text, fontSize: 22, fontWeight: '800' }}>{t('recentListens')}</Text>
                  <Pressable onPress={openRecentListens}>
                    <Text style={{ color: ink.muted, fontWeight: '700' }}>{t('seeAll')}</Text>
                  </Pressable>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}>
                  {recent.map((item) => {
                    const surah = query.data?.find((entry) => entry.number === item.surahNumber);
                    const title = surah ? surah.englishNameTranslation : t('surahTitle', { number: item.surahNumber });
                    return (
                      <View key={item.surahNumber} style={{ width: 148, gap: 8 }}>
                        <View>
                          <Pressable onPress={() => openSurah(item.surahNumber, item.ayahInSurah)}>
                            <Cover seed={item.surahNumber} label={surah?.name ?? String(item.surahNumber)} size={148} />
                          </Pressable>
                          <PlayFab playing={false} size={36} onPress={() => void playRecent(item, surah)} style={{ position: 'absolute', right: 8, bottom: 8 }} />
                        </View>
                        <Text style={{ color: ink.text, fontWeight: '700' }} numberOfLines={2}>{title}</Text>
                        <Text style={{ color: ink.muted, fontSize: 12 }} numberOfLines={1}>{t('playbackAyah', { number: item.ayahInSurah })}</Text>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}
            <Text style={{ color: ink.text, fontSize: 22, fontWeight: '800', paddingHorizontal: 16 }}>{t('allSurahs')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => openSurah(item.number)} style={{ minHeight: 72, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Cover seed={item.number} label={item.name} size={56} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: ink.text, fontWeight: '700', fontSize: 16 }} numberOfLines={1}>{item.number}. {item.englishNameTranslation}</Text>
              <Text style={{ color: ink.muted, marginTop: 2 }} numberOfLines={1}>{surahFacts(item, t)}</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}
