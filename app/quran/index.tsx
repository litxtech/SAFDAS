import { useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Screen } from '@/components/layout/Screen';
import { AppErrorState } from '@/components/ui/AppErrorState';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppSearchBar } from '@/components/ui/AppSearchBar';
import { useT } from '@/i18n';
import { fetchSurahList } from '@/services/quran';
import { useTheme } from '@/theme/ThemeProvider';

export default function QuranIndex() {
  const { colors } = useTheme();
  const t = useT();
  const [search, setSearch] = useState('');
  const query = useQuery({ queryKey: ['surahs'], queryFn: fetchSurahList });
  const data = (query.data ?? []).filter((surah) => {
    const haystack = `${surah.englishName} ${surah.name} ${surah.number}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  return (
    <Screen padded={false}>
      <FlatList
        data={data}
        keyExtractor={(item) => String(item.number)}
        contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 32 }}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 8 }}>
            <AppHeader title={t('quran')} subtitle={t('quranSubtitle')} />
            <AppSearchBar value={search} onChangeText={setSearch} placeholder={t('searchSurah')} />
            {query.error ? <AppErrorState message={(query.error as Error).message} onRetry={() => void query.refetch()} /> : null}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push({ pathname: '/quran/[surah]', params: { surah: String(item.number) } })} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider, flexDirection: 'row', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{item.number}. {item.englishName}</Text>
              <Text style={{ color: colors.textSecondary }}>{item.englishNameTranslation} · {t('ayahCount', { count: item.numberOfAyahs })}</Text>
            </View>
            <Text style={{ color: colors.primary, fontSize: 20 }}>{item.name}</Text>
          </Pressable>
        )}
      />
    </Screen>
  );
}
