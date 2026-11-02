import { playQueue, type PlayableTrack } from '@/services/audio/engine';
import type { StudioRecording } from '@/services/studio/types';

export function recordingToTrack(
  recording: Pick<StudioRecording, 'id' | 'title' | 'audio_url' | 'cover_url' | 'content_type' | 'surah_number' | 'ayah_start' | 'dua_id'>,
  artist?: string | null,
): PlayableTrack | null {
  if (!recording.audio_url) return null;
  return {
    id: `studio:${recording.id}`,
    uri: recording.audio_url,
    title: recording.title,
    artist: artist?.trim() || 'SAFDAŞ Studio',
    kind: 'studio',
    studioRecordingId: recording.id,
    artworkUrl: recording.cover_url ?? undefined,
    surahNumber: recording.surah_number ?? undefined,
    ayahInSurah: recording.ayah_start ?? undefined,
    duaId: recording.dua_id ?? undefined,
  };
}

export async function playStudioRecording(
  recording: Pick<StudioRecording, 'id' | 'title' | 'audio_url' | 'cover_url' | 'content_type' | 'surah_number' | 'ayah_start' | 'dua_id'>,
  artist?: string | null,
  queue?: PlayableTrack[],
) {
  const track = recordingToTrack(recording, artist);
  if (!track) throw new Error('missing-audio');
  const list = queue?.length ? queue : [track];
  const index = Math.max(0, list.findIndex((item) => item.studioRecordingId === recording.id || item.id === track.id));
  await playQueue(list, index >= 0 ? index : 0);
}
