import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { useEffect, useState } from 'react';
import { useI18nStore } from '@/i18n';
import { useAudioEngine } from '@/services/audio/engine';
import {
  isFemaleSpeechSupported,
  pauseFemaleSpeech,
  resumeFemaleSpeech,
  setFemaleSpeechRate,
  speakFemale,
  stopFemaleSpeech,
  subscribeFemaleSpeech,
} from '@/services/tts/femaleSpeech';

type SpeechModule = typeof import('expo-speech');

let speechModule: SpeechModule | null = null;
let speechUnavailable = false;

/**
 * `expo-speech` throws while it is imported when the native module is missing
 * (for example an installed dev build that predates the dependency). Loading it
 * lazily keeps every screen that merely links to this file — the story detail
 * screen, live dua rooms and anything importing `openContent` — from crashing at
 * import time; they simply run without voice playback.
 */
function hasNativeSpeechModule(): boolean {
  try {
    // Varlığını `require` etmeden sor: `require('expo-speech')` native modül yoksa
    // fırlatır ve Metro bunu terminale ERROR olarak yazar (yakalanmış olsa bile).
    return Boolean(requireOptionalNativeModule('ExpoSpeech'));
  } catch {
    return false;
  }
}

function speech(): SpeechModule | null {
  if (speechModule) return speechModule;
  if (speechUnavailable) return null;
  if (!hasNativeSpeechModule()) {
    speechUnavailable = true;
    return null;
  }
  try {
    speechModule = require('expo-speech') as SpeechModule;
    return speechModule;
  } catch {
    speechUnavailable = true;
    return null;
  }
}

/** False when the running build has no `ExpoSpeech` native module. */
export function isStorySpeechAvailable(): boolean {
  return speech() !== null;
}

export type StorySpeechStatus = 'idle' | 'loading' | 'speaking' | 'paused' | 'error';

/** Okuma sesi: açık API kadın sesi veya cihazın kendi sesi. */
export type StorySpeechVoice = 'female' | 'device';

export type StorySpeechSnapshot = {
  storyId: string | null;
  status: StorySpeechStatus;
  rate: number;
  voice: StorySpeechVoice;
  chunkIndex: number;
  chunkCount: number;
  error: string | null;
};

export const SPEECH_RATES = [0.85, 1, 1.15, 1.3] as const;

// v2 forces the privacy-preserving on-device voice by default. The external
// key-free voice is only used after the reader explicitly opts in.
const VOICE_KEY = 'safdas:story-voice:v2';

const listeners = new Set<(snapshot: StorySpeechSnapshot) => void>();
let snapshot: StorySpeechSnapshot = {
  storyId: null,
  status: 'idle',
  rate: 1,
  voice: 'device',
  chunkIndex: 0,
  chunkCount: 0,
  error: null,
};
let chunks: string[] = [];
let index = 0;
let generation = 0;
let voiceId: string | null = null;
let voiceResolved = false;
/** Şu an sesi hangi motor çıkarıyor? */
let activeEngine: StorySpeechVoice = 'device';
/** Kadın ses hata verirse cihaz sesine düşmek için son metin. */
let lastText = '';
let lastStoryId: string | null = null;

function emit(next: Partial<StorySpeechSnapshot>) {
  snapshot = { ...snapshot, ...next };
  for (const listener of listeners) listener(snapshot);
}

// Kayıtlı ses tercihi — varsayılan cihaz sesi.
void AsyncStorage.getItem(VOICE_KEY)
  .then((stored) => {
    if (stored !== 'device' && stored !== 'female') return;
    // Cihaz TTS'i bu derlemede yoksa (eski dev client) sessiz kalma: açık kadın sesine geç.
    const next: StorySpeechVoice =
      stored === 'device' && !isStorySpeechAvailable() && isFemaleSpeechSupported() ? 'female' : stored;
    if (next === snapshot.voice) return;
    snapshot = { ...snapshot, voice: next };
    for (const listener of listeners) listener(snapshot);
  })
  .catch(() => undefined);

export function getStorySpeechVoice(): StorySpeechVoice {
  return snapshot.voice;
}

