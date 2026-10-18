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
  kind: 'quran' | 'dua' | 'studio';
  surahNumber?: number;
  ayahInSurah?: number;
  ayahNumber?: number;
  duaId?: string;
  duaSlug?: string;
  openDuaUrl?: string | null;
  /** Used to re-resolve Qur’an reciter audio when the dua voice changes. */
  duaArabic?: string | null;
  categoryNumber?: string | null;
  studioRecordingId?: string;
  artworkUrl?: string;
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
/** True while we intend to play — retries play() once the source finishes loading (fixes first-tap no-op). */
let wantPlaying = false;
/** Prefetch next ayah this far before the current one ends (also warmed on start). */
const WARM_LEAD_SEC = 6;
/** Start next ayah slightly before current ends so the file-boundary silence disappears. */
const EARLY_HANDOFF_SEC = 0.12;
const STATUS_INTERVAL_MS = 80;

function kickPlay(target: AudioPlayer | null = player) {
  if (!target) return;
  wantPlaying = true;
  try {
    target.play();
  } catch {
    /* load may still be in flight — onStatus will retry */
  }
}

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
  const cover = track.artworkUrl ?? (await artwork().catch(() => null));
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

function needsNetworkFetch(uri: string) {
  return /^https?:\/\//i.test(uri);
}

function createPlayer(uri: string, downloadFirst = false) {
  return createAudioPlayer(
    { uri },
    {
      updateInterval: STATUS_INTERVAL_MS,
      keepAudioSessionActive: backgroundEnabled(),
      // Local/offline files play immediately — skip the download-first path.
      downloadFirst: downloadFirst && needsNetworkFetch(uri),
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
    playing: status.playing || (wantPlaying && advancing),
    loading: (status.isBuffering || !status.isLoaded) && wantPlaying && !status.playing,
    currentTime: status.currentTime,
    duration: status.duration,
  });

  // First tap often calls play() before isLoaded — retry as soon as the source is ready.
  if (wantPlaying && status.isLoaded && !status.playing && !status.didJustFinish && !advancing && player) {
    try {
      player.play();
    } catch {
      /* ignore */
    }
  }

  // Warm next ayah as soon as we know duration (not only in the last seconds).
  if (status.playing && !status.didJustFinish && status.duration > 0) {
    const nearEnd = status.currentTime >= Math.max(0.15, status.duration - WARM_LEAD_SEC);
    if (nearEnd || status.currentTime < 0.35) void warmNext();
  }

  // Cut to the next ayah slightly early while warm is ready — removes the file-boundary silence.
  if (
    !advancing &&
    wantPlaying &&
    status.playing &&
    !status.didJustFinish &&
    status.duration > 0.45 &&
    status.currentTime >= status.duration - EARLY_HANDOFF_SEC
  ) {
    if (tryAdvanceSeamless()) return;
  }

  if (!status.didJustFinish || advancing) return;
  advancing = true;
  void advanceAfterFinish().finally(() => {
    advancing = false;
  });
}

/** Sync path used from status ticks — must not await. */
function tryAdvanceSeamless(): boolean {
  const { repeatMode, index, queue } = useAudioEngine.getState();
  if (repeatMode === 'one') return false;
  if (index >= queue.length - 1) return false;
  const next = queue[index + 1];
  if (!next?.uri) return false;
  const uri = trackUri(next);
  if (!warm || warmUri !== uri) return false;
  // Only cut early when the next ayah is actually ready — otherwise wait for natural end.
  try {
    if (!warm.isLoaded) return false;
  } catch {
    return false;
  }
  advancing = true;
  const generation = ++startGeneration;
  useAudioEngine.setState({ index: index + 1, error: null, currentTime: 0 });
  const ok = promoteWarmSync(next, generation);
  if (ok && generation === startGeneration) void warmNext(index + 1);
  advancing = false;
  return ok;
}

async function advanceAfterFinish() {
  const { repeatMode, index, queue } = useAudioEngine.getState();
  const track = queue[index];
  if (repeatMode === 'one') {
    await startAt(index);
    return;
  }
  if (index < queue.length - 1) {
    const next = queue[index + 1];
    if (next && handoffToTrack(next, index + 1)) return;
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
  wantPlaying = false;
  useAudioEngine.setState({ playing: false, loading: false });
}

function handoffToTrack(track: PlayableTrack, index: number): boolean {
  const uri = trackUri(track);
  const generation = ++startGeneration;
  useAudioEngine.setState({ index, error: null, currentTime: 0 });
  if (warm && warmUri === uri && promoteWarmSync(track, generation)) {
    if (generation === startGeneration) void warmNext(index);
    return true;
  }
  // Overlap cold start: new player plays while old one is torn down — avoids replace() gap.
  return overlapColdStart(track, uri, generation, index);
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
    // Prefetch to disk while current ayah plays — handoff then starts instantly.
    warm = createPlayer(uri, true);
    warmUri = uri;
    warm.volume = 0;
    warm.loop = false;
    applyRate(warm);
  } catch {
    clearWarm();
  }
}

