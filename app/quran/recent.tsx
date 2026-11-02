import { FlatList, Pressable, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Cover, ListenBack, TrackRow, coverFor, ink } from '@/components/listen/chrome';
import { dateLocale, useI18nStore, useT } from '@/i18n';
import { fetchSurahList } from '@/services/quran';
import { goQuranHome, openSurah } from '@/services/quran/nav';
import { useListenHistory, type RecentListen } from '@/stores/listenHistoryStore';

export default function RecentListensScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const locale = useI18nStore((state) => state.locale);
  const items = useListenHistory((state) => state.items);
  const query = useQuery({ queryKey: ['surahs', locale], queryFn: () => fetchSurahList(locale), staleTime: 60_000 });
  const pair = coverFor('recent');

  function open(item: RecentListen) {
    openSurah(item.surahNumber, item.ayahInSurah, { replace: true });
  }

  return (
    <View style={{ flex: 1, backgroundColor: ink.canvas }}>
      <StatusBar style="light" />
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.surahNumber)}
        contentContainerStyle={{ paddingBottom: 120, flexGrow: 1 }}
        ListHeaderComponent={
          <LinearGradient colors={[pair[0], ink.canvas]} style={{ paddingTop: insets.top + 4, paddingHorizontal: 16, paddingBottom: 18, gap: 14 }}>
            <ListenBack onPress={goQuranHome} />
            <Cover seed="recent" label={t('recentListens')} size={180} />
            <Text style={{ color: ink.text, fontSize: 28, fontWeight: '800' }}>{t('recentListens')}</Text>
            {!items.length ? <Text style={{ color: ink.muted, lineHeight: 20 }}>{t('recentListensEmptyBody')}</Text> : null}
          </LinearGradient>
        }
        renderItem={({ item, index }) => {
          const surah = query.data?.find((entry) => entry.number === item.surahNumber);
          const title = surah ? `${surah.number}. ${surah.englishNameTranslation}` : t('surahTitle', { number: item.surahNumber });
          const when = new Date(item.listenedAt).toLocaleString(dateLocale(locale), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
          return (
            <TrackRow
              index={index + 1}
              title={title}
              subtitle={`${t('playbackAyah', { number: item.ayahInSurah })} · ${when}`}
              onPress={() => open(item)}
              trailing={surah ? <Text style={{ color: ink.muted, fontSize: 18 }}>{surah.name}</Text> : <View />}
            />
          );
        }}
      />
    </View>
  );
}