/** Ses tercihini değiştirir ve kalıcı olarak saklar. */
export function setStorySpeechVoice(voice: StorySpeechVoice) {
  if (voice === snapshot.voice) return;
  if (snapshot.status !== 'idle') {
    if (activeEngine === 'female') stopFemaleSpeech();
    void stopStorySpeech();
  }
  emit({ voice });
  void AsyncStorage.setItem(VOICE_KEY, voice).catch(() => undefined);
}

export function isStorySpeechFemaleAvailable() {
  return isFemaleSpeechSupported();
}

/** Splits long story text into speakable, restartable blocks (paragraph/sentence aware). */
export function splitForSpeech(text: string): string[] {
  const clean = text.replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim();
  if (!clean) return [];
  const paragraphs = clean.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  const result: string[] = [];
  for (const paragraph of paragraphs) {
    if (paragraph.length <= 520) {
      result.push(paragraph);
      continue;
    }
    const sentences = paragraph.match(/[^.!?…]+[.!?…]*\s*/g) ?? [paragraph];
    let buffer = '';
    for (const sentence of sentences) {
      if ((buffer + sentence).length > 520 && buffer.trim()) {
        result.push(buffer.trim());
        buffer = '';
      }
      if (sentence.length > 520) {
        for (let at = 0; at < sentence.length; at += 480) {
          result.push(sentence.slice(at, at + 480).trim());
        }
      } else {
        buffer += sentence;
      }
    }
    if (buffer.trim()) result.push(buffer.trim());
  }
  return result;
}

async function resolveVoice() {
  if (voiceResolved) return;
  voiceResolved = true;
  const engine = speech();
  if (!engine) return;
  try {
    const voices = await engine.getAvailableVoicesAsync();
    const turkish = voices.find((voice) => voice.language?.toLowerCase().startsWith('tr'));
    voiceId = turkish?.identifier ?? null;
  } catch {
    voiceId = null;
  }
}

async function speakCurrent() {
  if (snapshot.status !== 'loading' && snapshot.status !== 'speaking') return;
  const text = chunks[index];
  if (!text) {
    emit({ status: 'idle', chunkIndex: 0, chunkCount: chunks.length });
    return;
  }
  const engine = speech();
  if (!engine) {
    emit({ status: 'error', error: 'speech_unavailable' });
    return;
  }
  await resolveVoice();
  const token = generation;
  if (token !== generation) return;
  emit({ status: 'speaking', chunkIndex: index, error: null });
  engine.speak(text, {
    language: 'tr-TR',
    voice: voiceId ?? undefined,
    rate: snapshot.rate,
    // Separate session: the engine owns the app audio session, TTS stops before it plays.
    useApplicationAudioSession: false,
    onDone: () => {
      if (token !== generation) return;
      index += 1;
      if (index >= chunks.length) {
        emit({ status: 'idle', chunkIndex: 0 });
        return;
      }
      void speakCurrent();
    },
    onError: () => {
      if (token !== generation) return;
      emit({ status: 'error', error: 'speech_failed' });
    },
  });
}

async function startDeviceSpeech(input: { storyId: string; text: string; rate?: number }) {
  const parts = splitForSpeech(input.text);
  if (!parts.length) return;
  const engine = speech();
  if (!engine) {
    emit({ storyId: input.storyId, status: 'error', error: 'speech_unavailable' });
    return;
  }
  generation += 1;
  try {
    await engine.stop();
  } catch {
    /* ignore */
  }
  chunks = parts;
  index = 0;
  activeEngine = 'device';
  emit({
    storyId: input.storyId,
    status: 'loading',
    rate: input.rate ?? snapshot.rate,
    chunkIndex: 0,
    chunkCount: parts.length,
    error: null,
  });
  void speakCurrent();
}

