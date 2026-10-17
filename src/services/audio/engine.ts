import { AppState, Platform } from 'react-native';
import { Asset } from 'expo-asset';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioStatus } from 'expo-audio';
import { create } from 'zustand';
import { rememberQuranListen } from '@/stores/listenHistoryStore';
import { usePrayerStore } from '@/stores/prayerStore';

export type RepeatMode = 'off' | 'all' | 'one';
export type PlaybackRate = 0.75 | 1 | 1.25 | 1.5;
export type QuranEdgeReason = 'finish' | 'skip';

export type PlayableTrack = {
  id: string;
  uri: string;
  title: string;
  artist: string;
  kind: 'quran' | 'dua';
  surahNumber?: number;
  ayahInSurah?: number;
  ayahNumber?: number;
  duaId?: string;
  duaSlug?: string;
  openDuaUrl?: string | null;
};

type EngineState = {
  queue: PlayableTrack[];
  index: number;
  playing: boolean;
  loading: boolean;
  currentTime: number;
  duration: number;
  repeatMode: RepeatMode;
  playbackRate: PlaybackRate;
  error: string | null;
};

export const PLAYBACK_RATES: PlaybackRate[] = [0.75, 1, 1.25, 1.5];

export const useAudioEngine = create<EngineState>(() => ({
  queue: [],
  index: 0,
  playing: false,
  loading: false,
  currentTime: 0,
  duration: 0,
  repeatMode: 'off',
  playbackRate: 1,
  error: null,
}));

let player: AudioPlayer | null = null;
let warm: AudioPlayer | null = null;
let warmUri: string | null = null;
let advancing = false;
let startGeneration = 0;
let artworkUrl: string | null = null;
let onQuranEdge: ((direction: -1 | 1, reason: QuranEdgeReason) => Promise<boolean>) | null = null;
let statusSub: { remove: () => void } | null = null;

const MAX_RETRIES = 2;
const RETRY_BASE_MS = 280;

export function setQuranEdgeHandler(
  handler: ((direction: -1 | 1, reason: QuranEdgeReason) => Promise<boolean>) | null,
) {
  onQuranEdge = handler;
}

export function currentTrack() {
  const state = useAudioEngine.getState();
  return state.queue[state.index] ?? null;
}

export function formatClock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const remain = total % 60;
  return `${minutes}:${remain.toString().padStart(2, '0')}`;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backgroundEnabled() {
  return usePrayerStore.getState().quranBackground;
}

async function applyMode() {
  await setAudioModeAsync({
    playsInSilentMode: true,
    interruptionMode: 'doNotMix',
    allowsRecording: false,
    shouldPlayInBackground: backgroundEnabled(),
    shouldRouteThroughEarpiece: false,
  });
}

async function artwork() {
  if (artworkUrl) return artworkUrl;
  const asset = Asset.fromModule(require('../../../assets/logo-mark.png'));
  await asset.downloadAsync();
  artworkUrl = asset.localUri ?? asset.uri;
  return artworkUrl;
}

async function showLockScreen(track: PlayableTrack) {
  if (!player) return;
  const cover = await artwork().catch(() => null);
  player.setActiveForLockScreen(
    true,
    { title: track.title, artist: track.artist, albumTitle: 'SAFDAŞ', artworkUrl: cover ?? undefined },
    { showSeekForward: true, showSeekBackward: true },
  );
}

function applyRate(target: AudioPlayer | null = player) {
  if (!target) return;
  const rate = useAudioEngine.getState().playbackRate;
  try {
    target.setPlaybackRate(rate, 'high');
  } catch {
    try {
      target.playbackRate = rate;
    } catch {
      /* ignore */
    }
  }
}

function bindStatus(target: AudioPlayer) {
  statusSub?.remove();
  statusSub = target.addListener('playbackStatusUpdate', onStatus);
}

function disposePlayer(target: AudioPlayer | null) {
  if (!target) return;
  try {
    target.pause();
  } catch {
    /* ignore */
  }
  try {
    target.clearLockScreenControls();
  } catch {
    /* ignore */
  }
  try {
    target.remove();
  } catch {
    /* ignore */
  }
}

