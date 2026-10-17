import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ink } from '@/components/listen/chrome';
import { useT } from '@/i18n';
import { enqueuePack, quranPackId } from '@/services/offline/packs';
import { selectReciter } from '@/services/quran/playback';
import { RECITERS, getReciter } from '@/services/quran/reciters';
import { useReciterStore } from '@/stores/reciterStore';

export function ReciterPicker({ centered = false }: { centered?: boolean }) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const id = useReciterStore((state) => state.id);
  const current = getReciter(id);
  const [open, setOpen] = useState(false);

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
        <Pressable style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' }} onPress={() => setOpen(false)}>
          <Pressable style={{ backgroundColor: ink.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 12, paddingBottom: insets.bottom + 12, maxHeight: '72%' }}>
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
            <ScrollView>
              {RECITERS.map((reciter) => {
                const selected = reciter.id === current.id;
                return (
                  <Pressable
                    key={reciter.id}
                    accessibilityRole="button"
                    onPress={() => {
                      setOpen(false);
                      void selectReciter(reciter.id);
                    }}
                    style={{ minHeight: 58, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: selected ? ink.green : ink.text, fontWeight: '700' }}>{reciter.name}</Text>
                      <Text style={{ color: ink.muted, marginTop: 2 }}>{reciter.arabicName}</Text>
                    </View>
                    <Pressable
                      hitSlop={8}
                      onPress={() => enqueuePack(quranPackId(reciter.id))}
                      accessibilityLabel={t('offlineDownload')}
                    >
                      <Ionicons name="cloud-download-outline" size={20} color={ink.muted} />
                    </Pressable>
                    {selected ? <Ionicons name="checkmark" size={20} color={ink.green} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
