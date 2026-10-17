import { AppState } from 'react-native';
import { create } from 'zustand';
import { translate, useI18nStore } from '@/i18n';
import {
  currentTrack,
  pausePlayback,
  playAdjacent as engineAdjacent,
  playQueue,
  prefetchAdjacent,
  setQuranEdgeHandler,
  setTrackUriResolver,
  stopPlayback,
  togglePlayback,
  useAudioEngine,
  type PlayableTrack,
  type QuranEdgeReason,
} from '@/services/audio/engine';
import { fetchSurah, fetchSurahList } from '@/services/quran';
import { audioUrl, getReciter, remoteAudioUrl } from '@/services/quran/reciters';
import { useReadingStore, type ContinueSpan } from '@/stores/readingStore';
import { useReciterStore } from '@/stores/reciterStore';

export type QuranAyahRef = { number: number; numberInSurah: number };

const SPAN_MS: Record<ContinueSpan, number | null> = {
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '2h': 2 * 60 * 60 * 1000,
  '3h': 3 * 60 * 60 * 1000,
  forever: null,
};

const PAUSE_SETTLE_MS = 800;
const PREFETCH_TAIL = 3;

type PlayerState = {
  surahNumber: number | null;
  surahTitle: string;
  ayahInSurah: number | null;
  playing: boolean;
  currentTime: number;
  duration: number;
};

export const useQuranPlayer = create<PlayerState>(() => ({
  surahNumber: null,
  surahTitle: '',
  ayahInSurah: null,
  playing: false,
  currentTime: 0,
  duration: 0,
}));

let accumulatedMs = 0;
let playingSince: number | null = null;
let pauseTimer: ReturnType<typeof setTimeout> | null = null;
let limitTimer: ReturnType<typeof setTimeout> | null = null;
let edgeToken = 0;
let prefetchToken = 0;
let nextSurahCache: {
  number: number;
  title: string;
  ayahs: QuranAyahRef[];
  locale: string;
} | null = null;

function currentSpan(): ContinueSpan {
  const value = useReadingStore.getState().continueSpan;
  if (value && value in SPAN_MS) return value;
  return 'forever';
}

function limitMs() {
  return SPAN_MS[currentSpan()];
}

function elapsedMs(now = Date.now()) {
  return accumulatedMs + (playingSince != null ? now - playingSince : 0);
}

export function continueRemainingMs(now = Date.now()) {
  const limit = limitMs();
  if (limit == null) return null;
  return Math.max(0, limit - elapsedMs(now));
}

function sessionOpen(now = Date.now()) {
  const limit = limitMs();
  if (limit == null) return true;
  return elapsedMs(now) < limit;
}

function clearLimitTimer() {
  if (!limitTimer) return;
  clearTimeout(limitTimer);
  limitTimer = null;
}

function clearPauseTimer() {
  if (!pauseTimer) return;
  clearTimeout(pauseTimer);
  pauseTimer = null;
}

function resetSession() {
  accumulatedMs = 0;
  playingSince = null;
  clearPauseTimer();
  clearLimitTimer();
}

function armLimit() {
  clearLimitTimer();
  const remain = continueRemainingMs();
  if (remain == null) return;
  limitTimer = setTimeout(() => expireSession(), remain);
}

function expireSession() {
  clearLimitTimer();
  const limit = limitMs();
  if (limit == null || elapsedMs() + 250 < limit) return;
  accumulatedMs = limit;
  playingSince = null;
  clearPauseTimer();
  pausePlayback();
}

function settlePause() {
  if (pauseTimer || playingSince == null) return;
  pauseTimer = setTimeout(() => {
    pauseTimer = null;
    const state = useAudioEngine.getState();
    const live = state.queue[state.index]?.kind === 'quran' && state.playing;
    if (live || playingSince == null) return;
    accumulatedMs += Date.now() - playingSince;
    playingSince = null;
    clearLimitTimer();
  }, PAUSE_SETTLE_MS);
}

