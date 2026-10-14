import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Screen } from '@/components/layout/Screen';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppHeader } from '@/components/ui/AppHeader';
import { useT, type I18nKey } from '@/i18n';
import { requireSupabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/theme/ThemeProvider';

const OPTIONS = ['dhikrSubhan', 'dhikrHamd', 'dhikrAkbar', 'dhikrTawhid'] as const satisfies readonly I18nKey[];

export default function DhikrScreen() {
  const { colors } = useTheme();
  const t = useT();
  const userId = useAuthStore((state) => state.session?.user.id);
  const [phrase, setPhrase] = useState<I18nKey>(OPTIONS[0]);
  const [count, setCount] = useState(0);
  const target = 33;

  async function tap() {
    const next = count + 1;
    setCount(next);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!userId) return;
    await requireSupabase().from('dhikr_records').upsert(
      {
        user_id: userId,
        phrase: t(phrase),
        count: next,
        record_date: new Date().toISOString().slice(0, 10),
      },
      { onConflict: 'user_id,phrase,record_date' },
    );
  }

  return (
    <Screen>
      <AppHeader title={t('dhikr')} subtitle={t(phrase)} />
      <AppCard elevated>
        <Pressable onPress={() => void tap()} style={{ minHeight: 220, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.primary, fontSize: 72, fontWeight: '700' }}>{count}</Text>
          <Text style={{ color: colors.textSecondary }}>{t('dhikrTarget', { target })}</Text>
        </Pressable>
      </AppCard>
      <View style={{ gap: 8 }}>
        {OPTIONS.map((item) => (
          <AppButton key={item} label={t(item)} variant={item === phrase ? 'primary' : 'secondary'} onPress={() => { setPhrase(item); setCount(0); }} />
        ))}
        <AppButton label={t('reset')} variant="ghost" onPress={() => setCount(0)} />
      </View>
    </Screen>
  );
}
