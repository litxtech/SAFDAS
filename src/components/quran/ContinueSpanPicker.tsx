import { Pressable, ScrollView, Text, View } from 'react-native';
import { ink } from '@/components/listen/chrome';
import { useT } from '@/i18n';
import { continueRemainingMs, selectContinueSpan, useQuranPlayer } from '@/services/quran/playback';
import { useReadingStore, type ContinueSpan } from '@/stores/readingStore';

const OPTIONS: { id: ContinueSpan; label: 'continueHalf' | 'continueOneHour' | 'continueTwoHours' | 'continueThreeHours' | 'continueForever' }[] = [
  { id: '30m', label: 'continueHalf' },
  { id: '1h', label: 'continueOneHour' },
  { id: '2h', label: 'continueTwoHours' },
  { id: '3h', label: 'continueThreeHours' },
  { id: 'forever', label: 'continueForever' },
];

function formatRemain(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const clock = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  return hours > 0 ? `${hours}:${clock}` : clock;
}

export function ContinueSpanPicker() {
  const t = useT();
  const span = useReadingStore((state) => state.continueSpan);
  const active = useQuranPlayer((state) => state.surahNumber != null);
  const currentTime = useQuranPlayer((state) => state.currentTime);
  const remain = span !== 'forever' && active ? continueRemainingMs() : null;
  void currentTime;

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: ink.muted, fontSize: 13, fontWeight: '700' }}>{t('continueReading')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {OPTIONS.map((option) => {
          const selected = (span ?? 'forever') === option.id;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => selectContinueSpan(option.id)}
              style={{
                minHeight: 34,
                paddingHorizontal: 12,
                borderRadius: 999,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: selected ? ink.green : ink.raised,
              }}
            >
              <Text style={{ color: selected ? ink.black : ink.text, fontWeight: '700', fontSize: 13 }}>{t(option.label)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <Text style={{ color: ink.muted, fontSize: 12, lineHeight: 16 }}>
        {remain != null ? `${t('continueHint')} ${t('continueLeft', { time: formatRemain(remain) })}` : t('continueHint')}
      </Text>
    </View>
  );
}
