import { Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Screen } from '@/components/layout/Screen';
import { PrayerHero } from '@/components/prayer/PrayerHero';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppErrorState } from '@/components/ui/AppErrorState';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppSkeleton } from '@/components/ui/AppSkeleton';
import { AppSwitch } from '@/components/ui/AppSwitch';
import { methodName } from '@/services/prayer/methods';
import { loadPrayerMonth } from '@/services/prayer/service';
import type { PrayerKey } from '@/services/prayer/types';
import { useI18nStore, useT, type I18nKey } from '@/i18n';
import { usePrayerStore } from '@/stores/prayerStore';

const LABELS: Record<PrayerKey, I18nKey> = {
  fajr: 'notifyFajr',
  sunrise: 'notifySunrise',
  dhuhr: 'notifyDhuhr',
  asr: 'notifyAsr',
  maghrib: 'notifyMaghrib',
  isha: 'notifyIsha',
};

export default function PrayerScreen() {
  const { colors } = useTheme();
  const location = usePrayerStore((state) => state.location);
  const methodId = usePrayerStore((state) => state.methodId);
  const notifications = usePrayerStore((state) => state.notifications);
  const toggle = usePrayerStore((state) => state.toggleNotification);
  const t = useT();
  const locale = useI18nStore((state) => state.locale);
  const query = useQuery({
    queryKey: ['prayer-month', location.city, location.countryCode, methodId, location.latitude],
    queryFn: () => loadPrayerMonth({ location, methodId }),
  });
  const today = new Date().toISOString().slice(0, 10);
  const day = query.data?.find((item) => item.date === today);

  return (
    <Screen scroll>
      <AppHeader title={t('prayerTimes')} subtitle={methodName(methodId, locale)} />
      {query.isLoading ? <AppSkeleton style={{ height: 240 }} /> : null}
      {query.error ? <AppErrorState message={(query.error as Error).message} onRetry={() => void query.refetch()} /> : null}
      {day ? <PrayerHero day={day} city={location.city} /> : null}
      <AppCard>
        <Text style={{ color: colors.text, fontWeight: '700', marginBottom: 8 }}>{t('lockNotifications')}</Text>
        {(Object.keys(LABELS) as PrayerKey[]).map((key) => (
          <AppSwitch key={key} label={t(LABELS[key])} value={notifications.includes(key)} onValueChange={() => toggle(key)} />
        ))}
        <Text style={{ color: colors.textSecondary, marginTop: 8, lineHeight: 18 }}>{t('lockNotificationsHint')}</Text>
      </AppCard>
      <View style={{ gap: 8 }}>
        <AppButton label={t('chooseLocation')} onPress={() => router.push('/prayer/location')} />
        <AppButton label={t('prayerMethod')} variant="secondary" onPress={() => router.push('/settings/prayer')} />
        <AppButton label={t('notificationDetails')} variant="secondary" onPress={() => router.push('/settings/notifications')} />
      </View>
    </Screen>
  );
}
