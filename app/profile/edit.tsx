import { useState } from 'react';
import { Text } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Screen } from '@/components/layout/Screen';
import { AppButton } from '@/components/ui/AppButton';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppInput } from '@/components/ui/AppInput';
import { AppSwitch } from '@/components/ui/AppSwitch';
import { useT } from '@/i18n';
import { requireSupabase } from '@/lib/supabase';
import { useAuthStore, type Profile } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { useTheme } from '@/theme/ThemeProvider';

export default function EditProfileScreen() {
  const t = useT();
  const profile = useAuthStore((state) => state.profile);
  const setProfile = useAuthStore((state) => state.setProfile);
  const show = useToastStore((state) => state.show);
  const { colors } = useTheme();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [city, setCity] = useState(profile?.city ?? '');
  const [country, setCountry] = useState(profile?.country ?? '');
  const [isPrivate, setPrivate] = useState(profile?.is_private ?? false);
  const [loading, setLoading] = useState(false);

  async function upload(kind: 'avatar' | 'cover') {
    if (!profile) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      show('Galeri izni gerekli.', 'error');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true });
    const asset = result.assets?.[0];
    if (!asset) return;
    const bytes = await (await fetch(asset.uri)).arrayBuffer();
    const path = `${profile.id}/${kind}`;
    const bucket = kind === 'avatar' ? 'avatars' : 'covers';
    const uploadResult = await requireSupabase().storage.from(bucket).upload(path, bytes, { upsert: true, contentType: 'image/jpeg' });
    if (uploadResult.error) {
      show(uploadResult.error.message, 'error');
      return;
    }
    const url = requireSupabase().storage.from(bucket).getPublicUrl(path).data.publicUrl;
    const patch = kind === 'avatar' ? { avatar_url: url } : { cover_url: url };
    await requireSupabase().from('profiles').update(patch).eq('id', profile.id);
    setProfile({ ...profile, ...patch });
    show(t('photoUpdated'), 'success');
  }

  async function save() {
    if (!profile) return;
    setLoading(true);
    const patch = {
      display_name: displayName.trim(),
      username: username.trim().toLowerCase(),
      bio,
      city,
      country,
      is_private: isPrivate,
    };
    const { error } = await requireSupabase().from('profiles').update(patch).eq('id', profile.id);
    setLoading(false);
    if (error) show(error.message, 'error');
    else {
      setProfile({ ...profile, ...patch } as Profile);
      show('Profil kaydedildi.', 'success');
      router.back();
    }
  }

  return (
    <Screen scroll>
      <AppHeader title={t('editProfile')} />
      <AppButton label={t('avatar')} variant="secondary" onPress={() => void upload('avatar')} />
      <AppButton label={t('cover')} variant="secondary" onPress={() => void upload('cover')} />
      <AppInput label={t('displayName')} value={displayName} onChangeText={setDisplayName} />
      <AppInput label={t('username')} autoCapitalize="none" value={username} onChangeText={setUsername} />
      <AppInput label={t('bio')} multiline value={bio} onChangeText={setBio} style={{ minHeight: 100, textAlignVertical: 'top' }} />
      <AppInput label={t('city')} value={city} onChangeText={setCity} />
      <AppInput label={t('country')} value={country} onChangeText={setCountry} />
      <AppSwitch label={t('privateAccount')} value={isPrivate} onValueChange={setPrivate} />
      <Text style={{ color: colors.textSecondary }}>{t('privateFollowHint')}</Text>
      <AppButton label={t('save')} loading={loading} onPress={() => void save()} />
    </Screen>
  );
}
