import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/layout/Screen';
import { AppButton } from '@/components/ui/AppButton';
import { AppErrorState } from '@/components/ui/AppErrorState';
import { AppHeader } from '@/components/ui/AppHeader';
import { useI18nStore, useT } from '@/i18n';
import { requireSupabase } from '@/lib/supabase';
import { fetchSurah } from '@/services/quran';
import { playAdjacent, playSurahAyah, toggleQuranPlayback, useQuranPlayer } from '@/services/quran/playback';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { useTheme } from '@/theme/ThemeProvider';

export default function SurahScreen() {
  const { surah } = useLocalSearchParams<{ surah: string }>();
  const number = Number(surah);
  const { colors, name } = useTheme();
  const t = useT();
  const locale = useI18nStore((state) => state.locale);
  const userId = useAuthStore((state) => state.session?.user.id);
  const show = useToastStore((state) => state.show);
  const [size, setSize] = useState(26);
  const [selected, setSelected] = useState<number | null>(null);
  const player = useQuranPlayer();
  const query = useQuery({ queryKey: ['surah', number], queryFn: () => fetchSurah(number), enabled: Number.isFinite(number) });

  async function play(globalNumber: number) {
    if (!query.data) return;
    await playSurahAyah({
      surahNumber: number,
      surahTitle: t('surahTitle', { number }),
      ayahs: query.data.map((ayah) => ({ number: ayah.number, numberInSurah: ayah.numberInSurah })),
      ayahNumber: globalNumber,
    });
  }

  async function bookmark(ayah: number) {
    if (!userId) return;
    const { error } = await requireSupabase().from('quran_bookmarks').insert({ user_id: userId, surah_number: number, ayah_number: ayah });
    show(error ? error.message : t('ayahSaved'), error ? 'error' : 'success');
  }

  return (
    <Screen scroll>
      <AppHeader title={t('surahTitle', { number })} subtitle={t('quranLicense')} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <AppButton label="A-" variant="secondary" onPress={() => setSize((value) => Math.max(18, value - 2))} />
        <AppButton label="A+" variant="secondary" onPress={() => setSize((value) => Math.min(40, value + 2))} />
      </View>
      {player.surahNumber === number ? (
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <AppButton label={t('playbackPrevious')} variant="secondary" onPress={() => void playAdjacent(-1)} />
          <AppButton label={player.playing ? t('playbackPause') : t('playbackPlay')} onPress={toggleQuranPlayback} />
          <AppButton label={t('playbackNext')} variant="secondary" onPress={() => void playAdjacent(1)} />
        </View>
      ) : null}
      {query.error ? <AppErrorState message={(query.error as Error).message} onRetry={() => void query.refetch()} /> : null}
      {query.data?.map((ayah) => {
        const active = selected === ayah.numberInSurah;
        return (
          <Pressable
            key={ayah.number}
            onPress={() => setSelected(ayah.numberInSurah)}
            style={{ backgroundColor: active ? colors.primaryMuted : 'transparent', borderRadius: 16, padding: 12, gap: 8 }}
          >
            <Text style={{ color: name === 'dark' ? colors.text : colors.text, fontSize: size, lineHeight: size * 1.8, textAlign: 'right', writingDirection: 'rtl' }}>{ayah.text}</Text>
            {locale === 'ar' ? null : <Text style={{ color: colors.textSecondary, lineHeight: 22 }}>{ayah.numberInSurah}. {locale === 'en' ? ayah.translationEn : ayah.translationTr}</Text>}
            {active ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <AppButton label={t('listen')} onPress={() => void play(ayah.number)} />
                <AppButton label={t('save')} variant="secondary" onPress={() => void bookmark(ayah.numberInSurah)} />
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </Screen>
  );
}
