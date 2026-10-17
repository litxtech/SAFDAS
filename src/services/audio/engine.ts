import { AppState, Platform } from 'react-native';
import { Asset } from 'expo-asset';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioStatus } from 'expo-audio';
import { create } from 'zustand';
import { alternateRemoteAudioUrls } from '@/services/quran/reciters';
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
  /** Used to re-resolve Qur’an reciter audio when the dua voice changes. */
  duaArabic?: string | null;
  categoryNumber?: string | null;
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
let modeReady = false;
let advancing = false;
let startGeneration = 0;
let artworkUrl: string | null = null;
let onQuranEdge: ((direction: -1 | 1, reason: QuranEdgeReason) => Promise<boolean>) | null = null;
let resolveTrackUri: ((track: PlayableTrack) => string) | null = null;
let statusSub: { remove: () => void } | null = null;
/** Prefetch next ayah this many seconds before the current one ends. */
const WARM_LEAD_SEC = 3.5;
const STATUS_INTERVAL_MS = 100;

const MAX_RETRIES = 2;
const RETRY_BASE_MS = 280;

export function setQuranEdgeHandler(
  handler: ((direction: -1 | 1, reason: QuranEdgeReason) => Promise<boolean>) | null,
) {
  onQuranEdge = handler;
}

/** Optional just-in-time URI rewrite (e.g. prefer offline Quran files without scanning the whole queue). */
export function setTrackUriResolver(handler: ((track: PlayableTrack) => string) | null) {
  resolveTrackUri = handler;
}

function trackUri(track: PlayableTrack) {
  try {
    return resolveTrackUri?.(track) ?? track.uri;
  } catch {
    return track.uri;
  }
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

async function applyMode(force = false) {
  if (modeReady && !force) return;
  await setAudioModeAsync({
    playsInSilentMode: true,
    interruptionMode: 'doNotMix',
    allowsRecording: false,
    shouldPlayInBackground: backgroundEnabled(),
    shouldRouteThroughEarpiece: false,
  });
  modeReady = true;
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
      updateInterval: STATUS_INTERVAL_MS,
      keepAudioSessionActive: backgroundEnabled(),
      downloadFirst,
    },
  );
}

function markQuranProgress(track: PlayableTrack) {
  if (track.kind === 'quran' && track.surahNumber && track.ayahInSurah) {
    rememberQuranListen({ surahNumber: track.surahNumber, ayahInSurah: track.ayahInSurah });
  }
}

function onStatus(status: AudioStatus) {
  useAudioEngine.setState({
    playing: status.playing,
    loading: status.isBuffering && !status.playing,
    currentTime: status.currentTime,
    duration: status.duration,
  });

  // Start downloading/decoding the next ayah before this one ends (gapless).
  if (
    status.playing &&
    !status.didJustFinish &&
    status.duration > 0 &&
    status.currentTime >= Math.max(0.4, status.duration - WARM_LEAD_SEC)
  ) {
    void warmNext();
  }

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
    // Prefer instant warm handoff — no applyMode / lock-screen await in the audio path.
    const next = queue[index + 1];
    if (next && (await trySeamlessHandoff(next, index + 1))) return;
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
  const uri = trackUri(next);
  if (warmUri === uri && warm) return;
  clearWarm();
  try {
    // downloadFirst=true so the next ayah is on disk/buffer before this one ends.
    warm = createPlayer(uri, true);
    warmUri = uri;
    warm.volume = 0;
    warm.loop = false;
    applyRate(warm);
  } catch {
    clearWarm();
  }
}

/** Swap to the preloaded next player immediately — play first, chrome later. */
function promoteWarmSync(track: PlayableTrack, generation: number) {
  const uri = trackUri(track);
  if (!warm || warmUri !== uri) return false;
  const nextPlayer = warm;
  warm = null;
  warmUri = null;
  const previous = player;
  player = nextPlayer;
  try {
    player.volume = 1;
    player.loop = false;
  } catch {
    /* ignore */
  }
  bindStatus(player);
  applyRate(player);
  try {
    player.play();
  } catch {
    return false;
  }
  if (generation !== startGeneration) return true;
  useAudioEngine.setState({ loading: false, playing: true, error: null, currentTime: 0 });
  markQuranProgress(track);
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
    setTimeout(() => disposePlayer(previous), 80);
  }
  void showLockScreen(track);
  return true;
}

async function trySeamlessHandoff(track: PlayableTrack, index: number) {
  const uri = trackUri(track);
  // Prefer a warm (even partially buffered) player — cold replace is what causes the audible gap.
  if (!warm || warmUri !== uri) return false;
  const generation = ++startGeneration;
  useAudioEngine.setState({ index, error: null, currentTime: 0 });
  if (!promoteWarmSync(track, generation)) return false;
  if (generation === startGeneration) void warmNext(index);
  return true;
}

async function startAt(index: number) {
  const generation = ++startGeneration;
  const track = useAudioEngine.getState().queue[index];
  if (!track?.uri) {
    useAudioEngine.setState({ playing: false, loading: false, error: 'missing-audio' });
    return;
  }
  const primaryUri = trackUri(track);
  const uris = [primaryUri, ...alternateRemoteAudioUrls(primaryUri)].filter(
    (uri, index, list) => Boolean(uri) && list.indexOf(uri) === index,
  );

  // Gapless path: promote warm before any await.
  useAudioEngine.setState({ index, error: null, currentTime: 0 });
  if (promoteWarmSync(track, generation)) {
    if (generation === startGeneration) void warmNext(index);
    return;
  }

  useAudioEngine.setState({ loading: true });

  try {
    await applyMode();
    if (generation !== startGeneration) return;

    let lastError: unknown;
    let uriIndex = 0;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      if (generation !== startGeneration) return;
      const uri = uris[Math.min(uriIndex, uris.length - 1)] ?? primaryUri;
      try {
        if (!player) {
          player = createPlayer(uri, true);
          bindStatus(player);
        } else {
          player.replace({ uri });
        }
        player.loop = false;
        player.volume = 1;
        applyRate(player);
        if (generation !== startGeneration) return;
        player.play();
        useAudioEngine.setState({ loading: false, playing: true, error: null });
        markQuranProgress(track);
        void showLockScreen(track);
        if (generation === startGeneration) void warmNext(index);
        return;
      } catch (error) {
        lastError = error;
        if (uriIndex < uris.length - 1) uriIndex += 1;
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
  void applyMode(true);
  if (!state.quranBackground && AppState.currentState !== 'active') {
    player?.pause();
    useAudioEngine.setState({ playing: false });
  }
});
