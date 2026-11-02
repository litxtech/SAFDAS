import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { requireSupabase } from '@/lib/supabase';
import { mergeNasipEntitlements } from '@/services/store/optimistic';
import type {
  NasipBlockedUser,
  NasipCandidateDetail,
  NasipClientConfig,
  NasipConversationSummary,
  NasipEntitlements,
  NasipIncomingRequest,
  NasipLocationRow,
  NasipMatch,
  NasipMessage,
  NasipMyProfile,
  NasipNotificationPatch,
  NasipOutgoingRequest,
  NasipPhotoAccessStatus,
  NasipPreferencesPatch,
  NasipPrivacyPatch,
  NasipProfilePatch,
  NasipProfileStats,
  NasipPublicCard,
  NasipReportReason,
  NasipReportRow,
  NasipSearchFilters,
  NasipThread,
  NasipVisitor,
} from './types';

const db = () => requireSupabase();

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await db().rpc(name, args);
  fail(error);
  return data as T;
}

// ── Profile ──────────────────────────────────────────────────────────────────
export async function fetchMyNasipProfile(): Promise<NasipMyProfile | null> {
  const { data, error } = await db().rpc('nasip_my_profile');
  fail(error);
  if (!data) return null;
  const bundle = data as NasipMyProfile;
  if (!bundle?.profile?.user_id) return null;
  return bundle;
}

export async function saveNasipProfile(patch: NasipProfilePatch): Promise<NasipMyProfile> {
  return rpc<NasipMyProfile>('nasip_save_profile', { p_patch: patch });
}

export async function saveNasipPreferences(patch: NasipPreferencesPatch): Promise<NasipMyProfile> {
  return rpc<NasipMyProfile>('nasip_save_preferences', { p_patch: patch });
}

export async function saveNasipPrivacy(patch: NasipPrivacyPatch): Promise<NasipMyProfile> {
  return rpc<NasipMyProfile>('nasip_save_privacy', { p_patch: patch });
}

export async function saveNasipNotificationPreferences(
  patch: NasipNotificationPatch,
): Promise<NasipMyProfile> {
  return rpc<NasipMyProfile>('nasip_save_notification_preferences', { p_patch: patch });
}

export async function fetchNasipProfileStats(): Promise<NasipProfileStats> {
  return rpc<NasipProfileStats>('nasip_profile_stats');
}

export async function setNasipFrozen(frozen: boolean): Promise<{ profile_status: string }> {
  return rpc('nasip_set_frozen', { p_frozen: frozen });
}

export async function deleteNasipProfile(): Promise<{
  deleted: boolean;
  photo_paths?: string[];
  verification_paths?: string[];
}> {
  const result = await rpc<{
    deleted: boolean;
    photo_paths?: string[];
    verification_paths?: string[];
  }>('nasip_delete_profile');
  const photoPaths = result.photo_paths ?? [];
  const verificationPaths = result.verification_paths ?? [];
  if (photoPaths.length) {
    await db().storage.from(PHOTO_BUCKET).remove(photoPaths).catch(() => undefined);
  }
  if (verificationPaths.length) {
    await db().storage.from(VERIFICATION_BUCKET).remove(verificationPaths).catch(() => undefined);
  }
  return result;
}

// ── Discovery ────────────────────────────────────────────────────────────────
export async function discoverNasipCandidates(limit = 12, offset = 0): Promise<NasipPublicCard[]> {
  const { data, error } = await db().rpc('nasip_discover', { p_limit: limit, p_offset: offset });
  fail(error);
  return (data ?? []) as NasipPublicCard[];
}

export async function searchNasipCandidates(
  filters: NasipSearchFilters,
  limit = 20,
  offset = 0,
): Promise<NasipPublicCard[]> {
  const { data, error } = await db().rpc('nasip_search_candidates', {
    p_genders: filters.genders?.length ? filters.genders : null,
    p_min_age: filters.minAge ?? null,
    p_max_age: filters.maxAge ?? null,
    p_city_ids: filters.cityIds?.length ? filters.cityIds : null,
    p_country_codes: filters.countryCodes?.length ? filters.countryCodes : null,
    p_education_levels: filters.educationLevels?.length ? filters.educationLevels : null,
    p_marital_statuses: filters.maritalStatuses?.length ? filters.maritalStatuses : null,
    p_has_children: filters.hasChildren ?? null,
    p_smoking: filters.smoking?.length ? filters.smoking : null,
    p_marriage_timelines: filters.marriageTimelines?.length ? filters.marriageTimelines : null,
    p_verified_only: filters.verifiedOnly ?? false,
    p_limit: limit,
    p_offset: offset,
  });
  fail(error);
  return (data ?? []) as NasipPublicCard[];
}

