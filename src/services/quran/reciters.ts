import { localQuranUri } from '@/services/offline/resolve';

export type Reciter = {
  id: string;
  edition: string;
  bitrate: number;
  name: string;
  arabicName: string;
};

const ALAFASY: Reciter = {
  id: 'ar.alafasy',
  edition: 'ar.alafasy',
  bitrate: 128,
  name: 'Mishary Rashid Alafasy',
  arabicName: 'مشاري العفاسي',
};

export const DEFAULT_RECITER_ID = ALAFASY.id;

/** islamic.network CDN’de doğrulanmış ayet sesleri. */
export const RECITERS: Reciter[] = [
  ALAFASY,
  { id: 'ar.abdurrahmaansudais', edition: 'ar.abdurrahmaansudais', bitrate: 192, name: 'Abdurrahman As-Sudais', arabicName: 'عبدالرحمن السديس' },
  { id: 'ar.mahermuaiqly', edition: 'ar.mahermuaiqly', bitrate: 128, name: 'Maher Al Muaiqly', arabicName: 'ماهر المعيقلي' },
  { id: 'ar.minshawi', edition: 'ar.minshawi', bitrate: 128, name: 'Muhammad Siddiq Al-Minshawi', arabicName: 'محمد صديق المنشاوي' },
  { id: 'ar.husary', edition: 'ar.husary', bitrate: 128, name: 'Mahmud Khalil Al-Husary', arabicName: 'محمود خليل الحصري' },
  { id: 'ar.husarymujawwad', edition: 'ar.husarymujawwad', bitrate: 128, name: 'Al-Husary (Mujawwad)', arabicName: 'الحصري (المجود)' },
  { id: 'ar.hudhaify', edition: 'ar.hudhaify', bitrate: 128, name: 'Ali Al-Hudhaify', arabicName: 'علي الحذيفي' },
  { id: 'ar.ahmedajamy', edition: 'ar.ahmedajamy', bitrate: 128, name: 'Ahmed Al-Ajmy', arabicName: 'أحمد العجمي' },
  { id: 'ar.shaatree', edition: 'ar.shaatree', bitrate: 128, name: 'Abu Bakr Ash-Shatri', arabicName: 'أبو بكر الشاطري' },
  { id: 'ar.saoodshuraym', edition: 'ar.saoodshuraym', bitrate: 64, name: 'Saud Ash-Shuraym', arabicName: 'سعود الشريم' },
  { id: 'ar.abdulbasitmurattal', edition: 'ar.abdulbasitmurattal', bitrate: 192, name: 'Abdulbasit Abdussamad', arabicName: 'عبدالباسط عبدالصمد' },
  { id: 'ar.abdulsamad', edition: 'ar.abdulsamad', bitrate: 64, name: 'Abdulbasit (Mujawwad)', arabicName: 'عبدالباسط (المجود)' },
  { id: 'ar.abdullahbasfar', edition: 'ar.abdullahbasfar', bitrate: 128, name: 'Abdullah Basfar', arabicName: 'عبد الله بصفر' },
  { id: 'ar.hanirifai', edition: 'ar.hanirifai', bitrate: 128, name: 'Hani Rifai', arabicName: 'هاني الرفاعي' },
  { id: 'ar.muhammadayyoub', edition: 'ar.muhammadayyoub', bitrate: 128, name: 'Muhammad Ayyoub', arabicName: 'محمد أيوب' },
  { id: 'ar.muhammadjibreel', edition: 'ar.muhammadjibreel', bitrate: 128, name: 'Muhammad Jibreel', arabicName: 'محمد جبريل' },
  { id: 'ar.aymanswoaid', edition: 'ar.aymanswoaid', bitrate: 64, name: 'Ayman Sowaid', arabicName: 'أيمن سويد' },
];

export const QURAN_AYAH_COUNT = 6236;

export function getReciter(id: string | null | undefined) {
  return RECITERS.find((item) => item.id === id) ?? ALAFASY;
}

export function remoteAudioUrl(globalAyah: number, reciterId: string) {
  const reciter = getReciter(reciterId);
  return `https://cdn.islamic.network/quran/audio/${reciter.bitrate}/${reciter.edition}/${globalAyah}.mp3`;
}

/** Yerel dosya varsa onu, yoksa CDN adresini döner. */
export function audioUrl(globalAyah: number, reciterId: string) {
  return localQuranUri(reciterId, globalAyah) ?? remoteAudioUrl(globalAyah, reciterId);
}

export function estimateQuranPackBytes(reciterId: string) {
  const reciter = getReciter(reciterId);
  // ~120 KB ortalama ayet @128 kbps
  return Math.round(QURAN_AYAH_COUNT * 120_000 * (reciter.bitrate / 128));
}
