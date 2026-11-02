import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { useTheme } from '@/theme/ThemeProvider';

const SPEEDS = [1, 1.5, 2] as const;
const POLL_MS = 400;

export function VoiceNotePlayer({ uri, mine, durationMs }: { uri: string; mine?: boolean; durationMs?: number | null }) {
  const { colors } = useTheme();
  const playerRef = useRef<AudioPlayer | null>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(durationMs ? durationMs / 1000 : 0);
  const [speedIndex, setSpeedIndex] = useState(0);

  useEffect(() => {
    return () => {
      try {
        playerRef.current?.remove();
      } catch {
        // ignore
      }
      playerRef.current = null;
    };
  }, [uri]);

  // Poll playhead only while actively playing — no idle timer per bubble.
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      const active = playerRef.current;
      if (!active) return;
      const nextPlaying = active.playing;
      setPlaying(nextPlaying);
      setPosition(active.currentTime);
      if (active.duration > 0) setDuration(active.duration);
      if (!nextPlaying) {
        // Natural end — stop the interval via state.
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [playing]);

  async function ensurePlayer() {
    if (playerRef.current) return playerRef.current;
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
    const next = createAudioPlayer(uri);
    playerRef.current = next;
    if (durationMs && durationMs > 0) setDuration(durationMs / 1000);
    return next;
  }

  const fg = mine ? colors.onPrimary : colors.primary;
  const track = mine ? 'rgba(255,255,255,0.28)' : colors.primaryMuted;
  const progress = duration > 0 ? Math.min(1, position / duration) : 0;
  const remain = Math.max(0, Math.round((duration || 0) - position));

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => {
          void (async () => {
            const player = await ensurePlayer();
            if (player.playing) {
              player.pause();
              setPlaying(false);
            } else {
              void player.play();
              setPlaying(true);
            }
          })();
        }}
        style={[styles.play, { backgroundColor: mine ? 'rgba(255,255,255,0.22)' : colors.primaryMuted }]}
      >
        <Ionicons name={playing ? 'pause' : 'play'} size={18} color={fg} />
      </Pressable>
      <View style={styles.waveWrap}>
        <View style={[styles.wave, { backgroundColor: track }]}>
          <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: fg }]} />
        </View>
        <Text style={{ color: mine ? 'rgba(255,255,255,0.8)' : colors.textSecondary, fontSize: 11, fontVariant: ['tabular-nums'] }}>
          {Math.floor(remain / 60)}:{String(remain % 60).padStart(2, '0')}
        </Text>
      </View>
      <Pressable
        onPress={() => {
          const next = (speedIndex + 1) % SPEEDS.length;
          const rate = SPEEDS[next] as number;
          setSpeedIndex(next);
          playerRef.current?.setPlaybackRate(rate);
        }}
      >
        <Text style={{ color: fg, fontWeight: '800', fontSize: 12 }}>{SPEEDS[speedIndex]}×</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 180, paddingVertical: 2 },
  play: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  waveWrap: { flex: 1, gap: 4 },
  wave: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4 },
});
