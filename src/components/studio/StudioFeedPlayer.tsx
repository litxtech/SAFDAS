import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { Cover, ink } from '@/components/listen/chrome';
import { useT } from '@/i18n';
import { currentTrack, formatClock, seekPlayback, togglePlayback, useAudioEngine } from '@/services/audio/engine';
import { fetchRecording, recordListen } from '@/services/studio/api';
import { playStudioRecording } from '@/services/studio/playback';
import { openStudioDetail } from '@/services/studio/nav';

type Props = {
  recordingId: string;
  compact?: boolean;
};

export function StudioFeedPlayer({ recordingId, compact }: Props) {
  const t = useT();
  const queue = useAudioEngine((s) => s.queue);
  const index = useAudioEngine((s) => s.index);
  const playing = useAudioEngine((s) => s.playing);
  const currentTime = useAudioEngine((s) => s.currentTime);
  const duration = useAudioEngine((s) => s.duration);
  const track = queue[index] ?? null;
  const active = track?.studioRecordingId === recordingId || track?.id === `studio:${recordingId}`;
  const isPlaying = active && playing;
  const progress = active && duration > 0 ? Math.min(1, currentTime / duration) : 0;
  const listenSent = useRef(false);
  const sessionId = useRef(`feed-${recordingId}-${Date.now()}`);
  const barWidth = useRef(1);

  const query = useQuery({
    queryKey: ['studio-recording', recordingId],
    queryFn: () => fetchRecording(recordingId),
    staleTime: 60_000,
  });

  const recording = query.data;

  useEffect(() => {
    if (!active || !isPlaying || listenSent.current) return;
    if (currentTime < 8) return;
    listenSent.current = true;
    void recordListen(recordingId, currentTime, sessionId.current).catch(() => {
      listenSent.current = false;
    });
  }, [active, currentTime, isPlaying, recordingId]);

  async function onToggle() {
    if (active) {
      togglePlayback();
      return;
    }
    if (!recording?.audio_url) return;
    const artist = recording.profiles?.display_name || recording.profiles?.username || null;
    await playStudioRecording(recording, artist);
  }

  if (query.isLoading && !recording) {
    return (
      <View style={[styles.wrap, compact && styles.compact]}>
        <Text style={{ color: ink.muted, fontSize: 13 }}>{t('studioLoading')}</Text>
      </View>
    );
  }

  if (!recording) return null;

  return (
    <View style={[styles.wrap, compact && styles.compact]}>
      <Pressable onPress={() => openStudioDetail(recordingId)} style={styles.row}>
        {recording.cover_url ? (
          <Image source={{ uri: recording.cover_url }} style={styles.cover} contentFit="cover" />
        ) : (
          <Cover seed={recording.id} label={recording.content_type === 'quran' ? 'Q' : 'D'} size={48} radius={4} />
        )}
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={styles.title} numberOfLines={1}>
            {recording.title}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {recording.profiles?.display_name || recording.profiles?.username || t('studioBrand')}
            {active ? ` · ${formatClock(currentTime)}` : recording.duration_seconds > 0 ? ` · ${formatClock(recording.duration_seconds)}` : ''}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? t('playbackPause') : t('playbackPlay')}
          onPress={() => void onToggle()}
          style={styles.play}
        >
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={18} color="#000" style={isPlaying ? undefined : { marginLeft: 1 }} />
        </Pressable>
      </Pressable>
      <Pressable
        onLayout={(e) => {
          barWidth.current = Math.max(1, e.nativeEvent.layout.width);
        }}
        onPress={(e) => {
          if (!active || duration <= 0) return;
          void seekPlayback((e.nativeEvent.locationX / barWidth.current) * duration);
        }}
        style={styles.barTrack}
      >
        <View style={[styles.barFill, { width: `${progress * 100}%` }]} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: ink.card,
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  compact: { marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cover: { width: 48, height: 48, borderRadius: 4 },
  title: { color: ink.text, fontWeight: '700', fontSize: 14 },
  meta: { color: ink.muted, fontSize: 12 },
  play: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: ink.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: ink.raised,
    overflow: 'hidden',
  },
  barFill: { height: 3, backgroundColor: ink.green },
});
