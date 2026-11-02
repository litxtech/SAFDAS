import { useEffect, useRef } from 'react';
import { currentTrack, useAudioEngine } from '@/services/audio/engine';
import { recordListen } from '@/services/studio/api';

/**
 * Global listen reporter for studio tracks (feed, detail, mini/full player).
 * Server validates threshold + unique-per-account rules.
 */
export function StudioListenTracker() {
  const playing = useAudioEngine((s) => s.playing);
  const currentTime = useAudioEngine((s) => s.currentTime);
  const duration = useAudioEngine((s) => s.duration);
  const index = useAudioEngine((s) => s.index);
  const queue = useAudioEngine((s) => s.queue);
  const sentFor = useRef<string | null>(null);
  const sessionRef = useRef(`studio-${Date.now()}`);
  const peakRef = useRef(0);

  const track = queue[index] ?? currentTrack();
  const recordingId = track?.kind === 'studio' ? track.studioRecordingId ?? null : null;

  useEffect(() => {
    if (!recordingId) {
      sentFor.current = null;
      peakRef.current = 0;
      return;
    }
    if (sentFor.current && sentFor.current !== recordingId) {
      sentFor.current = null;
      peakRef.current = 0;
      sessionRef.current = `studio-${recordingId}-${Date.now()}`;
    }
  }, [recordingId]);

  useEffect(() => {
    if (!recordingId || !playing) return;
    peakRef.current = Math.max(peakRef.current, currentTime);
    if (sentFor.current === recordingId) return;

    const total = duration > 0 ? duration : 0;
    const threshold = total > 0 ? Math.min(30, Math.max(1, total * 0.5)) : 30;
    if (peakRef.current < threshold) return;

    sentFor.current = recordingId;
    void recordListen(recordingId, peakRef.current, sessionRef.current).catch(() => {
      sentFor.current = null;
    });
  }, [recordingId, playing, currentTime, duration]);

  return null;
}