/** Silence and release the outgoing player before the next one speaks (prevents dual voices). */
function retirePlayer(previous: AudioPlayer | null) {
  if (!previous) return;
  try {
    previous.volume = 0;
  } catch {
    /* ignore */
  }
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

/** Swap to the preloaded next player immediately — silence old first, then play. */
function promoteWarmSync(track: PlayableTrack, generation: number) {
  const uri = trackUri(track);
  if (!warm || warmUri !== uri) return false;
  const nextPlayer = warm;
  warm = null;
  warmUri = null;
  const previous = player;
  // Mute/pause previous BEFORE starting next — overlapping play was the dual-voice bug.
  retirePlayer(previous && previous !== nextPlayer ? previous : null);
  player = nextPlayer;
  try {
    player.volume = 1;
    player.loop = false;
  } catch {
    /* ignore */
  }
  bindStatus(player);
  applyRate(player);
  kickPlay(player);
  if (generation !== startGeneration) return true;
  useAudioEngine.setState({ loading: false, playing: true, error: null, currentTime: 0 });
  markQuranProgress(track);
  void showLockScreen(track);
  return true;
}

/** Start next ayah on a fresh player; never leave two audible players alive. */
function overlapColdStart(track: PlayableTrack, uri: string, generation: number, index: number) {
  let nextPlayer: AudioPlayer;
  try {
    nextPlayer = createPlayer(uri, false);
  } catch {
    return false;
  }
  const previous = player;
  retirePlayer(previous && previous !== nextPlayer ? previous : null);
  player = nextPlayer;
  try {
    player.volume = 1;
    player.loop = false;
  } catch {
    /* ignore */
  }
  bindStatus(player);
  applyRate(player);
  kickPlay(player);
  if (generation !== startGeneration) return true;
  useAudioEngine.setState({ loading: true, playing: true, error: null, currentTime: 0 });
  markQuranProgress(track);
  void showLockScreen(track);
  if (generation === startGeneration) void warmNext(index);
  return true;
}

async function startAt(index: number) {
  const track = useAudioEngine.getState().queue[index];
  if (!track?.uri) {
    wantPlaying = false;
    useAudioEngine.setState({ playing: false, loading: false, error: 'missing-audio' });
    return;
  }
  const primaryUri = trackUri(track);
  const uris = [primaryUri, ...alternateRemoteAudioUrls(primaryUri)].filter(
    (uri, index, list) => Boolean(uri) && list.indexOf(uri) === index,
  );

  // Gapless path: promote warm / overlap before any await (replace() is what causes the silence).
  if (handoffToTrack(track, index)) return;

  const generation = ++startGeneration;
  useAudioEngine.setState({ index, error: null, currentTime: 0, loading: true });

  try {
    await applyMode();
    if (generation !== startGeneration) return;

    let lastError: unknown;
    let uriIndex = 0;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      if (generation !== startGeneration) return;
      const uri = uris[Math.min(uriIndex, uris.length - 1)] ?? primaryUri;
      try {
        if (overlapColdStart(track, uri, generation, index)) return;
        // Fallback only if overlap could not create a player.
        if (!player) {
          player = createPlayer(uri, false);
          bindStatus(player);
        } else {
          player.replace({ uri });
        }
        player.loop = false;
        player.volume = 1;
        applyRate(player);
        if (generation !== startGeneration) return;
        kickPlay(player);
        useAudioEngine.setState({ loading: true, playing: true, error: null });
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

    wantPlaying = false;
    useAudioEngine.setState({
      loading: false,
      playing: false,
      error: lastError instanceof Error ? lastError.message : 'audio-error',
    });
  } catch (error) {
    if (generation !== startGeneration) return;
    wantPlaying = false;
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
  await applyMode();
  await startAt(safeIndex);
}

export function togglePlayback() {
  if (!player) {
    const { queue, index } = useAudioEngine.getState();
    if (queue[index]?.uri) void startAt(index);
    return;
  }
  if (player.playing || (wantPlaying && useAudioEngine.getState().loading)) {
    pausePlayback();
    return;
  }
  void applyMode().finally(() => {
    if (!player) return;
    applyRate(player);
    kickPlay(player);
    useAudioEngine.setState({ playing: true, error: null });
  });
}

export function pausePlayback() {
  if (!player) return;
  wantPlaying = false;
  player.pause();
  useAudioEngine.setState({ playing: false, loading: false });
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
  wantPlaying = false;
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
