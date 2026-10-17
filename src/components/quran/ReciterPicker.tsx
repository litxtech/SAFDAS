import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ink } from '@/components/listen/chrome';
import { useT } from '@/i18n';
import {
  cancelPack,
  deletePack,
  enqueuePack,
  getOfflineSnapshot,
  quranPackId,
  refreshPackStats,
  subscribeOffline,
  type PackState,
} from '@/services/offline/packs';
import { selectReciter } from '@/services/quran/playback';
import { RECITERS, getReciter } from '@/services/quran/reciters';
import { useReciterStore } from '@/stores/reciterStore';

function PackActions({ reciterId }: { reciterId: string }) {
  const t = useT();
  const packId = quranPackId(reciterId);
  const [pack, setPack] = useState<PackState | undefined>(() => getOfflineSnapshot().packs[packId]);

  useEffect(() => subscribeOffline((snapshot) => setPack(snapshot.packs[packId])), [packId]);

  const active = pack?.status === 'downloading' || pack?.status === 'queued';
  const ready = pack?.status === 'ready';
  const hasFiles = Boolean(pack && (pack.bytes > 0 || pack.done > 0));
  const percent = pack && pack.total > 0 ? Math.round(Math.min(1, pack.done / pack.total) * 100) : 0;

  function confirmDelete() {
    Alert.alert(t('offlineDelete'), t('offlineDeleteConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('offlineDelete'),
        style: 'destructive',
        onPress: () => deletePack(packId),
      },
    ]);
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      {active ? (
        <>
          <Text style={{ color: ink.muted, fontSize: 11, fontWeight: '700', minWidth: 32, textAlign: 'right' }}>
            {percent}%
          </Text>
          <Pressable
            hitSlop={10}
            onPress={(event) => {
              event.stopPropagation?.();
              cancelPack(packId);
            }}
            accessibilityLabel={t('offlineCancelPack')}
            style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="close-circle" size={22} color={ink.muted} />
          </Pressable>
          <View style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="small" color={ink.green} />
          </View>
        </>
      ) : (
        <Pressable
          hitSlop={10}
          onPress={(event) => {
            event.stopPropagation?.();
            enqueuePack(packId);
          }}
          accessibilityLabel={ready ? t('offlineReady') : t('offlineDownload')}
          style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons
            name={ready ? 'checkmark-circle' : hasFiles ? 'cloud-download-outline' : 'cloud-download-outline'}
            size={22}
            color={ready ? ink.green : ink.muted}
          />
        </Pressable>
      )}
      {hasFiles || ready ? (
        <Pressable
          hitSlop={10}
          onPress={(event) => {
            event.stopPropagation?.();
            confirmDelete();
          }}
          accessibilityLabel={t('offlineDelete')}
          style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="trash-outline" size={20} color="#C45C5C" />
        </Pressable>
      ) : null}
    </View>
  );
}

export function ReciterPicker({ centered = false }: { centered?: boolean }) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const id = useReciterStore((state) => state.id);
  const current = getReciter(id);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    refreshPackStats();
  }, [open]);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('chooseReciter')}
        onPress={() => setOpen(true)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: centered ? 'center' : 'flex-start', minHeight: 36 }}
      >
        <Ionicons name="mic-outline" size={16} color={ink.green} />
        <Text style={{ color: ink.text, fontWeight: '700' }} numberOfLines={1}>{current.name}</Text>
        <Ionicons name="chevron-down" size={14} color={ink.muted} />
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setOpen(false)} accessibilityLabel={t('cancel')} />
          <View style={{ backgroundColor: ink.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 12, paddingBottom: insets.bottom + 12, maxHeight: '72%' }}>
            <View style={{ width: 42, height: 4, borderRadius: 99, backgroundColor: ink.line, alignSelf: 'center' }} />
            <Text style={{ color: ink.text, fontSize: 18, fontWeight: '800', paddingHorizontal: 16, paddingVertical: 14 }}>{t('chooseReciter')}</Text>
            <Pressable
              onPress={() => {
                setOpen(false);
                router.push('/settings/downloads');
              }}
              style={{ paddingHorizontal: 16, paddingBottom: 10 }}
            >
              <Text style={{ color: ink.green, fontWeight: '700' }}>{t('offlineDownloads')}</Text>
            </Pressable>
            <ScrollView keyboardShouldPersistTaps="handled">
              {RECITERS.map((reciter) => {
                const selected = reciter.id === current.id;
                return (
                  <View
                    key={reciter.id}
                    style={{ minHeight: 58, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                  >
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        setOpen(false);
                        void selectReciter(reciter.id);
                      }}
                      style={{ flex: 1, minHeight: 58, justifyContent: 'center', paddingHorizontal: 4 }}
                    >
                      <Text style={{ color: selected ? ink.green : ink.text, fontWeight: '700' }}>{reciter.name}</Text>
                      <Text style={{ color: ink.muted, marginTop: 2 }}>{reciter.arabicName}</Text>
                    </Pressable>
                    <PackActions reciterId={reciter.id} />
                    {selected ? <Ionicons name="checkmark" size={20} color={ink.green} /> : <View style={{ width: 20 }} />}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
