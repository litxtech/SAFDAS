import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ListenBack, ink } from '@/components/listen/chrome';
import { StudioStatusBadges } from '@/components/studio/StudioStatusBadges';
import { StudioTrackCard } from '@/components/studio/StudioTrackCard';
import { useT } from '@/i18n';
import { listMine, softDelete } from '@/services/studio/api';
import { openStudioDetail, openStudioPublish, openStudioRecord } from '@/services/studio/nav';
import type { StudioRecording } from '@/services/studio/types';
import { useToastStore } from '@/stores/toastStore';

type TabKey = 'all' | 'published' | 'drafts' | 'pending' | 'hidden' | 'rejected';

const TABS: { key: TabKey; status?: StudioStatus | 'all' }[] = [
  { key: 'all', status: 'all' },
  { key: 'published', status: 'published' },
  { key: 'drafts', status: 'draft' },
  { key: 'pending', status: 'pending_review' },
  { key: 'hidden', status: 'hidden' },
  { key: 'rejected', status: 'rejected' },
];

export default function StudioLibraryScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const show = useToastStore((s) => s.show);
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabKey>('all');

  const query = useQuery({
    queryKey: ['studio-mine'],
    queryFn: () => listMine('all'),
  });

  const filtered = useMemo(() => {
    const rows = query.data ?? [];
    const conf = TABS.find((item) => item.key === tab);
    if (!conf || conf.status === 'all') return rows;
    return rows.filter((row) => row.status === conf.status);
  }, [query.data, tab]);

  async function remove(item: StudioRecording) {
    try {
      await softDelete(item.id);
      void queryClient.invalidateQueries({ queryKey: ['studio-mine'] });
      show(t('studioDeleted'), 'success');
    } catch (error) {
      show(error instanceof Error ? error.message : t('studioDeleteFailed'), 'error');
    }
  }

  function tabLabel(key: TabKey) {
    switch (key) {
      case 'all':
        return t('studioTabAll');
      case 'published':
        return t('studioTabPublished');
      case 'drafts':
        return t('studioTabDrafts');
      case 'pending':
        return t('studioTabPending');
      case 'hidden':
        return t('studioTabHidden');
      case 'rejected':
        return t('studioTabRejected');
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: ink.canvas, paddingTop: insets.top }}>
      <StatusBar style="light" />
      <View style={{ paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <ListenBack onPress={() => router.back()} />
        <Text style={{ color: ink.text, fontWeight: '800', fontSize: 16 }}>{t('studioLibrary')}</Text>
        <Pressable
          onPress={() => openStudioRecord({ contentType: 'quran', title: t('studioRecordQuranDefault') })}
          hitSlop={8}
          style={{ minWidth: 40, alignItems: 'flex-end' }}
        >
          <Text style={{ color: ink.green, fontWeight: '800' }}>+</Text>
        </Pressable>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 100, paddingTop: 8 }}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 8 }}>
            <FlatList
              horizontal
              data={TABS}
              keyExtractor={(item) => item.key}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
              renderItem={({ item }) => {
                const active = tab === item.key;
                return (
                  <Pressable
                    onPress={() => setTab(item.key)}
                    style={{
                      paddingHorizontal: 14,
                      minHeight: 34,
                      borderRadius: 999,
                      backgroundColor: active ? ink.text : ink.raised,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: active ? '#000' : ink.text, fontWeight: '700', fontSize: 13 }}>{tabLabel(item.key)}</Text>
                  </Pressable>
                );
              }}
            />
            {query.isLoading ? <ActivityIndicator color={ink.green} /> : null}
          </View>
        }
        ListEmptyComponent={
          !query.isLoading ? (
            <Text style={{ color: ink.muted, paddingHorizontal: 16, marginTop: 24 }}>{t('studioLibraryEmpty')}</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 16, paddingVertical: 4, gap: 4 }}>
            <StudioTrackCard
              recording={item}
              layout="horizontal"
              onPress={() => {
                if (item.status === 'draft' || item.status === 'rejected') openStudioPublish(item.id);
                else openStudioDetail(item.id);
              }}
            />
            <View style={{ paddingLeft: 68, gap: 8 }}>
              <StudioStatusBadges recording={item} compact />
              {item.status === 'rejected' && item.reject_reason ? (
                <Text style={{ color: '#ff6b6b', fontSize: 12 }} numberOfLines={2}>
                  {item.reject_reason}
                </Text>
              ) : null}
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {(item.status === 'draft' || item.status === 'rejected') && (
                  <Pressable onPress={() => openStudioPublish(item.id)}>
                    <Text style={{ color: ink.green, fontSize: 12, fontWeight: '700' }}>{t('studioContinue')}</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => void remove(item)}>
                  <Text style={{ color: '#ff6b6b', fontSize: 12, fontWeight: '700' }}>{t('delete')}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      />
    </View>
  );
}
