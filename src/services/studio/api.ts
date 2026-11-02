import { requireSupabase } from '@/lib/supabase';
import {
  STUDIO_SELECT,
  STUDIO_SELECT_WITH_OWNER,
  type StudioCreateDraftInput,
  type StudioDailyStat,
  type StudioRecording,
  type StudioRecordingWithOwner,
  type StudioStatus,
  type StudioUpdateInput,
} from '@/services/studio/types';

function oneProfile(
  value:
    | StudioRecordingWithOwner['profiles']
    | StudioRecordingWithOwner['profiles'][]
    | null
    | undefined,
): StudioRecordingWithOwner['profiles'] {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function mapRow(row: Record<string, unknown>): StudioRecordingWithOwner {
  const profiles = oneProfile(row.profiles as StudioRecordingWithOwner['profiles'] | StudioRecordingWithOwner['profiles'][] | null);
  const { profiles: _drop, ...rest } = row;
  return { ...(rest as StudioRecording), profiles };
}

async function requireUserId() {
  const client = requireSupabase();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new Error('auth_required');
  return { client, userId: user.id };
}

export async function createDraft(input: StudioCreateDraftInput): Promise<StudioRecording> {
  const { client, userId } = await requireUserId();
  const title = input.title.trim();
  if (!title) throw new Error('title_required');

  const row = {
    owner_id: userId,
    content_type: input.content_type,
    title,
    description: input.description?.trim() || null,
    surah_number: input.surah_number ?? null,
    ayah_start: input.ayah_start ?? null,
    ayah_end: input.ayah_end ?? null,
    dua_id: input.dua_id ?? null,
    visibility: input.visibility ?? 'private',
    status: 'draft' as const,
  };

  const { data, error } = await client.from('studio_recordings').insert(row).select(STUDIO_SELECT).single();
  if (error) throw new Error(error.message);
  return data as StudioRecording;
}

export async function updateRecording(id: string, patch: StudioUpdateInput): Promise<StudioRecording> {
  const { client, userId } = await requireUserId();
  const payload: Record<string, unknown> = { ...patch, updated_at: new Date().toISOString() };
  if (typeof patch.title === 'string') payload.title = patch.title.trim();
  if (typeof patch.description === 'string') payload.description = patch.description.trim() || null;

  const { data, error } = await client
    .from('studio_recordings')
    .update(payload)
    .eq('id', id)
    .eq('owner_id', userId)
    .select(STUDIO_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return data as StudioRecording;
}

export async function listMine(status?: StudioStatus | 'all'): Promise<StudioRecording[]> {
  const { client, userId } = await requireUserId();
  let query = client
    .from('studio_recordings')
    .select(STUDIO_SELECT)
    .eq('owner_id', userId)
    .is('deleted_at', null)
    .neq('status', 'deleted')
    .order('updated_at', { ascending: false });
  if (status && status !== 'all') query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as StudioRecording[];
}

export async function listDiscover(opts?: {
  contentType?: 'quran' | 'dua' | 'all';
  sort?: 'new' | 'popular' | 'week';
  limit?: number;
}): Promise<StudioRecordingWithOwner[]> {
  const client = requireSupabase();
  const limit = opts?.limit ?? 24;
  let query = client
    .from('studio_recordings')
    .select(STUDIO_SELECT_WITH_OWNER)
    .eq('status', 'published')
    .eq('visibility', 'public')
    .is('deleted_at', null)
    .limit(limit);

  if (opts?.contentType === 'quran' || opts?.contentType === 'dua') {
    query = query.eq('content_type', opts.contentType);
  }

  if (opts?.sort === 'popular' || opts?.sort === 'week') {
    query = query.order('unique_listeners', { ascending: false }).order('play_count', { ascending: false });
  } else {
    query = query.order('published_at', { ascending: false });
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}

export async function fetchRecording(id: string): Promise<StudioRecordingWithOwner | null> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('studio_recordings')
    .select(STUDIO_SELECT_WITH_OWNER)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const mapped = mapRow(data as Record<string, unknown>);

  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return mapped;

  const [{ data: like }, { data: save }] = await Promise.all([
    client.from('studio_recording_likes').select('recording_id').eq('recording_id', id).eq('user_id', user.id).maybeSingle(),
    client.from('studio_recording_saves').select('recording_id').eq('recording_id', id).eq('user_id', user.id).maybeSingle(),
  ]);
  return { ...mapped, liked: Boolean(like), saved: Boolean(save) };
}

export async function submitRecording(id: string): Promise<StudioRecording> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('studio_submit_recording', { p_recording_id: id });
  if (error) throw new Error(error.message);
  return data as StudioRecording;
}

export async function softDelete(id: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('studio_soft_delete_recording', { p_recording_id: id });
  if (error) throw new Error(error.message);
}

export async function hideRecording(id: string, reason?: string): Promise<StudioRecording> {
  return moderateRecording(id, 'hide', reason);
}

export async function unhideRecording(id: string): Promise<StudioRecording> {
  return moderateRecording(id, 'unhide');
}

export async function toggleLike(id: string): Promise<{ liked: boolean; like_count: number }> {
  const { client, userId } = await requireUserId();
  const [{ data: existing, error: existingError }, { data: row }] = await Promise.all([
    client.from('studio_recording_likes').select('recording_id').eq('recording_id', id).eq('user_id', userId).maybeSingle(),
    client.from('studio_recordings').select('like_count').eq('id', id).maybeSingle(),
  ]);
  if (existingError) throw new Error(existingError.message);
  const current = (row?.like_count as number | undefined) ?? 0;

  if (existing) {
    const { error } = await client.from('studio_recording_likes').delete().eq('recording_id', id).eq('user_id', userId);
    if (error) throw new Error(error.message);
    return { liked: false, like_count: Math.max(0, current - 1) };
  }

  const { error } = await client.from('studio_recording_likes').insert({ recording_id: id, user_id: userId });
  if (error) throw new Error(error.message);
  return { liked: true, like_count: current + 1 };
}

export async function toggleSave(id: string): Promise<{ saved: boolean; save_count: number }> {
  const { client, userId } = await requireUserId();
  const [{ data: existing, error: existingError }, { data: row }] = await Promise.all([
    client.from('studio_recording_saves').select('recording_id').eq('recording_id', id).eq('user_id', userId).maybeSingle(),
    client.from('studio_recordings').select('save_count').eq('id', id).maybeSingle(),
  ]);
  if (existingError) throw new Error(existingError.message);
  const current = (row?.save_count as number | undefined) ?? 0;

  if (existing) {
    const { error } = await client.from('studio_recording_saves').delete().eq('recording_id', id).eq('user_id', userId);
    if (error) throw new Error(error.message);
    return { saved: false, save_count: Math.max(0, current - 1) };
  }

  const { error } = await client.from('studio_recording_saves').insert({ recording_id: id, user_id: userId });
  if (error) throw new Error(error.message);
  return { saved: true, save_count: current + 1 };
}

export async function recordListen(
  recordingId: string,
  listenedSeconds: number,
  clientSessionId?: string,
): Promise<{ ok: boolean; counted_play?: boolean; counted_unique?: boolean }> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('studio_record_listen', {
    p_recording_id: recordingId,
    p_listened_seconds: listenedSeconds,
    p_client_session_id: clientSessionId ?? null,
  });
  if (error) throw new Error(error.message);
  return (data ?? { ok: false }) as { ok: boolean; counted_play?: boolean; counted_unique?: boolean };
}