export async function fetchNasipCandidate(userId: string): Promise<NasipCandidateDetail> {
  return rpc<NasipCandidateDetail>('nasip_candidate_detail', { p_user: userId });
}

export async function recordNasipSkip(userId: string): Promise<void> {
  const { error } = await db().rpc('nasip_record_skip', { p_target: userId });
  fail(error);
}

export async function recordNasipVisit(userId: string): Promise<void> {
  const { error } = await db().rpc('nasip_record_visit', { p_profile: userId });
  fail(error);
}

// ── Introduction requests / matches ──────────────────────────────────────────
export async function sendNasipRequest(
  recipientId: string,
  message?: string | null,
): Promise<{ request_id: string; remaining: number; daily_limit: number }> {
  return rpc('nasip_send_request', {
    p_recipient: recipientId,
    p_message: message?.trim() ? message.trim() : null,
  });
}

export async function respondNasipRequest(
  requestId: string,
  action: 'accept' | 'decline' | 'block',
): Promise<{ status: string; match_id?: string; conversation_id?: string }> {
  return rpc('nasip_respond_request', { p_request: requestId, p_action: action });
}

export async function withdrawNasipRequest(requestId: string): Promise<void> {
  const { error } = await db().rpc('nasip_withdraw_request', { p_request: requestId });
  fail(error);
}

export async function fetchNasipIncomingRequests(): Promise<NasipIncomingRequest[]> {
  const { data, error } = await db().rpc('nasip_list_incoming_requests');
  fail(error);
  return (data ?? []) as NasipIncomingRequest[];
}

export async function fetchNasipOutgoingRequests(): Promise<NasipOutgoingRequest[]> {
  const { data, error } = await db().rpc('nasip_list_outgoing_requests');
  fail(error);
  return (data ?? []) as NasipOutgoingRequest[];
}

export async function fetchNasipMatches(): Promise<NasipMatch[]> {
  const { data, error } = await db().rpc('nasip_list_matches');
  fail(error);
  return (data ?? []) as NasipMatch[];
}

// ── Photos ───────────────────────────────────────────────────────────────────
export async function addNasipPhoto(path: string, primary = false): Promise<{ id: string }> {
  return rpc('nasip_add_photo', { p_path: path, p_primary: primary });
}

export async function deleteNasipPhoto(id: string): Promise<void> {
  const { error } = await db().rpc('nasip_delete_photo', { p_id: id });
  fail(error);
}

export async function setNasipPrimaryPhoto(id: string): Promise<void> {
  const { error } = await db().rpc('nasip_set_primary_photo', { p_id: id });
  fail(error);
}

export async function reorderNasipPhotos(ids: string[]): Promise<void> {
  const { error } = await db().rpc('nasip_reorder_photos', { p_ids: ids });
  fail(error);
}

const PHOTO_BUCKET = 'nasip-photos';
const VERIFICATION_BUCKET = 'nasip-verification';
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

async function uploadNative(
  bucket: string,
  path: string,
  uri: string,
  contentType: string,
  upsert = false,
) {
  const client = requireSupabase();
  const session = (await client.auth.getSession()).data.session;
  if (!session?.access_token) throw new Error('not_authenticated');
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
  if (!base) throw new Error('supabase_url_missing');
  const endpoint = `${base}/storage/v1/object/${bucket}/${path}`;
  const result = await FileSystem.uploadAsync(endpoint, uri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: anon,
      'Content-Type': contentType,
      'x-upsert': upsert ? 'true' : 'false',
    },
  });
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`upload_failed_${result.status}`);
  }
}

