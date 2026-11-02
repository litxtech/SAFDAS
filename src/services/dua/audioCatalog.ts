import { readCached, refreshCached } from '@/services/remoteStore';

const CATALOGUE_URL = 'https://opendua.org/v0.0.4/catalogue.json';
const CACHE_KEY = 'safdas:duas:opendua-audio:v2';
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type DuaAudioClip = {
  url: string;
  reciterId: string;
  durationSeconds?: number;
};

export type DuaAudioIndex = {
  byArabic: Record<string, DuaAudioClip>;
  byPrefix: Record<string, DuaAudioClip>;
  /** Hisn al-Muslim source reference → clip (e.g. "75"). */
  bySource: Record<string, DuaAudioClip>;
  syncedAt: number;
  version: string;
};

type RawRecording = {
  id?: string;
  reciterId?: string;
  url?: string;
  durationSeconds?: number;
};

type RawDua = {
  id?: string;
  arabic?: string;
};

type RawStep = {
  type?: string;
  items?: { dua?: RawDua }[];
  recordings?: RawRecording[];
};

type RawEntry = {
  id?: string;
  chapterId?: string;
  sourceReference?: string;
  variations?: { steps?: RawStep[] }[];
};

type RawCatalogue = {
  dataVersion?: string;
  entries?: RawEntry[];
};

export function arabicKey(text: string) {
  return text
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '')
    .replace(/[أإآٱءؤئ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^\u0621-\u064A]/g, '');
}

function prefixKey(key: string) {
  return key.slice(0, 32);
}

function firstClip(entry: RawEntry): { clip: DuaAudioClip | null; arabics: string[] } {
  const arabics: string[] = [];
  let clip: DuaAudioClip | null = null;
  for (const variation of entry.variations ?? []) {
    for (const step of variation.steps ?? []) {
      if (step.type !== 'recitation') continue;
      for (const item of step.items ?? []) {
        const arabic = item.dua?.arabic?.trim();
        if (arabic) arabics.push(arabic);
      }
      const recording = (step.recordings ?? []).find((item) => item.url);
      if (recording?.url && !clip) {
        clip = {
          url: recording.url,
          reciterId: recording.reciterId || 'reciter-0001',
          durationSeconds: recording.durationSeconds,
        };
      }
    }
  }
  return { clip, arabics };
}

function extractClips(catalogue: RawCatalogue): DuaAudioIndex {
  const byArabic: Record<string, DuaAudioClip> = {};
  const byPrefix: Record<string, DuaAudioClip> = {};
  const bySource: Record<string, DuaAudioClip> = {};

  for (const entry of catalogue.entries ?? []) {
    const { clip, arabics } = firstClip(entry);
    if (!clip) continue;
    const source = entry.sourceReference?.trim();
    if (source && !bySource[source]) bySource[source] = clip;
    for (const arabic of arabics) {
      const key = arabicKey(arabic);
      if (!key) continue;
      if (!byArabic[key]) byArabic[key] = clip;
      const prefix = prefixKey(key);
      if (prefix && !byPrefix[prefix]) byPrefix[prefix] = clip;
    }
  }

  return {
    byArabic,
    byPrefix,
    bySource,
    syncedAt: Date.now(),
    version: catalogue.dataVersion || '0.0.4',
  };
}

export async function syncDuaAudioIndex() {
  return refreshCached(CACHE_KEY, TTL_MS, async () => {
    const response = await fetch(CATALOGUE_URL);
    if (!response.ok) throw new Error('dua_audio_unavailable');
    const catalogue = (await response.json()) as RawCatalogue;
    return extractClips(catalogue);
  });
}

export async function readDuaAudioIndex() {
  return readCached<DuaAudioIndex>(CACHE_KEY);
}

function sourceKeys(raw: string) {
  const value = raw.trim();
  if (!value) return [];
  const keys = [value];
  const digits = value.match(/^\d+/)?.[0];
  if (digits && digits !== value) keys.push(digits);
  return keys;
}

export function lookupDuaAudio(
  arabic: string,
  index: DuaAudioIndex | null | undefined,
  place?: { categoryNumber?: string | null; number?: string | null },
): DuaAudioClip | null {
  if (!index) return null;

  if (place?.number) {
    for (const key of sourceKeys(place.number)) {
      const clip = index.bySource[key];
      if (clip) return clip;
    }
  }

  if (!arabic.trim()) return null;
  const key = arabicKey(arabic);
  if (!key) return null;
  return index.byArabic[key] ?? index.byPrefix[prefixKey(key)] ?? null;
}
