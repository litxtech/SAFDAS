import AsyncStorage from '@react-native-async-storage/async-storage';
import { translate, useI18nStore } from '@/i18n';

export type SurahSummary = {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: string;
};

export type Ayah = {
  number: number;
  numberInSurah: number;
  text: string;
  translationTr: string;
  translationEn: string;
};

const BASE = 'https://api.alquran.cloud/v1';

async function cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const existing = await AsyncStorage.getItem(key);
  if (existing) return JSON.parse(existing) as T;
  const value = await loader();
  await AsyncStorage.setItem(key, JSON.stringify(value));
  return value;
}

export function fetchSurahList() {
  return cached('safdas:quran:surahs', async () => {
    const response = await fetch(`${BASE}/surah`);
    if (!response.ok) throw new Error(translate(useI18nStore.getState().locale, 'quranListError'));
    const json = (await response.json()) as { data: SurahSummary[] };
    return json.data;
  });
}

export function fetchSurah(number: number) {
  return cached(`safdas:quran:surah:${number}`, async () => {
    const response = await fetch(`${BASE}/surah/${number}/editions/quran-uthmani,tr.diyanet,en.sahih`);
    if (!response.ok) throw new Error(translate(useI18nStore.getState().locale, 'quranTextError'));
    const json = (await response.json()) as {
      data: [{ ayahs: { number: number; numberInSurah: number; text: string }[] }, { ayahs: { text: string }[] }, { ayahs: { text: string }[] }];
    };
    const [arabic, turkish, english] = json.data;
    return arabic.ayahs.map((ayah, index): Ayah => ({
      number: ayah.number,
      numberInSurah: ayah.numberInSurah,
      text: ayah.text,
      translationTr: turkish?.ayahs[index]?.text ?? '',
      translationEn: english?.ayahs[index]?.text ?? '',
    }));
  });
}

export function audioUrl(globalAyah: number) {
  return `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${globalAyah}.mp3`;
}