type NasipImageManipulator = {
  manipulateAsync?: (
    uri: string,
    actions: { resize: { width: number } }[],
    options: { compress: number; format: string },
  ) => Promise<{ uri: string }>;
  SaveFormat?: { JPEG?: string };
};

let manipulatorPromise: Promise<NasipImageManipulator | null> | null = null;

// Loaded lazily on purpose: this module is imported by route files, and a
// missing native module at import time would break the whole expo-router tree
// ("Unmatched Route" on every screen). Without the native module we simply
// upload the original file and let the size check below gate it.
function loadImageManipulator(): Promise<NasipImageManipulator | null> {
  if (!manipulatorPromise) {
    manipulatorPromise = import('expo-image-manipulator')
      .then((mod) => mod as unknown as NasipImageManipulator)
      .catch(() => null);
  }
  return manipulatorPromise;
}

async function compressNasipImage(uri: string): Promise<string> {
  const manipulator = await loadImageManipulator();
  if (!manipulator?.manipulateAsync) return uri;
  try {
    const result = await manipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1200 } }],
      { compress: 0.82, format: manipulator.SaveFormat?.JPEG ?? 'jpeg' },
    );
    return result?.uri || uri;
  } catch {
    return uri;
  }
}

export async function uploadNasipPhoto(userId: string, localUri: string, primary = false) {
  const compressed = await compressNasipImage(localUri);
  const path = `${userId}/${Date.now()}.jpg`;

  if (Platform.OS === 'web') {
    const response = await fetch(compressed);
    const blob = await response.blob();
    if (blob.size > MAX_UPLOAD_BYTES) throw new Error('file_too_large');
    const upload = await db().storage.from(PHOTO_BUCKET).upload(path, blob, {
      contentType: 'image/jpeg',
      upsert: false,
    });
    fail(upload.error);
  } else {
    const info = await FileSystem.getInfoAsync(compressed);
    if (info.exists && typeof info.size === 'number' && info.size > MAX_UPLOAD_BYTES) {
      throw new Error('file_too_large');
    }
    await uploadNative(PHOTO_BUCKET, path, compressed, 'image/jpeg');
  }

  try {
    return await addNasipPhoto(path, primary);
  } catch (error) {
    await db().storage.from(PHOTO_BUCKET).remove([path]).catch(() => undefined);
    throw error;
  }
}

export async function removeNasipPhoto(id: string, storagePath: string): Promise<void> {
  await deleteNasipPhoto(id);
  await db().storage.from(PHOTO_BUCKET).remove([storagePath]).catch(() => undefined);
}

export async function signedNasipPhoto(path: string | null, seconds = 3600): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await db().storage.from(PHOTO_BUCKET).createSignedUrl(path, seconds);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function signedNasipPhotos(paths: string[], seconds = 3600): Promise<Map<string, string>> {
  const unique = Array.from(new Set(paths.filter(Boolean)));
  if (!unique.length) return new Map();
  const { data, error } = await db().storage.from(PHOTO_BUCKET).createSignedUrls(unique, seconds);
  if (error || !data) return new Map();
  const map = new Map<string, string>();
  data.forEach((row, index) => {
    if (row?.signedUrl) map.set(unique[index]!, row.signedUrl);
  });
  return map;
}

// ── Verification ─────────────────────────────────────────────────────────────
export async function uploadNasipVerification(
  userId: string,
  kind: 'selfie' | 'id_document',
  localUri: string,
  contentType = 'image/jpeg',
) {
  const compressed = kind === 'selfie' ? await compressNasipImage(localUri) : localUri;
  const ext = contentType.includes('pdf') ? 'pdf' : 'jpg';
  const path = `${userId}/${kind}-${Date.now()}.${ext}`;
  if (Platform.OS === 'web') {
    const blob = await (await fetch(compressed)).blob();
    if (blob.size > 12 * 1024 * 1024) throw new Error('file_too_large');
    const upload = await db().storage.from(VERIFICATION_BUCKET).upload(path, blob, {
      contentType,
      upsert: false,
    });
    fail(upload.error);
  } else {
    await uploadNative(VERIFICATION_BUCKET, path, compressed, contentType);
  }
  return path;
}

