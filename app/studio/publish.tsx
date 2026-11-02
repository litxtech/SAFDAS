import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ListenBack, ink } from '@/components/listen/chrome';
import { useT } from '@/i18n';
import { fetchRecording, submitRecording, updateRecording } from '@/services/studio/api';
import { openStudioDetail, openStudioLibrary } from '@/services/studio/nav';
import type { StudioVisibility } from '@/services/studio/types';
import { useToastStore } from '@/stores/toastStore';

const STUDIO_PURPLE = '#8957F5';

function oneParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value || undefined;
}

const VIS: StudioVisibility[] = ['public', 'unlisted', 'private'];

export default function StudioPublishScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const show = useToastStore((s) => s.show);
  const queryClient = useQueryClient();
  const id = oneParam(useLocalSearchParams<{ id?: string }>().id);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<StudioVisibility>('public');
  const [comments, setComments] = useState(true);
  const [owned, setOwned] = useState(false);
  const [busy, setBusy] = useState(false);

  const query = useQuery({
    queryKey: ['studio-recording', id],
    enabled: Boolean(id),
    queryFn: () => fetchRecording(id as string),
  });

  useEffect(() => {
    const row = query.data;
    if (!row) return;
    setTitle(row.title);
    setDescription(row.description ?? '');
    setVisibility(row.visibility);
    setComments(row.comments_enabled);
    setOwned(row.ownership_confirmed);
  }, [query.data]);

  async function publish() {
    if (!id) return;
    if (!title.trim()) {
      show(t('studioTitleRequired'), 'error');
      return;
    }
    if (!owned) {
      show(t('studioOwnershipRequired'), 'error');
      return;
    }
    setBusy(true);
    try {
      await updateRecording(id, {
        title: title.trim(),
        description: description.trim() || null,
        visibility,
        comments_enabled: comments,
        ownership_confirmed: true,
      });
      const result = await submitRecording(id);
      void queryClient.invalidateQueries({ queryKey: ['studio'] });
      void queryClient.invalidateQueries({ queryKey: ['studio-recording', id] });
      show(
        result.status === 'pending_review' ? t('studioSubmittedReview') : t('studioPublished'),
        'success',
      );
      if (result.status === 'published') openStudioDetail(id);
      else openStudioLibrary();
    } catch (error) {
      show(error instanceof Error ? error.message : t('studioPublishFailed'), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: ink.canvas, paddingTop: insets.top }}>
      <StatusBar style="light" />
      <View style={{ paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <ListenBack onPress={() => router.back()} />
        <Text style={{ color: ink.text, fontWeight: '800', fontSize: 16 }}>{t('studioPublishTitle')}</Text>
        <View style={{ width: 40 }} />
      </View>

      {query.isLoading ? (
        <ActivityIndicator color={ink.green} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Field label={t('studioTitleLabel')}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={t('studioTitlePlaceholder')}
              placeholderTextColor={ink.dim}
              style={inputStyle}
            />
          </Field>

          <Field label={t('studioDescriptionLabel')}>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder={t('studioDescriptionPlaceholder')}
              placeholderTextColor={ink.dim}
              multiline
              style={[inputStyle, { minHeight: 110, textAlignVertical: 'top' }]}
            />
          </Field>

          <Field label={t('studioVisibility')}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {VIS.map((value) => {
                const active = visibility === value;
                return (
                  <Pressable
                    key={value}
                    onPress={() => setVisibility(value)}
                    style={{
                      flex: 1,
                      minHeight: 40,
                      borderRadius: 999,
                      backgroundColor: active ? ink.green : ink.raised,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: active ? '#000' : ink.text, fontWeight: '700', fontSize: 12 }}>
                      {t(
                        value === 'public'
                          ? 'studioVisPublic'
                          : value === 'unlisted'
                            ? 'studioVisUnlisted'
                            : 'studioVisPrivate',
                      )}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Field>

          <RowSwitch label={t('studioCommentsEnabled')} value={comments} onChange={setComments} />
          <RowSwitch label={t('studioOwnershipConfirm')} value={owned} onChange={setOwned} />

          <Pressable
            disabled={busy}
            onPress={() => void publish()}
            style={{
              minHeight: 52,
              borderRadius: 999,
              backgroundColor: STUDIO_PURPLE,
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 8,
            }}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>{t('studioSubmit')}</Text>
            )}
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: ink.muted, fontWeight: '700', fontSize: 12 }}>{label}</Text>
      {children}
    </View>
  );
}

function RowSwitch({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: ink.card,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        gap: 12,
      }}
    >
      <Text style={{ color: ink.text, flex: 1, fontWeight: '600' }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: ink.green, false: ink.raised }} />
    </View>
  );
}

const inputStyle = {
  color: ink.text,
  backgroundColor: ink.card,
  borderRadius: 12,
  paddingHorizontal: 14,
  paddingVertical: 12,
  fontSize: 16,
};
