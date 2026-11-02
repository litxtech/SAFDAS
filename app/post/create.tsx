import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/layout/Screen';
import { AppAvatar } from '@/components/ui/AppAvatar';
import { useT } from '@/i18n';
import { decodeBase64 } from '@/lib/bytes';
import { requireSupabase } from '@/lib/supabase';
import { searchPeople, type Person } from '@/services/social';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { useTheme } from '@/theme/ThemeProvider';

type LocalMedia = { uri: string; kind: 'photo' | 'video'; remote?: boolean; base64?: string | null; mimeType?: string | null; fileName?: string | null };
type Visibility = 'public' | 'followers' | 'private';
type QuotePreview = {
  id: string;
  body: string | null;
  media: { url: string; media_type: string | null }[];
  profiles: { username: string | null; display_name: string | null; avatar_url: string | null } | null;
};
const DRAFT_KEY = 'safdas:post-draft';
const EMOJI = ['🤲', '🕌', '📖', '🌙', '✨', '❤️'];

function oneParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value || undefined;
}

export default function CreatePostScreen() {
  const params = useLocalSearchParams<{ type?: string; id?: string; quoteId?: string; studioId?: string }>();
  const type = oneParam(params.type);
  const id = oneParam(params.id);
  const quoteId = oneParam(params.quoteId);
  const studioId = oneParam(params.studioId);
  const { colors } = useTheme();
  const t = useT();
  const queryClient = useQueryClient();
  const profile = useAuthStore((state) => state.profile);
  const userId = useAuthStore((state) => state.session?.user.id);
  const show = useToastStore((state) => state.show);
  const [body, setBody] = useState('');
  const [media, setMedia] = useState<LocalMedia[]>([]);
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [locationName, setLocationName] = useState<string | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [mentions, setMentions] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [quote, setQuote] = useState<QuotePreview | null>(null);
  const publishing = useRef(false);
  const quoting = Boolean(quoteId) && !id;

  useEffect(() => {
    if (id && userId) {
      void requireSupabase()
        .from('posts')
        .select('body, visibility, post_media(url, media_type)')
        .eq('id', id)
        .eq('author_id', userId)
        .maybeSingle()
        .then(({ data }) => {
          if (!data) return;
          setBody((data.body as string | null) ?? '');
          setVisibility((data.visibility as Visibility) ?? 'public');
          const rows = (data.post_media as { url: string; media_type: string | null }[] | null) ?? [];
          setMedia(rows.map((row) => ({ uri: row.url, kind: row.media_type === 'video' ? 'video' : 'photo', remote: true })));
        });
      return;
    }
    if (quoteId) {
      void requireSupabase()
        .from('posts')
        .select('id, body, profiles(username, display_name, avatar_url), post_media(url, media_type)')
        .eq('id', quoteId)
        .is('archived_at', null)
        .maybeSingle()
        .then(({ data }) => {
          if (!data) {
            setQuote(null);
            return;
          }
          const profilesRaw = data.profiles as
            | QuotePreview['profiles']
            | QuotePreview['profiles'][]
            | null;
          const profiles = Array.isArray(profilesRaw) ? profilesRaw[0] ?? null : profilesRaw;
          setQuote({
            id: data.id as string,
            body: (data.body as string | null) ?? null,
            media: ((data.post_media as { url: string; media_type: string | null }[] | null) ?? []).filter((row) => row.url),
            profiles,
          });
        });
      return;
    }
    void AsyncStorage.getItem(DRAFT_KEY).then((raw) => {
      if (!raw) return;
      const draft = JSON.parse(raw) as { body?: string; visibility?: Visibility };
      if (draft.body) setBody(draft.body);
      if (draft.visibility) setVisibility(draft.visibility);
    });
  }, [id, quoteId, userId]);

  useEffect(() => {
    if (id || quoting) return;
    const handle = setTimeout(() => {
      void AsyncStorage.setItem(DRAFT_KEY, JSON.stringify({ body, visibility }));
    }, 400);
    return () => clearTimeout(handle);
  }, [body, visibility, id, quoting]);

  useEffect(() => {
    const match = body.match(/(?:^|\s)@([^\s@]{2,})$/);
    const term = match?.[1];
    if (!term) {
      setMentions([]);
      return;
    }
    const handle = setTimeout(() => {
      void searchPeople(term).then(setMentions).catch(() => setMentions([]));
    }, 250);
    return () => clearTimeout(handle);
  }, [body]);

  async function pick(kind: 'photo' | 'video', camera = false) {
    const permission = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      show(t('galleryDenied'), 'error');
      return;
    }
    const result = camera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: kind === 'video' ? ['videos'] : ['images'], quality: 0.8, base64: kind === 'photo' })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: kind === 'video' ? ['videos'] : ['images'], quality: 0.8, base64: kind === 'photo', allowsMultipleSelection: kind === 'photo', selectionLimit: 6 });
    if (result.canceled) return;
    const next = result.assets.filter((asset) => !asset.fileSize || asset.fileSize <= 50 * 1024 * 1024).map((asset) => ({
      uri: asset.uri,
      kind,
      base64: asset.base64,
      mimeType: asset.mimeType,
      fileName: asset.fileName,
    }));
    if (next.length !== result.assets.length) show(t('fileTooLarge'), 'error');
    setMedia((current) => [...current, ...next].slice(0, 6));
  }

  async function addLocation() {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      show(t('locationDenied'), 'error');
      return;
    }
    const position = await Location.getCurrentPositionAsync({});
    const places = await Location.reverseGeocodeAsync(position.coords);
    const place = places[0];
    const label = [place?.city || place?.district, place?.country].filter(Boolean).join(', ');
    if (!label) return;
    setLocationName(label);
    show(t('locationAdded'), 'success');
  }

  function fileExtension(item: LocalMedia) {
    const fromName = item.fileName?.split('.').pop()?.toLowerCase();
    if (fromName && fromName.length <= 4 && fromName !== item.fileName?.toLowerCase()) return fromName === 'jpeg' ? 'jpg' : fromName;
    const mime = item.mimeType ?? '';
    if (mime.includes('png')) return 'png';
    if (mime.includes('webp')) return 'webp';
    if (mime.includes('gif')) return 'gif';
    if (mime.includes('quicktime')) return 'mov';
    if (mime.includes('webm')) return 'webm';
    return item.kind === 'video' ? 'mp4' : 'jpg';
  }

  async function uploadMedia(postId: string, item: LocalMedia, index: number) {
    if (item.remote) return item.uri;
    const client = requireSupabase();
    const bytes = item.base64 ? decodeBase64(item.base64) : new Uint8Array(await (await fetch(item.uri)).arrayBuffer());
    if (!bytes.byteLength) throw new Error(t('postSaveFailed'));
    const extension = fileExtension(item);
    const path = `${userId}/${postId}/${index}.${extension}`;
    const upload = await client.storage.from('post-media').upload(path, bytes, {
      contentType: item.mimeType ?? (item.kind === 'video' ? 'video/mp4' : 'image/jpeg'),
      upsert: true,
    });
    if (upload.error) throw upload.error;
    return client.storage.from('post-media').getPublicUrl(path).data.publicUrl;
  }

  async function publish() {
    if (!userId || publishing.current) return;
    if (!body.trim() && media.length === 0 && !quoting && !studioId) {
      show(t('emptyPost'), 'error');
      return;
    }
    if (quoting && !quoteId) {
      show(t('quoteUnavailable'), 'error');
      return;
    }
    publishing.current = true;
    setLoading(true);
    setProgress(0);
    const db = requireSupabase();
    const postKind = quoting
      ? 'quote'
      : studioId || type === 'studio'
        ? 'studio'
        : type === 'dua' || type === 'ayah' || type === 'text' || type === 'photo' || type === 'video'
          ? type
          : media[0]?.kind ?? 'text';
    try {
      let postId = id;
      if (postId) {
        const updatePayload: Record<string, unknown> = { body: body.trim(), visibility, kind: postKind };
        if (studioId) updatePayload.studio_recording_id = studioId;
        const { error } = await db.from('posts').update(updatePayload).eq('id', postId).eq('author_id', userId);
        if (error) throw error;
        await db.from('post_media').delete().eq('post_id', postId);
      } else {
        const quotedPostId = quoting ? quoteId ?? null : null;
        if (quoting && !quotedPostId) {
          show(t('quoteUnavailable'), 'error');
          throw new Error(t('quoteUnavailable'));
        }
        const base = {
          author_id: userId,
          body: body.trim() || null,
          kind: postKind,
          visibility,
          location_name: locationName,
          ...(quotedPostId ? { quoted_post_id: quotedPostId } : {}),
          ...(studioId ? { studio_recording_id: studioId } : {}),
        };
        let inserted = await db.from('posts').insert(base).select('id').single();
        if (inserted.error && /studio_recording_id/.test(inserted.error.message)) {
          const { studio_recording_id: _dropStudio, ...withoutStudio } = base;
          inserted = await db.from('posts').insert(withoutStudio).select('id').single();
        }
        if (inserted.error && /location_name/.test(inserted.error.message) && !/quoted_post_id/.test(inserted.error.message)) {
          const { location_name: _drop, ...withoutLocation } = base;
          inserted = await db.from('posts').insert(withoutLocation).select('id').single();
        }
        if (inserted.error && /quoted_post_id/.test(inserted.error.message)) {
          show(t('quoteUnavailable'), 'error');
          throw inserted.error;
        }
        if (inserted.error || !inserted.data) throw inserted.error ?? new Error('post');
        postId = inserted.data.id as string;
      }
      for (let index = 0; index < media.length; index += 1) {
        const item = media[index];
        if (!item || !postId) continue;
        const url = await uploadMedia(postId, item, index);
        await db.from('post_media').insert({ post_id: postId, url, media_type: item.kind });
        setProgress((index + 1) / media.length);
      }
      await AsyncStorage.removeItem(DRAFT_KEY);
      void queryClient.invalidateQueries({ queryKey: ['feed'] });
      void queryClient.invalidateQueries({ queryKey: ['author-posts'] });
      void queryClient.invalidateQueries({ queryKey: ['profile-stats'] });
      show(id ? t('postUpdated') : t('postShared'), 'success');
      router.back();
    } catch (error) {
      show(error instanceof Error ? error.message : t('postSaveFailed'), 'error');
    } finally {
      publishing.current = false;
      setLoading(false);
    }
  }

  const name = profile?.display_name || profile?.username || t('userFallback');
  const quoteName = quote?.profiles?.display_name || quote?.profiles?.username || t('userFallback');
  const quoteHandle = quote?.profiles?.username ?? t('userFallback');
  return (
    <Screen padded={false} back={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, minHeight: 48 }}>
        <Pressable onPress={() => router.back()} hitSlop={8}><Text style={{ color: colors.textSecondary, fontWeight: '700' }}>{t('cancel')}</Text></Pressable>
        <Text style={{ color: colors.text, fontWeight: '700' }}>{id ? t('editPost') : quoting ? t('quotePostTitle') : t('newPost')}</Text>
        <Pressable onPress={() => void publish()} disabled={loading} hitSlop={8}>
          {loading ? <ActivityIndicator color={colors.primary} /> : <Text style={{ color: colors.primary, fontWeight: '800' }}>{t('publish')}</Text>}
        </Pressable>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <AppAvatar uri={profile?.avatar_url} name={name} size={40} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{name}</Text>
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder={quoting ? t('quotePostHint') : t('fieldText')}
              placeholderTextColor={colors.textSecondary}
              multiline
              style={{ color: colors.text, fontSize: 17, lineHeight: 24, minHeight: quoting ? 88 : 120, textAlignVertical: 'top' }}
            />
          </View>
        </View>
        {studioId ? (
          <View style={{ borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: 14, padding: 12 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{t('studioSharePost')}</Text>
            <Text style={{ color: colors.text, fontWeight: '700', marginTop: 4 }} numberOfLines={1}>
              Studio · {studioId.slice(0, 8)}…
            </Text>
          </View>
        ) : null}
        {quoting ? (
          <View style={{ borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: 14, padding: 12, gap: 8 }}>
            {quote ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <AppAvatar uri={quote.profiles?.avatar_url} name={quoteName} size={24} />
                  <Text style={{ color: colors.text, fontWeight: '700', flexShrink: 1 }} numberOfLines={1}>
                    {quoteName}
                  </Text>
                  <Text style={{ color: colors.textSecondary, flexShrink: 1 }} numberOfLines={1}>
                    @{quoteHandle}
                  </Text>
                </View>
                {quote.body ? (
                  <Text style={{ color: colors.text, fontSize: 15, lineHeight: 21 }} numberOfLines={6}>
                    {quote.body}
                  </Text>
                ) : null}
                {quote.media[0]?.url ? (
                  <Image source={{ uri: quote.media[0].url }} style={{ width: '100%', height: 160, borderRadius: 12 }} contentFit="cover" />
                ) : null}
                {!quote.body && !quote.media[0]?.url ? (
                  <Text style={{ color: colors.textSecondary }}>{t('quoteUnavailable')}</Text>
                ) : null}
              </>
            ) : (
              <Text style={{ color: colors.textSecondary }}>{t('quoteUnavailable')}</Text>
            )}
          </View>
        ) : null}
        {mentions.map((person) => (
          <Pressable
            key={person.id}
            onPress={() => setBody((current) => current.replace(/@([^\s@]{2,})$/, `@${person.username ?? ''} `))}
            style={{ minHeight: 40, justifyContent: 'center' }}
          >
            <Text style={{ color: colors.text }}>@{person.username} · {person.display_name}</Text>
          </Pressable>
        ))}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {media.map((item, index) => (
            <View key={`${item.uri}${index}`} style={{ width: 112, gap: 6 }}>
              {item.kind === 'photo' ? (
                <Image source={{ uri: item.uri }} style={{ width: 112, height: 140, borderRadius: 12 }} contentFit="cover" />
              ) : (
                <View style={{ width: 112, height: 140, borderRadius: 12, backgroundColor: colors.backgroundSecondary, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="videocam" size={28} color={colors.primary} />
                </View>
              )}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Pressable onPress={() => setMedia((current) => index === 0 ? current : [...current.slice(0, index - 1), current[index] as LocalMedia, current[index - 1] as LocalMedia, ...current.slice(index + 1)])}><Ionicons name="chevron-back" size={18} color={colors.icon} /></Pressable>
                <Pressable onPress={() => setMedia((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Ionicons name="close" size={18} color={colors.error} /></Pressable>
                <Pressable onPress={() => setMedia((current) => index >= current.length - 1 ? current : [...current.slice(0, index), current[index + 1] as LocalMedia, current[index] as LocalMedia, ...current.slice(index + 2)])}><Ionicons name="chevron-forward" size={18} color={colors.icon} /></Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['public', 'followers', 'private'] as const).map((item) => (
            <Pressable key={item} onPress={() => setVisibility(item)} style={{ paddingHorizontal: 10, minHeight: 32, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: visibility === item ? colors.primaryMuted : colors.backgroundSecondary }}>
              <Text style={{ color: visibility === item ? colors.primary : colors.textSecondary, fontWeight: '700', fontSize: 12 }}>
                {item === 'public' ? t('visibilityPublic') : item === 'followers' ? t('visibilityFollowers') : t('visibilityPrivate')}
              </Text>
            </Pressable>
          ))}
        </View>
        {locationName ? <Text style={{ color: colors.textSecondary }}>{locationName}</Text> : null}
        {loading && media.length ? <Text style={{ color: colors.textSecondary }}>{t('uploadingMedia', { percent: Math.round(progress * 100) })}</Text> : null}
        {emojiOpen ? (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {EMOJI.map((emoji) => (
              <Pressable key={emoji} onPress={() => setBody((current) => `${current}${emoji}`)} style={{ minWidth: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 22 }}>{emoji}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingVertical: 8, backgroundColor: colors.background }}>
        <Tool icon="image-outline" label={t('pickPhoto')} color={colors.primary} onPress={() => void pick('photo')} />
        <Tool icon="videocam-outline" label={t('pickVideo')} color={colors.primary} onPress={() => void pick('video')} />
        <Tool icon="camera-outline" label={t('camera')} color={colors.primary} onPress={() => void pick('photo', true)} />
        <Tool icon="happy-outline" label={t('addEmoji')} color={colors.primary} onPress={() => setEmojiOpen((value) => !value)} />
        <Tool icon="location-outline" label={t('addLocation')} color={colors.primary} onPress={() => void addLocation()} />
      </View>
    </Screen>
  );
}

function Tool({ icon, label, color, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; color: string; onPress: () => void }) {
  return (
    <Pressable accessibilityLabel={label} onPress={onPress} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={24} color={color} />
    </Pressable>
  );
}