function clearWarm() {
  disposePlayer(warm);
  warm = null;
  warmUri = null;
}

function createPlayer(uri: string, downloadFirst = false) {
  return createAudioPlayer(
    { uri },
    {
      updateInterval: 250,
      keepAudioSessionActive: backgroundEnabled(),
      downloadFirst,
    },
  );
}

function onStatus(status: AudioStatus) {
  useAudioEngine.setState({
    playing: status.playing,
    loading: status.isBuffering && !status.playing,
    currentTime: status.currentTime,
    duration: status.duration,
  });
  if (!status.didJustFinish || advancing) return;
  advancing = true;
  void advanceAfterFinish().finally(() => {
    advancing = false;
  });
}

async function advanceAfterFinish() {
  const { repeatMode, index, queue } = useAudioEngine.getState();
  const track = queue[index];
  if (repeatMode === 'one') {
    await startAt(index);
    return;
  }
  if (index < queue.length - 1) {
    await startAt(index + 1);
    return;
  }
  if (track?.kind === 'quran' && onQuranEdge) {
    const continued = await onQuranEdge(1, 'finish');
    if (continued) return;
  }
  if (repeatMode === 'all' && queue.length > 0) {
    await startAt(0);
    return;
  }
  useAudioEngine.setState({ playing: false, loading: false });
}

async function warmNext(fromIndex?: number) {
  const state = useAudioEngine.getState();
  const index = fromIndex ?? state.index;
  const next = state.queue[index + 1];
  if (!next?.uri) {
    clearWarm();
    return;
  }
  if (warmUri === next.uri && warm) return;
  clearWarm();
  try {
    warm = createPlayer(next.uri, true);
    warmUri = next.uri;
    warm.volume = 0;
    warm.loop = false;
  } catch {
    clearWarm();
  }
}

async function promoteWarm(track: PlayableTrack, generation: number) {
  if (!warm || warmUri !== track.uri) return false;
  const nextPlayer = warm;
  warm = null;
  warmUri = null;
  const previous = player;
  player = nextPlayer;
  player.volume = 1;
  player.loop = false;
  bindStatus(player);
  applyRate(player);
  await showLockScreen(track);
  if (generation !== startGeneration) return true;
  player.play();
  useAudioEngine.setState({ loading: false, playing: true, error: null });
  if (previous && previous !== player) {
    try {
      previous.pause();
    } catch {
      /* ignore */
    }
    try {
      previous.clearLockScreenControls();
    } catch {
      /* ignore */
    }
    setTimeout(() => disposePlayer(previous), 120);
  }
  return true;
}

async function startAt(index: number) {
  const generation = ++startGeneration;
  const track = useAudioEngine.getState().queue[index];
  if (!track?.uri) {
    useAudioEngine.setState({ playing: false, loading: false, error: 'missing-audio' });
    return;
  }
  useAudioEngine.setState({ index, loading: true, error: null, currentTime: 0 });

  try {
    await applyMode();
    if (generation !== startGeneration) return;

    if (await promoteWarm(track, generation)) {
      if (track.kind === 'quran' && track.surahNumber && track.ayahInSurah) {
        rememberQuranListen({ surahNumber: track.surahNumber, ayahInSurah: track.ayahInSurah });
      }
      if (generation === startGeneration) void warmNext(index);
      return;
    }

    let lastError: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      if (generation !== startGeneration) return;
      try {
        if (!player) {
          player = createPlayer(track.uri, false);
          bindStatus(player);
        } else {
          player.replace({ uri: track.uri });
        }
        player.loop = false;
        player.volume = 1;
        applyRate(player);
        await showLockScreen(track);
        if (generation !== startGeneration) return;
        player.play();
        useAudioEngine.setState({ loading: false, playing: true, error: null });
        if (track.kind === 'quran' && track.surahNumber && track.ayahInSurah) {
          rememberQuranListen({ surahNumber: track.surahNumber, ayahInSurah: track.ayahInSurah });
        }
        if (generation === startGeneration) void warmNext(index);
        return;
      } catch (error) {
        lastError = error;
        if (attempt < MAX_RETRIES) {
          await delay(RETRY_BASE_MS * (attempt + 1));
          disposePlayer(player);
          player = null;
          statusSub = null;
        }
      }
    }

    useAudioEngine.setState({
      loading: false,
      playing: false,
      error: lastError instanceof Error ? lastError.message : 'audio-error',
    });
  } catch (error) {
    if (generation !== startGeneration) return;
    useAudioEngine.setState({
      loading: false,
      playing: false,
      error: error instanceof Error ? error.message : 'audio-error',
    });
  }
}

