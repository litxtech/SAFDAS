import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ListenBack, ink } from '@/components/listen/chrome';
import { LiveWaveform } from '@/components/studio/LiveWaveform';
import { useT } from '@/i18n';
import { stopPlayback } from '@/services/audio/engine';
import { createDraft, updateRecording } from '@/services/studio/api';
import { openStudioPublish } from '@/services/studio/nav';
import { uploadStudioAudio } from '@/services/studio/upload';
import type { StudioContentType } from '@/services/studio/types';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';

const STUDIO_PURPLE = '#8957F5';
const draftUriKey = (id: string) => `safdas:studio-draft-uri:${id}`;

type Phase = 'idle' | 'recording' | 'paused' | 'preview';

function oneParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value || undefined;
}

function formatMs(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function StudioRecordScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const show = useToastStore((s) => s.show);
  const userId = useAuthStore((s) => s.session?.user.id);
  const params = useLocalSearchParams<{
    contentType?: string;
    surah?: string;
    ayahStart?: string;
    ayahEnd?: string;
    duaId?: string;
    title?: string;
    recordingId?: string;
  }>();

  const contentType = (oneParam(params.contentType) === 'dua' ? 'dua' : 'quran') as StudioContentType;
  const surah = Number(oneParam(params.surah) || '') || null;
  const ayahStart = Number(oneParam(params.ayahStart) || '') || (surah ? 1 : null);
  const ayahEnd = Number(oneParam(params.ayahEnd) || '') || ayahStart;
  const duaId = oneParam(params.duaId) ?? (contentType === 'dua' ? 'custom' : null);
  const initialTitle =
    oneParam(params.title) ||
    (contentType === 'quran' && surah
      ? t('studioSurahRecordTitle', { number: surah })
      : contentType === 'quran'
        ? t('studioRecordQuranDefault')
        : t('studioRecordDuaDefault'));

  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const state = useAudioRecorderState(recorder, 80);
  const [phase, setPhase] = useState<Phase>('idle');
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [notes, setNotes] = useState('');
  const [recordingId, setRecordingId] = useState<string | null>(oneParam(params.recordingId) ?? null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const startedRef = useRef(false);
  const durationRef = useRef(0);

  useEffect(() => {
    durationRef.current = state.durationMillis ?? 0;
  }, [state.durationMillis]);

  useEffect(() => {
    stopPlayback();
  }, []);

  useEffect(() => {
    if (!recordingId || previewUri) return;
    void AsyncStorage.getItem(draftUriKey(recordingId)).then((uri) => {
      if (!uri) return;
      setPreviewUri(uri);
      setPhase('preview');
    });
  }, [previewUri, recordingId]);

  useEffect(() => {
    return () => {
      if (startedRef.current) {
        try {
          void recorder.stop();
        } catch {
          /* ignore */
        }
      }
    };
  }, [recorder]);

  const meteringLevel = useMemo(() => {
    const raw = state.metering;
    if (typeof raw !== 'number') return phase === 'recording' ? 0.25 : 0;
    return raw;
  }, [phase, state.metering]);

  async function resetAudioMode() {
    try {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    } catch {
      /* ignore */
    }
  }

  async function ensureDraft() {
    if (recordingId) return recordingId;
    if (!userId) throw new Error('auth_required');
    const draft = await createDraft({
      content_type: contentType,
      title: title.trim() || initialTitle,
      description: notes.trim() || null,
      surah_number: contentType === 'quran' ? surah : null,
      ayah_start: contentType === 'quran' ? ayahStart : null,
      ayah_end: contentType === 'quran' ? ayahEnd : null,
      dua_id: contentType === 'dua' ? duaId : null,
      visibility: 'private',
    });
    setRecordingId(draft.id);
    return draft.id;
  }

  async function begin() {
    if (busy || phase === 'recording') return;
    setBusy(true);
    try {
      stopPlayback();
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        show(t('studioMicDenied'), 'error');
        return;
      }
      await ensureDraft();
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      if (phase !== 'paused') {
        await recorder.prepareToRecordAsync();
      }
      recorder.record();
      startedRef.current = true;
      setPreviewUri(null);
      setPhase('recording');
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      startedRef.current = false;
      setPhase('idle');
      show(error instanceof Error ? error.message : t('studioRecordFailed'), 'error');
    } finally {
      setBusy(false);
    }
  }

  function pause() {
    if (phase !== 'recording' || busy) return;
    try {
      recorder.pause();
      setPhase('paused');
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      /* ignore */
    }
  }

  async function resume() {
    if (phase !== 'paused' || busy) return;
    try {
      recorder.record();
      setPhase('recording');
    } catch {
      await begin();
    }
  }

  async function stopToPreview() {
    if ((phase !== 'recording' && phase !== 'paused') || busy) return;
    setBusy(true);
    try {
      await recorder.stop();
    } catch {
      /* ignore */
    }
    const uri = recorder.uri;
    const ms = durationRef.current;
    startedRef.current = false;
    await resetAudioMode();
    setBusy(false);
    if (!uri || ms < 400) {
      setPreviewUri(null);
      setPhase('idle');
      show(t('studioTooShort'), 'error');
      return;
    }
    setPreviewUri(uri);
    setDurationMs(ms);
    setPhase('preview');
    if (recordingId) {
      await AsyncStorage.setItem(draftUriKey(recordingId), uri).catch(() => undefined);
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  async function discard() {
    if (startedRef.current) {
      try {
        await recorder.stop();
      } catch {
        /* ignore */
      }
      startedRef.current = false;
      await resetAudioMode();
    }
    setPreviewUri(null);
    setDurationMs(0);
    setPhase('idle');
  }

  async function saveDraftOnly() {
    if (!userId || !previewUri || !recordingId) {
      show(t('studioNeedRecording'), 'error');
      return;
    }
    setBusy(true);
    try {
      const uploaded = await uploadStudioAudio(previewUri, userId, recordingId);
      await updateRecording(recordingId, {
        title: title.trim() || initialTitle,
        description: notes.trim() || null,
        audio_path: uploaded.path,
        audio_url: uploaded.url,
        mime_type: uploaded.mimeType,
        duration_seconds: durationMs / 1000,
        status: 'draft',
      });
      await AsyncStorage.setItem(draftUriKey(recordingId), previewUri).catch(() => undefined);
      show(t('studioDraftSaved'), 'success');
      openStudioLibrary();
    } catch (error) {
      show(error instanceof Error ? error.message : t('studioSaveFailed'), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    if (!userId || !previewUri) {
      show(t('studioNeedRecording'), 'error');
      return;
    }
    setBusy(true);
    try {
      const id = await ensureDraft();
      const uploaded = await uploadStudioAudio(previewUri, userId, id);
      await updateRecording(id, {
        title: title.trim() || initialTitle,
        description: notes.trim() || null,
        audio_path: uploaded.path,
        audio_url: uploaded.url,
        mime_type: uploaded.mimeType,
        duration_seconds: durationMs / 1000,
        status: 'draft',
      });
      await AsyncStorage.removeItem(draftUriKey(id)).catch(() => undefined);
      openStudioPublish(id);
    } catch (error) {
      show(error instanceof Error ? error.message : t('studioSaveFailed'), 'error');
    } finally {
      setBusy(false);
    }
  }

  const timerLabel = formatMs(phase === 'preview' ? durationMs : (state.durationMillis ?? 0));

  return (
    <View style={{ flex: 1, backgroundColor: ink.canvas, paddingTop: insets.top }}>
      <StatusBar style="light" />
      <View style={{ paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <ListenBack onPress={() => router.back()} />
        <Text style={{ color: ink.text, fontWeight: '800', fontSize: 16 }}>{t('studioRecordTitle')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder={t('studioTitlePlaceholder')}
          placeholderTextColor={ink.dim}
          style={{
            color: ink.text,
            fontSize: 22,
            fontWeight: '800',
            borderBottomWidth: 1,
            borderBottomColor: ink.raised,
            paddingVertical: 10,
          }}
        />

        <View style={{ backgroundColor: ink.card, borderRadius: 16, padding: 16, gap: 14, alignItems: 'center' }}>
          <Text style={{ color: ink.green, fontSize: 42, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{timerLabel}</Text>
          <LiveWaveform level={meteringLevel} active={phase === 'recording'} height={72} style={{ width: '100%' }} />
          <Text style={{ color: ink.muted, fontSize: 13 }}>
            {phase === 'recording'
              ? t('studioRecording')
              : phase === 'paused'
                ? t('studioPaused')
                : phase === 'preview'
                  ? t('studioPreviewReady')
                  : t('studioTapToRecord')}
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 4 }}>
            {phase === 'recording' || phase === 'paused' ? (
              <>
                <Pressable onPress={() => void discard()} style={circleBtn(ink.raised)}>
                  <Ionicons name="trash-outline" size={22} color="#ff6b6b" />
                </Pressable>
                {phase === 'recording' ? (
                  <Pressable onPress={pause} style={circleBtn(ink.raised, 64)}>
                    <Ionicons name="pause" size={28} color={ink.text} />
                  </Pressable>
                ) : (
                  <Pressable onPress={() => void resume()} style={circleBtn(ink.green, 64)}>
                    <Ionicons name="mic" size={28} color="#000" />
                  </Pressable>
                )}
                <Pressable onPress={() => void stopToPreview()} style={circleBtn('#E8115B')}>
                  <Ionicons name="stop" size={22} color="#fff" />
                </Pressable>
              </>
            ) : phase === 'preview' ? (
              <>
                <Pressable onPress={() => void discard()} style={circleBtn(ink.raised)}>
                  <Ionicons name="refresh" size={22} color={ink.text} />
                </Pressable>
                <Pressable onPress={() => void begin()} style={circleBtn(ink.green, 64)}>
                  <Ionicons name="mic" size={28} color="#000" />
                </Pressable>
              </>
            ) : (
              <Pressable disabled={busy} onPress={() => void begin()} style={circleBtn(ink.green, 72)}>
                {busy ? <ActivityIndicator color="#000" /> : <Ionicons name="mic" size={32} color="#000" />}
              </Pressable>
            )}
          </View>
        </View>

        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder={t('studioNotesPlaceholder')}
          placeholderTextColor={ink.dim}
          multiline
          style={{
            color: ink.text,
            minHeight: 100,
            backgroundColor: ink.card,
            borderRadius: 12,
            padding: 14,
            textAlignVertical: 'top',
          }}
        />

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable
            disabled={busy || phase !== 'preview'}
            onPress={() => void saveDraftOnly()}
            style={{
              flex: 1,
              minHeight: 48,
              borderRadius: 999,
              backgroundColor: ink.raised,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: phase === 'preview' ? 1 : 0.45,
            }}
          >
            <Text style={{ color: ink.text, fontWeight: '800' }}>{t('studioSaveDraft')}</Text>
          </Pressable>
          <Pressable
            disabled={busy || phase !== 'preview'}
            onPress={() => void finish()}
            style={{
              flex: 1,
              minHeight: 48,
              borderRadius: 999,
              backgroundColor: STUDIO_PURPLE,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: phase === 'preview' ? 1 : 0.45,
            }}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontWeight: '800' }}>{t('studioFinish')}</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function circleBtn(bg: string, size = 52) {
  return {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: bg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };
}