function syncSession(playing: boolean) {
  if (playing) {
    clearPauseTimer();
    if (playingSince == null) {
      const limit = limitMs();
      if (limit != null && accumulatedMs >= limit) accumulatedMs = 0;
      playingSince = Date.now();
      armLimit();
      return;
    }
    if (!sessionOpen()) expireSession();
    return;
  }
  settlePause();
}

useAudioEngine.subscribe((state) => {
  const track = state.queue[state.index];
  if (!track || track.kind !== 'quran') {
    useQuranPlayer.setState({ playing: false, surahNumber: null, ayahInSurah: null, currentTime: 0, duration: 0 });
    if (playingSince != null || accumulatedMs > 0) resetSession();
    return;
  }
  useQuranPlayer.setState({
    surahNumber: track.surahNumber ?? null,
    surahTitle: track.title,
    ayahInSurah: track.ayahInSurah ?? null,
    playing: state.playing,
    currentTime: state.currentTime,
    duration: state.duration,
  });
  syncSession(state.playing);
  maybePrefetchNextSurah(state);
});

AppState.addEventListener('change', (next) => {
  if (next !== 'active') return;
  const state = useAudioEngine.getState();
  const track = state.queue[state.index];
  if (track?.kind !== 'quran' || !state.playing) return;
  if (!sessionOpen()) expireSession();
  else armLimit();
});

function neighborSurah(current: number, direction: -1 | 1) {
  const next = current + direction;
  if (next > 114 || next < 1) return null;
  return next;
}

function maybePrefetchNextSurah(state: { queue: PlayableTrack[]; index: number; playing: boolean }) {
  if (!state.playing) return;
  if (useReadingStore.getState().autoNextSurah === false) return;
  const track = state.queue[state.index];
  if (!track || track.kind !== 'quran' || !track.surahNumber) return;
  if (state.index < state.queue.length - PREFETCH_TAIL) return;
  const nextNumber = neighborSurah(track.surahNumber, 1);
  if (nextNumber == null) return;
  const locale = useI18nStore.getState().locale;
  if (nextSurahCache?.number === nextNumber && nextSurahCache.locale === locale) {
    prefetchAdjacent();
    return;
  }
  const token = ++prefetchToken;
  void (async () => {
    try {
      const [ayahs, list] = await Promise.all([
        fetchSurah(nextNumber, locale),
        fetchSurahList(locale).catch(() => null),
      ]);
      if (token !== prefetchToken) return;
      const summary = list?.find((item) => item.number === nextNumber);
      const title = summary
        ? `${summary.number}. ${summary.englishNameTranslation}`
        : translate(locale, 'surahTitle', { number: nextNumber });
      nextSurahCache = {
        number: nextNumber,
        title,
        ayahs: ayahs.map((ayah) => ({ number: ayah.number, numberInSurah: ayah.numberInSurah })),
        locale,
      };
    } catch {
      /* best-effort */
    }
  })();
}

async function queueSurah(input: { surahNumber: number; surahTitle: string; ayahs: QuranAyahRef[]; ayahNumber: number }) {
  const reciter = getReciter(useReciterStore.getState().id);
  // Build the queue with CDN URIs only — local files are resolved just-in-time in the audio engine.
  const queue: PlayableTrack[] = input.ayahs.map((ayah) => ({
    id: `ayah:${reciter.id}:${ayah.number}`,
    uri: remoteAudioUrl(ayah.number, reciter.id),
    title: `${input.surahTitle} · ${ayah.numberInSurah}`,
    artist: reciter.name,
    kind: 'quran',
    surahNumber: input.surahNumber,
    ayahInSurah: ayah.numberInSurah,
    ayahNumber: ayah.number,
  }));
  const start = Math.max(0, input.ayahs.findIndex((item) => item.number === input.ayahNumber));
  await playQueue(queue, start);
}

