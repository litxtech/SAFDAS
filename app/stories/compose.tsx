import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/layout/Screen';
import { AppBottomSheet } from '@/components/ui/AppBottomSheet';
import { AppInput } from '@/components/ui/AppInput';
import { useFeatureT } from '@/i18n/features';
import { useI18nStore } from '@/i18n';
import { decodeBase64 } from '@/lib/bytes';
import { requireSupabase } from '@/lib/supabase';
import { useSelectedReciter } from '@/hooks/useSelectedReciter';
import { loadDuas } from '@/services/duas';
import { fetchSurahList } from '@/services/quran';
import {
  fetchStoryCategories,
  fetchStoryDetail,
  saveStory,
  storyCategoryName,
} from '@/services/stories/api';
import type { StorySaveInput } from '@/services/stories/types';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { useTheme } from '@/theme/ThemeProvider';

type PickerItem = { key: string; label: string; hint?: string };

export default function StoryComposeScreen() {
  const { colors } = useTheme();
  const t = useFeatureT();
  const locale = useI18nStore((state) => state.locale);
  const show = useToastStore((state) => state.show);
  const userId = useAuthStore((state) => state.session?.user.id);
  const reciter = useSelectedReciter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const storyId = typeof id === 'string' ? id : null;

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [pseudonymous, setPseudonymous] = useState(false);
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const [contactEnabled, setContactEnabled] = useState(true);
  const [supportEnabled, setSupportEnabled] = useState(true);
  const [linked, setLinked] = useState<StorySaveInput['linked']>(null);
  const [saving, setSaving] = useState<'draft' | 'published' | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerKind, setPickerKind] = useState<'quran' | 'dua'>('quran');
  const [pickerSearch, setPickerSearch] = useState('');
  const hydrated = useRef(false);

  const categories = useQuery({
    queryKey: ['story-categories'],
    staleTime: 10 * 60_000,
    queryFn: () => fetchStoryCategories(),
  });

  const detail = useQuery({
    queryKey: ['story', storyId],
    enabled: Boolean(storyId),
    staleTime: Infinity,
    queryFn: () => fetchStoryDetail(storyId!),
  });

  const surahs = useQuery({
    queryKey: ['quran-surahs', locale],
    enabled: pickerOpen && pickerKind === 'quran',
    staleTime: 60 * 60_000,
    queryFn: () => fetchSurahList(locale),
  });

  const duas = useQuery({
    queryKey: ['duas-locale', locale],
    enabled: pickerOpen && pickerKind === 'dua',
    staleTime: 30 * 60_000,
    queryFn: () => loadDuas(locale),
  });

  useEffect(() => {
    if (!detail.data || hydrated.current) return;
    hydrated.current = true;
    const d = detail.data;
    setTitle(d.title);
    setBody(d.body);
    setCategoryId(d.category_id);
    setCoverUrl(d.cover_url);
    setPseudonymous(d.pseudonymous);
    setCommentsEnabled(d.comments_enabled);
    setContactEnabled(d.contact_enabled);
    setSupportEnabled(d.support_enabled);
    setLinked(
      d.linked
        ? { kind: d.linked.kind, key: d.linked.key, label: d.linked.label ?? d.linked.key, reciterId: d.linked.reciter_id ?? undefined }
        : null,
    );
  }, [detail.data]);

  useEffect(() => {
    if (storyId || hydrated.current) return;
    if (!categories.data?.length) return;
    const first = categories.data[0];
    if (!first) return;
    hydrated.current = true;
    setCategoryId(first.id);
  }, [categories.data, storyId]);

  async function pickCover() {
    if (!userId || uploading) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      show(t('storiesSaveFailed'), 'error');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      base64: true,
      allowsEditing: true,
      aspect: [16, 9],
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    setUploading(true);
    try {
      const bytes = asset.base64
        ? decodeBase64(asset.base64)
        : new Uint8Array(await (await fetch(asset.uri)).arrayBuffer());
      const extension = asset.mimeType?.includes('png') ? 'png' : asset.mimeType?.includes('webp') ? 'webp' : 'jpg';
      // The public URL of a pseudonymous story must never contain the author's
      // UUID, so covers live in a random-named object in their own bucket.
      const objectName = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}.${extension}`;
      const client = requireSupabase();
      const upload = await client.storage.from('story-covers').upload(objectName, bytes, {
        contentType: asset.mimeType ?? 'image/jpeg',
        upsert: false,
      });
      if (upload.error) throw upload.error;
      setCoverUrl(client.storage.from('story-covers').getPublicUrl(objectName).data.publicUrl);
    } catch (error) {
      show(error instanceof Error ? error.message : t('storiesSaveFailed'), 'error');
    } finally {
      setUploading(false);
    }
  }

  async function save(status: 'draft' | 'published') {
    if (saving) return;
    if (title.trim().length < 3) {
      show(t('storiesTitleTooShort'), 'error');
      return;
    }
    if (!body.trim()) {
      show(t('storiesBodyRequired'), 'error');
      return;
    }
    if (status === 'published' && body.trim().length < 120) {
      show(t('storiesBodyTooShort'), 'error');
      return;
    }
    setSaving(status);
    try {
      const result = await saveStory({
        id: storyId,
        title,
        body,
        categoryId,
        coverUrl,
        pseudonymous,
        commentsEnabled,
        contactEnabled: pseudonymous ? false : contactEnabled,
        supportEnabled,
        status,
        linked,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['stories-feed'] }),
        queryClient.invalidateQueries({ queryKey: ['stories-home'] }),
        queryClient.invalidateQueries({ queryKey: ['stories-journey'] }),
        queryClient.invalidateQueries({ queryKey: ['stories-mine'] }),
        queryClient.invalidateQueries({ queryKey: ['story', result.id] }),
      ]);
      if (status === 'draft') {
        show(t('storiesDraft'), 'success');
        router.replace('/stories/my');
      } else {
        show(t('storiesPublish'), 'success');
        router.replace({ pathname: '/stories/[id]', params: { id: result.id } });
      }
    } catch (error) {
      show(error instanceof Error ? error.message : t('storiesSaveFailed'), 'error');
    } finally {
      setSaving(null);
    }
  }

  function confirmDraft() {
    if (saving) return;
    Alert.alert(t('storiesDraft'), t('storiesDraftConfirm'), [
      { text: 'Vazgeç', style: 'cancel' },
      { text: t('storiesDraft'), onPress: () => void save('draft') },
    ]);
  }

  const pickerItems: PickerItem[] =
    pickerKind === 'quran'
      ? (surahs.data ?? []).map((surah) => ({
          key: `quran:${surah.number}`,
          label: `${surah.number}. ${surah.englishNameTranslation}`,
          hint: surah.englishName,
        }))
      : (duas.data ?? [])
          .filter((dua) => Boolean(dua.slug))
          .map((dua) => ({
            key: `dua:${dua.slug}`,
            label: dua.title ?? dua.slug ?? '',
            hint: dua.source ?? undefined,
          }));

  const filteredItems = pickerSearch.trim()
    ? pickerItems.filter((item) =>
        `${item.label} ${item.hint ?? ''}`.toLocaleLowerCase(locale).includes(pickerSearch.trim().toLocaleLowerCase(locale)),
      )
    : pickerItems;

  if (storyId && detail.isLoading) {
    return (
      <Screen back>
        <View style={{ paddingTop: 60, alignItems: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll back>
      <View style={{ gap: 4, paddingTop: 4 }}>
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.4 }}>
          {storyId ? t('storiesEdit') : t('storiesWrite')}
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t('storiesTagline')}</Text>
      </View>

      <AppInput
        label={t('storiesTitleLabel')}
        value={title}
        onChangeText={setTitle}
        maxLength={160}
        placeholder={t('storiesTitleLabel')}
      />

      <View style={{ gap: 6 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600' }}>{t('storiesBodyLabel')}</Text>
        <TextInput
          value={body}
          onChangeText={setBody}
          multiline
          maxLength={40000}
          textAlignVertical="top"
          placeholder={t('storiesBodyLabel')}
          placeholderTextColor={colors.textSecondary}
          style={[
            styles.bodyInput,
            { color: colors.text, backgroundColor: colors.backgroundSecondary, borderColor: colors.border },
          ]}
        />
        <Text style={{ color: colors.textSecondary, fontSize: 11, textAlign: 'right' }}>{body.trim().length}/40000</Text>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600' }}>{t('storiesCategoryLabel')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {(categories.data ?? []).map((category) => {
            const active = categoryId === category.id;
            return (
              <Pressable
                key={category.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setCategoryId(category.id)}
                style={[
                  styles.categoryPill,
                  {
                    backgroundColor: active ? colors.primary : colors.backgroundSecondary,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={{ color: active ? colors.onPrimary : colors.textSecondary, fontSize: 12, fontWeight: '700' }}
                >
                  {storyCategoryName(category, locale)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600' }}>{t('storiesCover')}</Text>
        {coverUrl ? (
          <View style={[styles.coverWrap, { borderColor: colors.border }]}>
            <Image source={{ uri: coverUrl }} style={styles.coverImage} contentFit="cover" />
            <Pressable
              accessibilityRole="button"
              onPress={() => setCoverUrl(null)}
              style={[styles.coverRemove, { backgroundColor: colors.surface }]}
            >
              <Ionicons name="close" size={16} color={colors.error} />
            </Pressable>
          </View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          disabled={uploading}
          onPress={() => void pickCover()}
          style={[styles.outlineButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
        >
          {uploading ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <>
              <Ionicons name="image-outline" size={17} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '800' }}>{t('storiesCover')}</Text>
            </>
          )}
        </Pressable>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600' }}>{t('storiesLink')}</Text>
        {linked ? (
          <View style={[styles.linkedRow, { backgroundColor: colors.primaryMuted, borderColor: colors.border }]}>
            <Ionicons name={linked.kind === 'quran' ? 'book-outline' : 'sparkles-outline'} size={17} color={colors.primary} />
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700', flex: 1 }} numberOfLines={1}>
              {linked.label}
            </Text>
            <Pressable accessibilityRole="button" onPress={() => setLinked(null)}>
              <Ionicons name="close-circle" size={19} color={colors.textSecondary} />
            </Pressable>
          </View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={() => setPickerOpen(true)}
          style={[styles.outlineButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
        >
          <Ionicons name="add-circle-outline" size={17} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '800' }}>{t('storiesPickContent')}</Text>
        </Pressable>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600' }}>{t('storiesPublish')}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: !pseudonymous }}
            onPress={() => setPseudonymous(false)}
            style={[
              styles.identity,
              {
                backgroundColor: !pseudonymous ? colors.primaryMuted : colors.surface,
                borderColor: !pseudonymous ? colors.primary : colors.border,
              },
            ]}
          >
            <Ionicons name="person-outline" size={16} color={!pseudonymous ? colors.primary : colors.textSecondary} />
            <Text style={{ color: !pseudonymous ? colors.primary : colors.textSecondary, fontSize: 12, fontWeight: '800' }}>
              {t('storiesProfileShare')}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: pseudonymous }}
            onPress={() => {
              setPseudonymous(true);
              setContactEnabled(false);
            }}
            style={[
              styles.identity,
              {
                backgroundColor: pseudonymous ? colors.primaryMuted : colors.surface,
                borderColor: pseudonymous ? colors.primary : colors.border,
              },
            ]}
          >
            <Ionicons name="eye-off-outline" size={16} color={pseudonymous ? colors.primary : colors.textSecondary} />
            <Text style={{ color: pseudonymous ? colors.primary : colors.textSecondary, fontSize: 12, fontWeight: '800' }}>
              {t('storiesPseudonymousShare')}
            </Text>
          </Pressable>
        </View>
        {pseudonymous ? (
          <Text style={{ color: colors.textSecondary, fontSize: 11, lineHeight: 16 }}>{t('storiesPseudonymousHint')}</Text>
        ) : null}
      </View>

      <View style={[styles.settings, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <SettingRow
          label={t('storiesCommentsEnabled')}
          value={commentsEnabled}
          onChange={setCommentsEnabled}
        />
        <SettingRow
          label={t('storiesContactEnabled')}
          value={contactEnabled}
          onChange={setContactEnabled}
          disabled={pseudonymous}
        />
        <SettingRow label={t('storiesSupportEnabled')} value={supportEnabled} onChange={setSupportEnabled} last />
      </View>

      <View style={{ gap: 8, paddingTop: 2 }}>
        <Pressable
          accessibilityRole="button"
          disabled={Boolean(saving)}
          onPress={() => void save('published')}
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
        >
          {saving === 'published' ? (
            <ActivityIndicator color={colors.onPrimary} size="small" />
          ) : (
            <Text style={{ color: colors.onPrimary, fontSize: 14, fontWeight: '800' }}>{t('storiesPublish')}</Text>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={Boolean(saving)}
          onPress={confirmDraft}
          style={[styles.outlineButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
        >
          {saving === 'draft' ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <>
              <Ionicons name="save-outline" size={17} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '800' }}>{t('storiesDraft')}</Text>
            </>
          )}
        </Pressable>
      </View>

      <AppBottomSheet visible={pickerOpen} title={t('storiesPickContent')} onClose={() => setPickerOpen(false)}>
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
          {(['quran', 'dua'] as const).map((kind) => {
            const active = pickerKind === kind;
            return (
              <Pressable
                key={kind}
                accessibilityRole="button"
                onPress={() => setPickerKind(kind)}
                style={[
                  styles.pickerTab,
                  {
                    backgroundColor: active ? colors.primary : colors.backgroundSecondary,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={{ color: active ? colors.onPrimary : colors.textSecondary, fontSize: 12, fontWeight: '800' }}>
                  {kind === 'quran' ? 'Kur’an' : 'Dua'}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <TextInput
          value={pickerSearch}
          onChangeText={setPickerSearch}
          placeholder={t('storiesSearchPlaceholder')}
          placeholderTextColor={colors.textSecondary}
          style={[
            styles.pickerSearch,
            { color: colors.text, backgroundColor: colors.backgroundSecondary, borderColor: colors.border },
          ]}
        />
        {surahs.isLoading || duas.isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ paddingVertical: 20 }} />
        ) : (
          <FlatList
            data={filteredItems}
            keyExtractor={(item) => item.key}
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: 380 }}
            initialNumToRender={16}
            windowSize={7}
            ListEmptyComponent={
              <Text style={{ color: colors.textSecondary, fontSize: 12, paddingVertical: 18, textAlign: 'center' }}>
                {t('storiesEmpty')}
              </Text>
            }
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setLinked({
                    kind: pickerKind,
                    key: item.key,
                    label: item.label,
                    reciterId: pickerKind === 'quran' ? reciter.variant?.id : undefined,
                  });
                  setPickerOpen(false);
                  setPickerSearch('');
                }}
                style={[styles.pickerRow, { borderBottomColor: colors.divider }]}
              >
                <View style={{ flex: 1, gap: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }} numberOfLines={1}>
                    {item.label}
                  </Text>
                  {item.hint ? (
                    <Text style={{ color: colors.textSecondary, fontSize: 11 }} numberOfLines={1}>
                      {item.hint}
                    </Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={15} color={colors.iconMuted} />
              </Pressable>
            )}
          />
        )}
      </AppBottomSheet>
    </Screen>
  );
}

function SettingRow({
  label,
  value,
  onChange,
  disabled,
  last,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  last?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.settingRow,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
      ]}
    >
      <Text style={{ color: disabled ? colors.textSecondary : colors.text, fontSize: 13, fontWeight: '600', flex: 1 }}>
        {label}
      </Text>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bodyInput: {
    minHeight: 260,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    fontSize: 16,
    lineHeight: 25,
  },
  categoryPill: {
    minHeight: 32,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverWrap: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  coverImage: { width: '100%', height: 170 },
  coverRemove: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineButton: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  linkedRow: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  identity: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  settings: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 12 },
  settingRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 10 },
  primaryButton: { minHeight: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  pickerTab: {
    flex: 1,
    minHeight: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerSearch: {
    minHeight: 42,
    borderRadius: 11,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    marginBottom: 6,
  },
  pickerRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 6,
  },
});