export async function startStorySpeech(input: {
  storyId: string;
  text: string;
  rate?: number;
}) {
  const parts = splitForSpeech(input.text);
  if (!parts.length) return;
  lastText = input.text;
  lastStoryId = input.storyId;

  const femaleReady = isFemaleSpeechSupported();
  const deviceReady = isStorySpeechAvailable();
  // Cihaz TTS'i yoksa (eski dev client / desteklenmeyen cihaz) açık kadın sesine düş;
  // böylece "Dinle" düğmesi sessizce çalışmaz hâle gelmiyor.
  const useFemale = femaleReady && (snapshot.voice === 'female' || !deviceReady);

  // Açık (anahtarsız) kadın sesi tercih ediliyorsa MP3 parçalarını çal.
  if (useFemale) {
    generation += 1;
    activeEngine = 'female';
    // Cihaz sesine geri düşüldüğünde arayüz de doğru sesi göstermeli.
    if (snapshot.voice !== 'female') emit({ voice: 'female' });
    try {
      await speech()?.stop();
    } catch {
      /* ignore */
    }
    emit({
      storyId: input.storyId,
      status: 'loading',
      rate: input.rate ?? snapshot.rate,
      chunkIndex: 0,
      chunkCount: parts.length,
      error: null,
    });
    await speakFemale({
      text: input.text,
      locale: useI18nStore.getState().locale,
      rate: snapshot.rate,
    });
    return;
  }

  await startDeviceSpeech(input);
}

export async function pauseStorySpeech() {
  if (snapshot.status !== 'speaking' && snapshot.status !== 'loading') return;
  if (activeEngine === 'female') {
    pauseFemaleSpeech();
    emit({ status: 'paused' });
    return;
  }
  generation += 1;
  emit({ status: 'paused' });
  try {
    await speech()?.stop();
  } catch {
    /* ignore */
  }
}

export async function resumeStorySpeech() {
  if (snapshot.status !== 'paused') return;
  if (activeEngine === 'female') {
    emit({ status: 'loading' });
    resumeFemaleSpeech();
    return;
  }
  generation += 1;
  emit({ status: 'loading' });
  void speakCurrent();
}

export async function stopStorySpeech() {
  if (snapshot.status === 'idle') return;
  generation += 1;
  chunks = [];
  index = 0;
  if (activeEngine === 'female') stopFemaleSpeech();
  emit({ status: 'idle', storyId: null, chunkIndex: 0, chunkCount: 0, error: null });
  try {
    await speech()?.stop();
  } catch {
    /* ignore */
  }
}

export async function setStorySpeechRate(rate: number) {
  const next = Math.min(1.6, Math.max(0.6, rate));
  emit({ rate: next });
  // Kadın ses oynatıcısı hızı anında uygular; parçayı yeniden başlatmaz.
  if (activeEngine === 'female') {
    setFemaleSpeechRate(next);
    return;
  }
  if (snapshot.status === 'speaking') {
    generation += 1;
    try {
      await speech()?.stop();
    } catch {
      /* ignore */
    }
    emit({ status: 'loading' });
    void speakCurrent();
  }
}

export function getStorySpeechSnapshot() {
  return snapshot;
}

export function subscribeStorySpeech(listener: (snapshot: StorySpeechSnapshot) => void) {
  listeners.add(listener);
  listener(snapshot);
  return () => {
    listeners.delete(listener);
  };
}

export function useStorySpeech() {
  const [state, setState] = useState<StorySpeechSnapshot>(getStorySpeechSnapshot());
  useEffect(() => subscribeStorySpeech(setState), []);
  return state;
}

// Açık API kadın ses oynatıcısını hikâye durumuna bağla.
subscribeFemaleSpeech((state) => {
  if (activeEngine !== 'female') return;
  if (state.status === 'error') {
    // Kadın ses alınamadıysa sessiz kalma: cihaz sesiyle devam et.
    const text = lastText;
    if (!text) {
      emit({ status: 'error', error: state.error });
      return;
    }
    activeEngine = 'device';
    void startDeviceSpeech({ storyId: lastStoryId ?? snapshot.storyId ?? '', text, rate: snapshot.rate });
    return;
  }
  emit({
    status: state.status,
    chunkIndex: state.chunkIndex,
    chunkCount: state.chunkCount,
    error: state.error,
  });
});

// Safety net: never let TTS and the Qur'an/dua engine speak at the same time.
useAudioEngine.subscribe((state) => {
  if (!state.playing) return;
  if (snapshot.status === 'speaking' || snapshot.status === 'loading' || snapshot.status === 'paused') {
    void stopStorySpeech();
  }
});
