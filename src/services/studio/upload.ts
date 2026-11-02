import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { decodeBase64 } from '@/lib/bytes';
import { requireSupabase } from '@/lib/supabase';

const AUDIO_BUCKET = 'studio-audio';
const COVER_BUCKET = 'studio-audio';

async function uploadBytes(bucket: string, path: string, bytes: Uint8Array, contentType: string) {
  const client = requireSupabase();
  const upload = await client.storage.from(bucket).upload(path, bytes, { contentType, upsert: true });
  if (upload.error) throw new Error(upload.error.message);
  return client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

async function readLocalBytes(localUri: string): Promise<Uint8Array> {
  if (Platform.OS === 'web') {
    const response = await fetch(localUri);
    return new Uint8Array(await response.arrayBuffer());
  }
  const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
  return decodeBase64(base64);
}

export async function uploadStudioAudio(
  localUri: string,
  userId: string,
  recordingId: string,
): Promise<{ path: string; url: string; mimeType: string }> {
  const path = `${userId}/${recordingId}/audio.m4a`;
  const mimeType = 'audio/m4a';

  if (Platform.OS !== 'web') {
    const client = requireSupabase();
    const session = (await client.auth.getSession()).data.session;
    if (!session?.access_token) throw new Error('not_authenticated');
    const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
    if (!base) throw new Error('supabase_url_missing');
    const endpoint = `${base}/storage/v1/object/${AUDIO_BUCKET}/${path}`;
    const result = await FileSystem.uploadAsync(endpoint, localUri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: anon,
        'Content-Type': mimeType,
        'x-upsert': 'true',
      },
    });
    if (result.status < 200 || result.status >= 300) {
      const detail = typeof result.body === 'string' && result.body.trim() ? result.body.trim() : `upload_failed_${result.status}`;
      throw new Error(detail);
    }
    const url = client.storage.from(AUDIO_BUCKET).getPublicUrl(path).data.publicUrl;
    return { path, url, mimeType };
  }

  const bytes = await readLocalBytes(localUri);
  const url = await uploadBytes(AUDIO_BUCKET, path, bytes, mimeType);
  return { path, url, mimeType };
}

export async function uploadStudioCover(
  localUri: string,
  userId: string,
  recordingId: string,
  mimeType = 'image/jpeg',
): Promise<{ path: string; url: string }> {
  const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
  const path = `${userId}/${recordingId}/cover.${ext}`;
  const bytes = await readLocalBytes(localUri);
  const url = await uploadBytes(COVER_BUCKET, path, bytes, mimeType);
  return { path, url };
}
