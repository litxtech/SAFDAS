export type StudioContentType = 'quran' | 'dua';
export type StudioVisibility = 'public' | 'unlisted' | 'private';
export type StudioStatus =
  | 'draft'
  | 'uploading'
  | 'processing'
  | 'pending_review'
  | 'published'
  | 'hidden'
  | 'rejected'
  | 'deleted';

export type StudioRecording = {
  id: string;
  owner_id: string;
  content_type: StudioContentType;
  surah_number: number | null;
  ayah_start: number | null;
  ayah_end: number | null;
  dua_id: string | null;
  title: string;
  description: string | null;
  audio_path: string | null;
  audio_url: string | null;
  cover_path: string | null;
  cover_url: string | null;
  mime_type: string | null;
  duration_seconds: number;
  visibility: StudioVisibility;
  access_token: string | null;
  status: StudioStatus;
  comments_enabled: boolean;
  ownership_confirmed: boolean;
  reject_reason: string | null;
  unique_listeners: number;
  play_count: number;
  like_count: number;
  save_count: number;
  share_count: number;
  comment_count: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  deleted_at: string | null;
};

export type StudioRecordingWithOwner = StudioRecording & {
  profiles?: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  liked?: boolean;
  saved?: boolean;
};

export type StudioDailyStat = {
  recording_id: string;
  day: string;
  plays: number;
  unique_listeners: number;
  likes: number;
};

export type StudioCreateDraftInput = {
  content_type: StudioContentType;
  title: string;
  description?: string | null;
  surah_number?: number | null;
  ayah_start?: number | null;
  ayah_end?: number | null;
  dua_id?: string | null;
  visibility?: StudioVisibility;
};

export type StudioUpdateInput = {
  title?: string;
  description?: string | null;
  visibility?: StudioVisibility;
  comments_enabled?: boolean;
  ownership_confirmed?: boolean;
  audio_path?: string | null;
  audio_url?: string | null;
  cover_path?: string | null;
  cover_url?: string | null;
  mime_type?: string | null;
  duration_seconds?: number;
  status?: StudioStatus;
  surah_number?: number | null;
  ayah_start?: number | null;
  ayah_end?: number | null;
  dua_id?: string | null;
};

export const STUDIO_SELECT =
  'id, owner_id, content_type, surah_number, ayah_start, ayah_end, dua_id, title, description, audio_path, audio_url, cover_path, cover_url, mime_type, duration_seconds, visibility, access_token, status, comments_enabled, ownership_confirmed, reject_reason, unique_listeners, play_count, like_count, save_count, share_count, comment_count, created_at, updated_at, published_at, deleted_at';

export const STUDIO_SELECT_WITH_OWNER = `${STUDIO_SELECT}, profiles:owner_id(username, display_name, avatar_url)`;
