import { AppState, Platform } from 'react-native';
import { Asset } from 'expo-asset';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioStatus } from 'expo-audio';
import { create } from 'zustand';
import { translate, useI18nStore } from '@/i18n';
import { audioUrl } from '@/services/quran';
import { usePrayerStore } from '@/stores/prayerStore';

export type QuranAyahRef = { number: number; numberInSurah: number };

type PlayerState = {
  surahNumber: number | null;
  surahTitle: string;
  ayahInSurah: number | null;
  playing: boolean;
};

export const useQuranPlayer = create<PlayerState>(() => ({
  surahNumber: null,
  surahTitle: '',
  ayahInSurah: null,
  playing: false,
}));

let player: AudioPlayer | null = null;
let ayahs: QuranAyahRef[] = [];
let surahNumber: number | null = null;
let surahTitle = '';
let index = 0;
let artworkUrl: string | null = null;
let advancing = false;
let listening = false;

async function applyMode() {
  const background = usePrayerStore.getState().quranBackground;
  await setAudioModeAsync({
    playsInSilentMode: true,
    interruptionMode: 'doNotMix',
    allowsRecording: false,
    shouldPlayInBackground: background,
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

function publish(playing: boolean) {
  const ayah = ayahs[index];
  useQuranPlayer.setState({
    surahNumber,
    surahTitle,
    ayahInSurah: ayah?.numberInSurah ?? null,
    playing,
  });
}

async function showLockScreen() {
  if (!player) return;
  const ayah = ayahs[index];
  if (!ayah) return;
  const cover = await artwork().catch(() => null);
  player.setActiveForLockScreen(
    true,
    {
      title: `${surahTitle} · ${ayah.numberInSurah}`,
      artist: translate(useI18nStore.getState().locale, 'reciterAlafasy'),
      albumTitle: 'SAFDAŞ',
      artworkUrl: cover ?? undefined,
    },
    { showSeekForward: false, showSeekBackward: false },
  );
}

function onStatus(status: AudioStatus) {
  publish(status.playing);
  if (!status.didJustFinish || advancing) return;
  if (index >= ayahs.length - 1) {
    publish(false);
    return;
  }
  advancing = true;
  void playIndex(index + 1).finally(() => {
    advancing = false;
  });
}

async function playIndex(nextIndex: number) {
  const ayah = ayahs[nextIndex];
  if (!ayah) return;
  index = nextIndex;
  await applyMode();
  const background = usePrayerStore.getState().quranBackground;
  if (!player) {
    player = createAudioPlayer({ uri: audioUrl(ayah.number) }, { updateInterval: 1000, keepAudioSessionActive: background });
    player.addListener('playbackStatusUpdate', onStatus);
    listening = true;
  } else {
    player.replace({ uri: audioUrl(ayah.number) });
  }
  if (!listening) {
    player.addListener('playbackStatusUpdate', onStatus);
    listening = true;
  }
  await showLockScreen();
  player.play();
  publish(true);
}

export async function playSurahAyah(input: { surahNumber: number; surahTitle: string; ayahs: QuranAyahRef[]; ayahNumber: number }) {
  surahNumber = input.surahNumber;
  surahTitle = input.surahTitle;
  ayahs = input.ayahs;
  const start = Math.max(0, ayahs.findIndex((item) => item.number === input.ayahNumber));
  await playIndex(start);
}

export async function playAdjacent(direction: -1 | 1) {
  const next = index + direction;
  if (next < 0 || next >= ayahs.length) return;
  await playIndex(next);
}

export function toggleQuranPlayback() {
  if (!player) return;
  if (player.playing) {
    player.pause();
    publish(false);
    return;
  }
  player.play();
  publish(true);
}

export function stopQuranPlayback() {
  player?.pause();
  player?.clearLockScreenControls();
  publish(false);
}

if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (next) => {
    if (next === 'active') return;
    if (!usePrayerStore.getState().quranBackground) {
      player?.pause();
      publish(false);
    }
  });
}

usePrayerStore.subscribe((state, previous) => {
  if (state.quranBackground === previous.quranBackground) return;
  void applyMode();
  if (!state.quranBackground && AppState.currentState !== 'active') {
    player?.pause();
    publish(false);
  }
});