export async function submitNasipVerification(
  kind: 'selfie' | 'id_document',
  selfiePath?: string | null,
  documentPath?: string | null,
): Promise<{ id: string; status: string }> {
  return rpc('nasip_submit_verification', {
    p_kind: kind,
    p_selfie_path: selfiePath ?? null,
    p_document_path: documentPath ?? null,
  });
}

// ── Photo access ─────────────────────────────────────────────────────────────
export async function fetchNasipPhotoAccessStatus(ownerId: string): Promise<NasipPhotoAccessStatus> {
  return rpc<NasipPhotoAccessStatus>('nasip_photo_access_status', { p_owner: ownerId });
}

export async function requestNasipPhotoAccess(ownerId: string): Promise<{ status: string }> {
  return rpc('nasip_request_photo_access', { p_owner: ownerId });
}

export async function respondNasipPhotoAccess(
  viewerId: string,
  allow: boolean,
): Promise<{ status: string }> {
  return rpc('nasip_respond_photo_access', { p_viewer: viewerId, p_allow: allow });
}

export async function fetchNasipPhotoAccessRequests(): Promise<{ card: NasipPublicCard; requested_at: string }[]> {
  const { data, error } = await db().rpc('nasip_photo_access_requests');
  fail(error);
  return (data ?? []) as { card: NasipPublicCard; requested_at: string }[];
}

// ── Conversations ────────────────────────────────────────────────────────────
export async function fetchNasipConversations(): Promise<NasipConversationSummary[]> {
  const { data, error } = await db().rpc('nasip_my_conversations');
  fail(error);
  return (data ?? []) as NasipConversationSummary[];
}

export async function fetchNasipThread(
  conversationId: string,
  before?: string | null,
  limit = 30,
): Promise<NasipThread> {
  return rpc<NasipThread>('nasip_conversation_thread', {
    p_conversation: conversationId,
    p_before: before ?? null,
    p_limit: limit,
  });
}

export async function sendNasipMessage(conversationId: string, body: string): Promise<NasipMessage> {
  return rpc<NasipMessage>('nasip_send_message', { p_conversation: conversationId, p_body: body });
}

export async function markNasipConversationRead(conversationId: string): Promise<void> {
  const { error } = await db().rpc('nasip_mark_conversation_read', { p_conversation: conversationId });
  fail(error);
}

export async function deleteNasipMessage(messageId: string): Promise<void> {
  const { error } = await db().rpc('nasip_delete_message', { p_message: messageId });
  fail(error);
}

export async function endNasipMatch(matchId: string, reason?: string): Promise<void> {
  const { error } = await db().rpc('nasip_end_match', {
    p_match: matchId,
    p_reason: reason?.trim() ? reason.trim() : null,
  });
  fail(error);
}

// ── Safety ───────────────────────────────────────────────────────────────────
export async function blockNasipUser(userId: string, reason?: string): Promise<void> {
  const { error } = await db().rpc('nasip_block_user', {
    p_user: userId,
    p_reason: reason?.trim() ? reason.trim() : null,
  });
  fail(error);
}

export async function unblockNasipUser(userId: string): Promise<void> {
  const { error } = await db().rpc('nasip_unblock_user', { p_user: userId });
  fail(error);
}

export async function fetchNasipBlockedUsers(): Promise<NasipBlockedUser[]> {
  const { data, error } = await db().rpc('nasip_blocked_users');
  fail(error);
  return (data ?? []) as NasipBlockedUser[];
}

export async function submitNasipReport(
  targetType: 'profile' | 'message' | 'conversation',
  targetId: string,
  reason: NasipReportReason,
  details?: string | null,
): Promise<{ id: string; reference_code: string; status: string }> {
  return rpc('nasip_submit_report', {
    p_target_type: targetType,
    p_target_id: targetId,
    p_reason: reason,
    p_details: details?.trim() ? details.trim() : null,
  });
}

export async function fetchNasipMyReports(): Promise<NasipReportRow[]> {
  const { data, error } = await db().rpc('nasip_my_reports');
  fail(error);
  return (data ?? []) as NasipReportRow[];
}

export async function fetchNasipVisitors(): Promise<NasipVisitor[]> {
  const { data, error } = await db().rpc('nasip_visitors');
  fail(error);
  return (data ?? []) as NasipVisitor[];
}

