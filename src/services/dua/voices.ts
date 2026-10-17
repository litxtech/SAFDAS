import { localDuaUri } from '@/services/offline/resolve';
import { audioUrl, RECITERS, type Reciter } from '@/services/quran/reciters';

export type DuaVoice =
  | {
      id: string;
      kind: 'opendua';
      name: string;
      arabicName: string;
      subtitleKey: 'duaVoiceHisn';
    }
  | {
      id: string;
      kind: 'quran';
      name: string;
      arabicName: string;
      subtitleKey: 'duaVoiceQuran';
      reciterId: string;
    };

const JUMAH: DuaVoice = {
  id: 'opendua:jumah',
  kind: 'opendua',
  name: 'Muhammad Jumah',
  arabicName: 'محمد جمعة',
  subtitleKey: 'duaVoiceHisn',
};

function fromReciter(reciter: Reciter): DuaVoice {
  return {
    id: `quran:${reciter.id}`,
    kind: 'quran',
    name: reciter.name,
    arabicName: reciter.arabicName,
    subtitleKey: 'duaVoiceQuran',
    reciterId: reciter.id,
  };
}

export const DEFAULT_DUA_VOICE_ID = JUMAH.id;

export const DUA_VOICES: DuaVoice[] = [JUMAH, ...RECITERS.map(fromReciter)];

export function getDuaVoice(id: string | null | undefined) {
  return DUA_VOICES.find((voice) => voice.id === id) ?? JUMAH;
}

/** Known named duas → global ayah number (islamic.network CDN). */
export const DUA_AYAH_BY_SLUG: Record<string, number> = {
  kursi: 262,
  'ayat-al-kursi': 262,
  ayatalkursi: 262,
  fatiha: 1,
};

/** Slug fragments → surah number (first ayah used for CDN). */
const DUA_SURAH_BY_SLUG: Record<string, number> = {
  fatiha: 1,
  ikhlas: 112,
  ihklas: 112,
  falaq: 113,
  nas: 114,
  yasin: 36,
  'ya-sin': 36,
  mulk: 67,
  kahf: 18,
  rahman: 55,
  waqiah: 56,
  sajdah: 32,
  secde: 32,
};

const AYAH_REF = /(?:qur'?an|kur'?an|القرآن)?\s*(\d{1,3})\s*[:：]\s*(\d{1,3})/i;

export function parseAyahRef(source: string | null | undefined): { surah: number; ayah: number } | null {
  if (!source) return null;
  const match = source.match(AYAH_REF);
  if (!match) return null;
  const surah = Number(match[1]);
  const ayah = Number(match[2]);
  if (!Number.isFinite(surah) || !Number.isFinite(ayah) || surah < 1 || surah > 114 || ayah < 1) return null;
  return { surah, ayah };
}

/** Approximate global ayah from surah:ayah using standard counts (for CDN URLs). */
const SURAH_AYAHS = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135, 112, 78, 118, 64, 77, 227, 93, 88,
  69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13,
  14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21,
  11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6,
] as const;

export function globalAyahNumber(surah: number, ayah: number) {
  if (surah < 1 || surah > 114 || ayah < 1) return null;
  let total = 0;
  for (let index = 0; index < surah - 1; index += 1) total += SURAH_AYAHS[index] ?? 0;
  const max = SURAH_AYAHS[surah - 1] ?? 0;
  if (ayah > max) return null;
  return total + ayah;
}

export type DuaAudioResolveInput = {
  voiceId: string;
  openDuaUrl?: string | null;
  audioUrl?: string | null;
  ayahNumber?: number | null;
  slug?: string | null;
  source?: string | null;
  arabic?: string | null;
  categoryNumber?: string | null;
};

/** Resolve a global ayah so Quran reciters can swap voices for Qur’anic duas. */
export function resolveDuaAyahNumber(input: Omit<DuaAudioResolveInput, 'voiceId' | 'openDuaUrl' | 'audioUrl'>) {
  if (typeof input.ayahNumber === 'number' && input.ayahNumber > 0) return input.ayahNumber;

  const slug = (input.slug ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (slug && DUA_AYAH_BY_SLUG[slug]) return DUA_AYAH_BY_SLUG[slug] ?? null;
  for (const [key, value] of Object.entries(DUA_AYAH_BY_SLUG)) {
    if (slug.includes(key)) return value;
  }
  for (const [key, surah] of Object.entries(DUA_SURAH_BY_SLUG)) {
    if (slug === key || slug.includes(key)) {
      const first = globalAyahNumber(surah, 1);
      if (first) return first;
    }
  }

  const surahCat = input.categoryNumber?.match(/^surah:(\d{1,3})$/i);
  if (surahCat) {
    const first = globalAyahNumber(Number(surahCat[1]), 1);
    if (first) return first;
  }

  const ref = parseAyahRef(input.source);
  if (ref) {
    const global = globalAyahNumber(ref.surah, ref.ayah);
    if (global) return global;
  }

  return null;
}

export function resolveDuaAudioUrl(input: DuaAudioResolveInput) {
  const voice = getDuaVoice(input.voiceId);
  const ayah = resolveDuaAyahNumber(input);
  const remote = input.openDuaUrl ?? input.audioUrl ?? null;
  const localOrRemote = localDuaUri(remote) ?? remote;

  if (voice.kind === 'quran') {
    // Always prefer the selected Qur’an reciter when an ayah is known —
    // never keep serving the OpenDua/Jumah clip under another name.
    if (ayah) return audioUrl(ayah, voice.reciterId);
    // Pure Hisn duas have only Jumah on OpenDua; keep that as last resort.
    return localOrRemote;
  }

  // OpenDua (Jumah) voice: Hisn clip first, then Qur’an ayah fallback.
  if (localOrRemote) return localOrRemote;
  if (ayah) return audioUrl(ayah, 'ar.alafasy');
  return null;
}

export function duaVoiceArtist(voiceId: string) {
  return getDuaVoice(voiceId).name;
}
