import { Pressable, Text } from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { AppHeader } from '@/components/ui/AppHeader';
import { useI18nStore, useT } from '@/i18n';
import { CALCULATION_METHODS } from '@/services/prayer/methods';
import { usePrayerStore } from '@/stores/prayerStore';
import { useTheme } from '@/theme/ThemeProvider';

export default function PrayerMethodScreen() {
  const { colors } = useTheme();
  const t = useT();
  const locale = useI18nStore((state) => state.locale);
  const methodId = usePrayerStore((state) => state.methodId);
  const setMethodId = usePrayerStore((state) => state.setMethodId);
  return (
    <Screen scroll>
      <AppHeader title={t('prayerMethod')} subtitle={t('methodSubtitle')} />
      {CALCULATION_METHODS.map((method) => (
        <Pressable key={method.id} onPress={() => setMethodId(method.id)} style={{ paddingVertical: 12 }}>
          <Text style={{ color: method.id === methodId ? colors.primary : colors.text, fontWeight: '700' }}>{method.name[locale]}</Text>
          <Text style={{ color: colors.textSecondary }}>{method.regions[locale]}</Text>
        </Pressable>
      ))}
      <Text style={{ color: colors.textSecondary, lineHeight: 20 }}>
        {t('methodDisclaimer')}
      </Text>
    </Screen>
  );
}