export async function moderateRecording(
  id: string,
  action: 'approve' | 'reject' | 'hide' | 'unhide',
  reason?: string,
): Promise<StudioRecording> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('studio_moderate_recording', {
    p_recording_id: id,
    p_action: action,
    p_reason: reason ?? null,
  });
  if (error) throw new Error(error.message);
  return data as StudioRecording;
}

export async function fetchOwnerRecordings(ownerId: string): Promise<StudioRecordingWithOwner[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('studio_recordings')
    .select(STUDIO_SELECT_WITH_OWNER)
    .eq('owner_id', ownerId)
    .eq('status', 'published')
    .eq('visibility', 'public')
    .is('deleted_at', null)
    .order('published_at', { ascending: false })
    .limit(40);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}

export async function fetchPendingForAdmin(): Promise<StudioRecordingWithOwner[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('studio_recordings')
    .select(STUDIO_SELECT_WITH_OWNER)
    .eq('status', 'pending_review')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}

export async function fetchDailyStats(recordingId: string, days = 30): Promise<StudioDailyStat[]> {
  const client = requireSupabase();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const day = since.toISOString().slice(0, 10);
  const { data, error } = await client
    .from('studio_recording_stats_daily')
    .select('recording_id, day, plays, unique_listeners, likes')
    .eq('recording_id', recordingId)
    .gte('day', day)
    .order('day', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as StudioDailyStat[];
}

export async function listSaved(): Promise<StudioRecordingWithOwner[]> {
  const { client, userId } = await requireUserId();
  const { data: saves, error: saveError } = await client
    .from('studio_recording_saves')
    .select('recording_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(40);
  if (saveError) throw new Error(saveError.message);
  const ids = (saves ?? []).map((row) => row.recording_id as string);
  if (!ids.length) return [];
  const { data, error } = await client
    .from('studio_recordings')
    .select(STUDIO_SELECT_WITH_OWNER)
    .in('id', ids)
    .eq('status', 'published')
    .is('deleted_at', null);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}

export async function listFollowingFeed(): Promise<StudioRecordingWithOwner[]> {
  const { client, userId } = await requireUserId();
  const { data: follows, error: followError } = await client
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId)
    .eq('status', 'accepted');
  if (followError) throw new Error(followError.message);
  const ids = (follows ?? []).map((row) => row.following_id as string);
  if (!ids.length) return [];
  const { data, error } = await client
    .from('studio_recordings')
    .select(STUDIO_SELECT_WITH_OWNER)
    .in('owner_id', ids)
    .eq('status', 'published')
    .eq('visibility', 'public')
    .is('deleted_at', null)
    .order('published_at', { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}
