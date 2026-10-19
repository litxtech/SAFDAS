/**
 * Just-in-time URI rewrite so playback always prefers on-device files
 * (downloaded Qur’an / dua packs) even if the queue was built with CDN URLs.
 */
import { setTrackUriResolver } from '@/services/audio/engine';
import { resolveDuaAudioUrl } from '@/services/dua/voices';
import { preferLocalDuaUri } from '@/services/offline/resolve';
import { audioUrl } from '@/services/quran/reciters';
import { useDuaVoiceStore } from '@/stores/duaVoiceStore';
import { useReciterStore } from '@/stores/reciterStore';

let bound = false;

export function bindAudioUriResolver() {
  if (bound) return;
  bound = true;
  setTrackUriResolver((track) => {
    if (track.kind === 'quran' && track.ayahNumber != null) {
      return audioUrl(track.ayahNumber, useReciterStore.getState().id);
    }
    if (track.kind === 'dua') {
      const voiceId = useDuaVoiceStore.getState().id;
      const slug = track.duaSlug ?? track.id.replace(/^dua:(?:[^:]+:)?/, '');
      const resolved =
        resolveDuaAudioUrl({
          voiceId,
          openDuaUrl: track.openDuaUrl,
          audioUrl: track.uri.startsWith('http') ? track.uri : null,
          ayahNumber: track.ayahNumber,
          slug,
          arabic: track.duaArabic,
          categoryNumber: track.categoryNumber,
        }) ?? track.uri;
      return preferLocalDuaUri(resolved, track.openDuaUrl, track.uri) ?? resolved;
    }
    return track.uri;
  });
}

bindAudioUriResolver();
