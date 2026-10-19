import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ink } from '@/components/listen/chrome';
import { useT } from '@/i18n';
import { selectAutoNextSurah } from '@/services/quran/playback';
import { useReadingStore } from '@/stores/readingStore';

export function AutoNextSurahToggle() {
  const t = useT();
  const enabled = useReadingStore((state) => state.autoNextSurah !== false);

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: enabled }}
      accessibilityLabel={t('autoNextSurah')}
      onPress={() => selectAutoNextSurah(!enabled)}
      style={{
        minHeight: 44,
        borderRadius: 10,
        backgroundColor: ink.raised,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <Ionicons name={enabled ? 'play-skip-forward' : 'play-skip-forward-outline'} size={18} color={enabled ? ink.green : ink.muted} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: ink.text, fontWeight: '700', fontSize: 13 }}>{t('autoNextSurah')}</Text>
        <Text style={{ color: ink.muted, fontSize: 11, lineHeight: 14 }}>{t('autoNextSurahHint')}</Text>
      </View>
      <View
        style={{
          width: 42,
          height: 26,
          borderRadius: 13,
          padding: 3,
          backgroundColor: enabled ? ink.green : ink.line,
          justifyContent: 'center',
          alignItems: enabled ? 'flex-end' : 'flex-start',
        }}
      >
        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: ink.text }} />
      </View>
    </Pressable>
  );
}
