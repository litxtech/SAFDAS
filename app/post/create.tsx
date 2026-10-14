import { useState } from 'react';
import { Text } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/layout/Screen';
import { AppButton } from '@/components/ui/AppButton';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppInput } from '@/components/ui/AppInput';
import { useT } from '@/i18n';
import { requireSupabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { useTheme } from '@/theme/ThemeProvider';

export default function CreatePostScreen() {
  const { type } = useLocalSearchParams<{ type?: string }>();
  const { colors } = useTheme();
  const t = useT();
  const userId = useAuthStore((state) => state.session?.user.id);
  const show = useToastStore((state) => state.show);
  const [body, setBody] = useState('');
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaKind, setMediaKind] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function pick(kind: 'photo' | 'video') {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      show(t('galleryDenied'), 'error');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: kind === 'video' ? ['videos'] : ['images'],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > 50 * 1024 * 1024) {
      show(t('fileTooLarge'), 'error');
      return;
    }
    setMediaUri(asset.uri);
    setMediaKind(kind);
  }

  async function publish() {
    if (!userId || !body.trim()) {
      show(t('postTextRequired'), 'error');
      return;
    }
    setLoading(true);
    const client = requireSupabase();
    const { data: post, error } = await client.from('posts').insert({ author_id: userId, body: body.trim(), kind: type ?? 'text' }).select('id').single();
    if (error || !post) {
      setLoading(false);
      show(error?.message ?? t('postSaveFailed'), 'error');
      return;
    }
    if (mediaUri && mediaKind) {
      const response = await fetch(mediaUri);
      const bytes = await response.arrayBuffer();
      const path = `${userId}/${post.id}`;
      const upload = await client.storage.from('post-media').upload(path, bytes, {
        contentType: mediaKind === 'video' ? 'video/mp4' : 'image/jpeg',
        upsert: true,
      });
      if (upload.error) {
        setLoading(false);
        show(upload.error.message, 'error');
        return;
      }
      const { data } = client.storage.from('post-media').getPublicUrl(path);
      await client.from('post_media').insert({ post_id: post.id, url: data.publicUrl, media_type: mediaKind });
    }
    setLoading(false);
    show(t('postShared'), 'success');
    router.back();
  }

  return (
    <Screen scroll>
      <AppHeader title={t('share')} subtitle={type === 'ayah' ? t('ayah') : type === 'dua' ? t('duas') : t('postType')} />
      <AppInput label={t('fieldText')} multiline value={body} onChangeText={setBody} style={{ minHeight: 140, textAlignVertical: 'top' }} />
      <Text style={{ color: colors.textSecondary }}>{mediaUri ? t('mediaSelected') : t('mediaHint')}</Text>
      <AppButton label={t('pickPhoto')} variant="secondary" onPress={() => void pick('photo')} />
      <AppButton label={t('pickVideo')} variant="secondary" onPress={() => void pick('video')} />
      <AppButton label={t('share')} loading={loading} onPress={() => void publish()} />
    </Screen>
  );
}
