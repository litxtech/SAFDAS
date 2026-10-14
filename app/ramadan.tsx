import { Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '@/components/layout/Screen';
import { AppCard } from '@/components/ui/AppCard';
import { AppHeader } from '@/components/ui/AppHeader';
import { dateLocale, useI18nStore, useT } from '@/i18n';
import { loadPrayerDay } from '@/services/prayer/service';
import { usePrayerStore } from '@/stores/prayerStore';
import { useTheme } from '@/theme/ThemeProvider';

export default function RamadanScreen() {
  const { colors } = useTheme();
  const t = useT();
  const locale = useI18nStore((state) => state.locale);
  const location = usePrayerStore((state) => state.location);
  const methodId = usePrayerStore((state) => state.methodId);
  const day = useQuery({
    queryKey: ['prayer-day', location.city, methodId],
    queryFn: () => loadPrayerDay({ location, methodId }),
  });
  const imsak = day.data?.timings.find((item) => item.key === 'fajr');
  const iftar = day.data?.timings.find((item) => item.key === 'maghrib');
  return (
    <Screen scroll>
      <AppHeader title={t('ramadan')} subtitle={location.city} />
      <AppCard>
        <Text style={{ color: colors.textSecondary }}>{t('imsak')}</Text>
        <Text style={{ color: colors.text, fontSize: 28, fontWeight: '700' }}>{imsak ? new Date(imsak.at).toLocaleTimeString(dateLocale(locale), { hour: '2-digit', minute: '2-digit' }) : '—'}</Text>
        <Text style={{ color: colors.textSecondary, marginTop: 12 }}>{t('iftar')}</Text>
        <Text style={{ color: colors.primary, fontSize: 28, fontWeight: '700' }}>{iftar ? new Date(iftar.at).toLocaleTimeString(dateLocale(locale), { hour: '2-digit', minute: '2-digit' }) : '—'}</Text>
      </AppCard>
      <Text style={{ color: colors.textSecondary, lineHeight: 20 }}>{t('ramadanHint')}</Text>
    </Screen>
  );
}
