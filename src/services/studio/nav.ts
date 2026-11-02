import { router } from 'expo-router';
import type { StudioContentType } from '@/services/studio/types';

export function openStudio() {
  router.navigate('/studio');
}

export function openStudioRecord(opts: {
  contentType: StudioContentType;
  surah?: number;
  ayahStart?: number;
  ayahEnd?: number;
  duaId?: string;
  title?: string;
  recordingId?: string;
}) {
  const params: Record<string, string> = {
    contentType: opts.contentType,
  };
  if (opts.surah != null) params.surah = String(opts.surah);
  if (opts.ayahStart != null) params.ayahStart = String(opts.ayahStart);
  if (opts.ayahEnd != null) params.ayahEnd = String(opts.ayahEnd);
  if (opts.duaId) params.duaId = opts.duaId;
  if (opts.title) params.title = opts.title;
  if (opts.recordingId) params.recordingId = opts.recordingId;
  router.push({ pathname: '/studio/record', params });
}

export function openStudioPublish(recordingId: string) {
  router.push({ pathname: '/studio/publish', params: { id: recordingId } });
}

export function openStudioLibrary() {
  router.navigate('/studio/library');
}

export function openStudioDetail(recordingId: string) {
  router.push({ pathname: '/studio/[id]', params: { id: recordingId } });
}

export function openStudioStats(recordingId: string) {
  router.push({ pathname: '/studio/stats', params: { id: recordingId } });
}