export async function playQueue(queue: PlayableTrack[], startIndex = 0) {
  startGeneration += 1;
  advancing = false;
  clearWarm();
  const playable = queue.filter((track) => track.uri);
  if (!playable.length) {
    useAudioEngine.setState({ queue: [], playing: false, loading: false, error: 'missing-audio' });
    return;
  }
  const safeIndex = Math.max(0, Math.min(startIndex, playable.length - 1));
  useAudioEngine.setState({ queue: playable, index: safeIndex, error: null, currentTime: 0 });
  await startAt(safeIndex);
}

export function togglePlayback() {
  if (!player) return;
  if (player.playing) {
    pausePlayback();
    return;
  }
  void applyMode().finally(() => {
    if (!player) return;
    applyRate(player);
    player.play();
    useAudioEngine.setState({ playing: true, error: null });
  });
}

export function pausePlayback() {
  if (!player) return;
  player.pause();
  useAudioEngine.setState({ playing: false });
}

export async function playAdjacent(direction: -1 | 1) {
  const { index, queue, repeatMode } = useAudioEngine.getState();
  if (!queue.length) return;
  const next = index + direction;
  if (next >= 0 && next < queue.length) {
    await startAt(next);
    return;
  }
  const track = queue[index];
  if (track?.kind === 'quran' && onQuranEdge) {
    const continued = await onQuranEdge(direction, 'skip');
    if (continued) return;
  }
  if (repeatMode === 'all' && queue.length > 0) {
    await startAt(direction === 1 ? 0 : queue.length - 1);
    return;
  }
  await startAt(direction === 1 ? queue.length - 1 : 0);
}

export async function seekPlayback(seconds: number) {
  if (!player) return;
  await player.seekTo(Math.max(0, seconds));
}

export function setRepeatMode(repeatMode: RepeatMode) {
  useAudioEngine.setState({ repeatMode });
}

export function cycleRepeatMode() {
  const order: RepeatMode[] = ['off', 'all', 'one'];
  const current = useAudioEngine.getState().repeatMode;
  const next = order[(order.indexOf(current) + 1) % order.length] ?? 'off';
  useAudioEngine.setState({ repeatMode: next });
}

export function setPlaybackRate(rate: PlaybackRate) {
  useAudioEngine.setState({ playbackRate: rate });
  applyRate(player);
}

export function cyclePlaybackRate() {
  const current = useAudioEngine.getState().playbackRate;
  const at = PLAYBACK_RATES.indexOf(current);
  const next = PLAYBACK_RATES[(at + 1) % PLAYBACK_RATES.length] ?? 1;
  setPlaybackRate(next);
}

export function stopPlayback() {
  startGeneration += 1;
  advancing = false;
  clearWarm();
  player?.pause();
  player?.clearLockScreenControls();
  useAudioEngine.setState({
    playing: false,
    loading: false,
    queue: [],
    index: 0,
    currentTime: 0,
    duration: 0,
    error: null,
  });
}

export async function retryPlayback() {
  await startAt(useAudioEngine.getState().index);
}

/** Warm the next queued URI early (used near surah edges). */
export function prefetchAdjacent() {
  void warmNext();
}

if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (next) => {
    if (next === 'active') return;
    if (!backgroundEnabled()) {
      player?.pause();
      useAudioEngine.setState({ playing: false });
    }
  });
}

usePrayerStore.subscribe((state, previous) => {
  if (state.quranBackground === previous.quranBackground) return;
  void applyMode();
  if (!state.quranBackground && AppState.currentState !== 'active') {
    player?.pause();
    useAudioEngine.setState({ playing: false });
  }
});
