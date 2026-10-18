import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Cover, ListenBack, PlayFab, SeekBar, ink } from '@/components/listen/chrome';
import { useT } from '@/i18n';
import {
  currentTrack,
  seekPlayback,
  togglePlayback,
  useAudioEngine,
} from '@/services/audio/engine';
import {
  fetchRecording,
  recordListen,
  softDelete,
  toggleLike,
  toggleSave,
} from '@/services/studio/api';
import { openStudioStats } from '@/services/studio/nav';
import { playStudioRecording } from '@/services/studio/playback';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';

function oneParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value || undefined;
}

export default function StudioDetailScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const show = useToastStore((s) => s.show);
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id);
  const id = oneParam(useLocalSearchParams<{ id?: string }>().id);
  const playing = useAudioEngine((s) => s.playing);
  const currentTime = useAudioEngine((s) => s.currentTime);
  const duration = useAudioEngine((s) => s.duration);
  const active = currentTrack()?.studioRecordingId === id;
  const listenSent = useRef(false);
  const sessionId = useRef(`detail-${id}-${Date.now()}`);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  const query = useQuery({
    queryKey: ['studio-recording', id],
    enabled: Boolean(id),
    queryFn: () => fetchRecording(id as string),
  });

  const recording = query.data;

  useEffect(() => {
    if (!recording) return;
    setLiked(Boolean(recording.liked));
    setSaved(Boolean(recording.saved));
    setLikeCount(recording.like_count);
  }, [recording]);

  useEffect(() => {
    if (!active || !playing || !id || listenSent.current) return;
    if (currentTime < 12) return;
    listenSent.current = true;
    void recordListen(id, currentTime, sessionId.current).catch(() => {
      listenSent.current = false;
    });
  }, [active, currentTime, id, playing]);

  async function onPlay() {
    if (!recording) return;
    if (active) {
      togglePlayback();
      return;
    }
    const artist = recording.profiles?.display_name || recording.profiles?.username || null;
    await playStudioRecording(recording, artist);
  }

  async function onLike() {
    if (!id) return;
    try {
      const result = await toggleLike(id);
      setLiked(result.liked);
      setLikeCount(result.like_count);
    } catch (error) {
      show(error instanceof Error ? error.message : t('studioActionFailed'), 'error');
    }
  }

  async function onSave() {
    if (!id) return;
    try {
      const result = await toggleSave(id);
      setSaved(result.saved);
    } catch (error) {
      show(error instanceof Error ? error.message : t('studioActionFailed'), 'error');
    }
  }

  function shareToPost() {
    if (!id) return;
    router.push({ pathname: '/post/create', params: { studioId: id, type: 'studio' } });
  }

  async function onDelete() {
    if (!id) return;
    try {
      await softDelete(id);
      void queryClient.invalidateQueries({ queryKey: ['studio-mine'] });
      show(t('studioDeleted'), 'success');
      router.back();
    } catch (error) {
      show(error instanceof Error ? error.message : t('studioDeleteFailed'), 'error');
    }
  }

  if (query.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: ink.canvas, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={ink.green} />
      </View>
    );
  }

  if (!recording) {
    return (
      <View style={{ flex: 1, backgroundColor: ink.canvas, paddingTop: insets.top, paddingHorizontal: 16 }}>
        <ListenBack />
        <Text style={{ color: ink.muted, marginTop: 24 }}>{t('studioNotFound')}</Text>
      </View>
    );
  }

  const artist = recording.profiles?.display_name || recording.profiles?.username || t('studioBrand');
  const mine = userId === recording.owner_id;

  return (
    <View style={{ flex: 1, backgroundColor: ink.canvas, paddingTop: insets.top }}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ paddingBottom: 80, gap: 18 }}>
        <View style={{ paddingHorizontal: 8 }}>
          <ListenBack />
        </View>

        <View style={{ alignItems: 'center', gap: 14, paddingHorizontal: 24 }}>
          {recording.cover_url ? (
            <Image source={{ uri: recording.cover_url }} style={{ width: 240, height: 240, borderRadius: 8 }} contentFit="cover" />
          ) : (
            <Cover seed={recording.id} label={recording.title} size={240} />
          )}
          <Text style={{ color: ink.text, fontSize: 24, fontWeight: '800', textAlign: 'center' }}>{recording.title}</Text>
          <Text style={{ color: ink.muted }}>{artist}</Text>
          {recording.description ? (
            <Text style={{ color: ink.muted, textAlign: 'center', lineHeight: 20 }}>{recording.description}</Text>
          ) : null}
        </View>

        <View style={{ paddingHorizontal: 24, gap: 12 }}>
          <SeekBar
            current={active ? currentTime : 0}
            duration={active ? duration : recording.duration_seconds}
            onSeek={(seconds) => {
              if (active) void seekPlayback(seconds);
            }}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 28 }}>
            <Pressable onPress={() => void onLike()} hitSlop={8}>
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={28} color={liked ? '#1DB954' : ink.text} />
            </Pressable>
            <PlayFab playing={active && playing} onPress={() => void onPlay()} size={64} />
            <Pressable onPress={() => void onSave()} hitSlop={8}>
              <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={28} color={saved ? ink.green : ink.text} />
            </Pressable>
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          <StatRow label={t('studioUniqueListeners')} value={String(recording.unique_listeners)} />
          <StatRow label={t('studioPlayCount')} value={String(recording.play_count)} />
          <StatRow label={t('studioLikeCount')} value={String(likeCount)} />
        </View>

        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          {mine ? (
            <ActionBtn label={t('studioViewStats')} onPress={() => openStudioStats(recording.id)} />
          ) : null}
          <ActionBtn label={t('studioSharePost')} onPress={shareToPost} />
          {mine ? <ActionBtn label={t('delete')} onPress={() => void onDelete()} danger /> : null}
        </View>
      </ScrollView>
    </View>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: ink.card,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
      }}
    >
      <Text style={{ color: ink.muted }}>{label}</Text>
      <Text style={{ color: ink.text, fontWeight: '800' }}>{value}</Text>
    </View>
  );
}

function ActionBtn({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        minHeight: 46,
        borderRadius: 999,
        backgroundColor: danger ? '#3a1212' : ink.raised,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: danger ? '#ff6b6b' : ink.text, fontWeight: '800' }}>{label}</Text>
    </Pressable>
  );
}