export async function selectReciter(reciterId: string) {
  const reciter = getReciter(reciterId);
  const previous = useReciterStore.getState().id;
  useReciterStore.getState().setId(reciter.id);
  if (previous === reciter.id) return;
  const { queue, index } = useAudioEngine.getState();
  const current = queue[index];
  if (!current || current.kind !== 'quran' || current.ayahNumber == null) return;
  // Remap without sync filesystem scans (that froze the reader on long surahs).
  const next = queue.map((item) => {
    if (item.kind !== 'quran' || item.ayahNumber == null) return item;
    return {
      ...item,
      id: `ayah:${reciter.id}:${item.ayahNumber}`,
      uri: remoteAudioUrl(item.ayahNumber, reciter.id),
      artist: reciter.name,
    };
  });
  await playQueue(next, index);
}

setTrackUriResolver((track) => {
  if (track.kind !== 'quran' || track.ayahNumber == null) return track.uri;
  return audioUrl(track.ayahNumber, useReciterStore.getState().id);
});

export async function playSurahAyah(input: { surahNumber: number; surahTitle: string; ayahs: QuranAyahRef[]; ayahNumber: number }) {
  edgeToken += 1;
  nextSurahCache = null;
  await queueSurah(input);
}

async function moveSurah(direction: -1 | 1, reason: QuranEdgeReason) {
  const current = currentTrack();
  if (!current || current.kind !== 'quran' || !current.surahNumber) return false;

  if (reason === 'finish') {
    if (useReadingStore.getState().autoNextSurah === false) return false;
    if (!sessionOpen()) {
      expireSession();
      return true;
    }
  } else if (!sessionOpen()) {
    expireSession();
    return true;
  }

  const number = neighborSurah(current.surahNumber, direction);
  if (number == null) return false;

  const token = ++edgeToken;
  const locale = useI18nStore.getState().locale;

  try {
    let title: string;
    let ayahs: QuranAyahRef[];

    if (nextSurahCache?.number === number && nextSurahCache.locale === locale) {
      title = nextSurahCache.title;
      ayahs = nextSurahCache.ayahs;
      nextSurahCache = null;
    } else {
      const [fetched, list] = await Promise.all([
        fetchSurah(number, locale),
        fetchSurahList(locale).catch(() => null),
      ]);
      if (token !== edgeToken) return true;
      if (reason === 'finish' && !sessionOpen()) {
        expireSession();
        return true;
      }
      const summary = list?.find((item) => item.number === number);
      title = summary
        ? `${summary.number}. ${summary.englishNameTranslation}`
        : translate(locale, 'surahTitle', { number });
      ayahs = fetched.map((ayah) => ({ number: ayah.number, numberInSurah: ayah.numberInSurah }));
    }

    if (token !== edgeToken) return true;
    if (reason === 'finish' && useReadingStore.getState().autoNextSurah === false) return false;
    if (reason === 'finish' && !sessionOpen()) {
      expireSession();
      return true;
    }

    const target = direction === 1 ? ayahs[0] : ayahs[ayahs.length - 1];
    if (!target) return false;

    await queueSurah({
      surahNumber: number,
      surahTitle: title,
      ayahs,
      ayahNumber: target.number,
    });
    return true;
  } catch {
    return token === edgeToken ? false : true;
  }
}

setQuranEdgeHandler((direction, reason) => moveSurah(direction, reason));

export function selectContinueSpan(span: ContinueSpan) {
  useReadingStore.getState().setContinueSpan(span);
  accumulatedMs = 0;
  clearLimitTimer();
  const state = useAudioEngine.getState();
  const quran = state.queue[state.index]?.kind === 'quran';
  if (quran && state.playing) {
    playingSince = Date.now();
    armLimit();
    return;
  }
  playingSince = null;
}

export function selectAutoNextSurah(enabled: boolean) {
  useReadingStore.getState().setAutoNextSurah(enabled);
}

export async function playAdjacent(direction: -1 | 1) {
  await engineAdjacent(direction);
}

export function toggleQuranPlayback() {
  togglePlayback();
}

export function stopQuranPlayback() {
  edgeToken += 1;
  nextSurahCache = null;
  stopPlayback();
}