// ── Entitlements / purchases ─────────────────────────────────────────────────
export async function fetchNasipEntitlements(): Promise<NasipEntitlements> {
  const data = await rpc<NasipEntitlements>('nasip_my_entitlements');
  return mergeNasipEntitlements(data);
}

/** Admin-controlled, non-sensitive copy and store product metadata. */
export async function fetchNasipClientConfig(): Promise<NasipClientConfig> {
  return rpc<NasipClientConfig>('nasip_client_config');
}

export async function submitNasipReceipt(input: {
  platform: 'ios' | 'android';
  productId: string;
  transactionId: string;
  originalTransactionId?: string | null;
  purchaseToken?: string | null;
  receipt?: string | null;
  jws?: string | null;
}): Promise<{ status: string; event_id: string; message: string }> {
  return rpc('nasip_submit_purchase_receipt', {
    p_platform: input.platform,
    p_product_id: input.productId,
    p_transaction_id: input.transactionId,
    p_original_transaction_id: input.originalTransactionId ?? null,
    p_purchase_token: input.purchaseToken ?? null,
    p_receipt: input.receipt ?? null,
    p_jws: input.jws ?? null,
  });
}

export async function restoreNasipPurchases(platform?: 'ios' | 'android'): Promise<NasipEntitlements> {
  const data = await rpc<NasipEntitlements>('nasip_restore_purchases', { p_platform: platform ?? null });
  return mergeNasipEntitlements(data);
}

/**
 * Asks the verification edge function to confirm a queued receipt with the
 * store. The function is credential-gated; when it is not configured it returns
 * `pending_verification` and grants nothing.
 */
export async function verifyNasipReceiptWithServer(
  eventId: string,
  receipt?: string | null,
): Promise<{
  status: string;
  reason?: string;
  subscription?: unknown;
}> {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke('nasip-store-verify', {
    body: receipt ? { eventId, receipt } : { eventId },
  });
  if (error) throw new Error(error.message);
  return (data ?? { status: 'pending_verification' }) as {
    status: string;
    reason?: string;
    subscription?: unknown;
  };
}

/**
 * Re-verifies the user's latest queued receipt with the store (renewals, missed
 * webhooks, purchases queued while offline). Grants nothing locally: the server
 * only applies a confirmed store response.
 */
export async function syncNasipEntitlements(receipt?: string | null): Promise<{
  status: string;
  reason?: string;
  is_plus?: boolean;
  configured?: Record<string, boolean>;
}> {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke('nasip-store-verify', {
    body: receipt ? { sync: true, receipt } : { sync: true },
  });
  if (error) throw new Error(error.message);
  return (data ?? { status: 'pending_verification' }) as {
    status: string;
    reason?: string;
    is_plus?: boolean;
    configured?: Record<string, boolean>;
  };
}

// ── Locations (shared SAFDAŞ location catalogue) ─────────────────────────────
export async function fetchNasipCountries(): Promise<NasipLocationRow[]> {
  const { data, error } = await db()
    .from('job_locations')
    .select('id, country_code, country_name, city_name, district_name, level')
    .eq('level', 'country')
    .order('country_name', { ascending: true });
  fail(error);
  return (data ?? []) as NasipLocationRow[];
}

export async function fetchNasipCities(countryCode: string): Promise<NasipLocationRow[]> {
  if (!countryCode) return [];
  const { data, error } = await db()
    .from('job_locations')
    .select('id, country_code, country_name, city_name, district_name, level')
    .eq('level', 'city')
    .eq('country_code', countryCode)
    .order('sort_order', { ascending: true });
  fail(error);
  return (data ?? []) as NasipLocationRow[];
}

export async function fetchNasipDistricts(cityId: string): Promise<NasipLocationRow[]> {
  if (!cityId) return [];
  const primary = await db()
    .from('job_locations')
    .select('id, country_code, country_name, city_name, district_name, level')
    .eq('level', 'district')
    .like('id', `${cityId}:%`)
    .order('sort_order', { ascending: true });
  fail(primary.error);
  return (primary.data ?? []) as NasipLocationRow[];
}
