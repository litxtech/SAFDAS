import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ink } from '@/components/listen/chrome';
import { useT } from '@/i18n';
import { DUA_VOICES, getDuaVoice } from '@/services/dua/voices';
import { selectDuaVoice } from '@/services/duas';
import { useDuaVoiceStore } from '@/stores/duaVoiceStore';

export function DuaVoicePicker({ centered = false }: { centered?: boolean }) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const id = useDuaVoiceStore((state) => state.id);
  const current = getDuaVoice(id);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('chooseDuaVoice')}
        onPress={() => setOpen(true)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: centered ? 'center' : 'flex-start', minHeight: 36 }}
      >
        <Ionicons name="mic-outline" size={16} color={ink.green} />
        <Text style={{ color: ink.text, fontWeight: '700' }} numberOfLines={1}>
          {current.name}
        </Text>
        <Ionicons name="chevron-down" size={14} color={ink.muted} />
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' }} onPress={() => setOpen(false)}>
          <Pressable
            style={{
              backgroundColor: ink.card,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingTop: 12,
              paddingBottom: insets.bottom + 12,
              maxHeight: '72%',
            }}
          >
            <View style={{ width: 42, height: 4, borderRadius: 99, backgroundColor: ink.line, alignSelf: 'center' }} />
            <Text style={{ color: ink.text, fontSize: 18, fontWeight: '800', paddingHorizontal: 16, paddingVertical: 14 }}>
              {t('chooseDuaVoice')}
            </Text>
            <Text style={{ color: ink.muted, paddingHorizontal: 16, marginBottom: 8, lineHeight: 20 }}>{t('duaVoiceHint')}</Text>
            <ScrollView>
              {DUA_VOICES.map((voice) => {
                const selected = voice.id === current.id;
                return (
                  <Pressable
                    key={voice.id}
                    accessibilityRole="button"
                    onPress={() => {
                      setOpen(false);
                      void selectDuaVoice(voice.id);
                    }}
                    style={{ minHeight: 64, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: selected ? ink.green : ink.text, fontWeight: '700' }}>{voice.name}</Text>
                      <Text style={{ color: ink.muted, marginTop: 2 }}>{voice.arabicName}</Text>
                      <Text style={{ color: ink.dim, marginTop: 2, fontSize: 12 }}>{t(voice.subtitleKey)}</Text>
                    </View>
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
