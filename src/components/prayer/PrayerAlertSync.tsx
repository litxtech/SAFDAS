import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { loadPrayerMonth } from '@/services/prayer/service';
import { schedulePrayerNotifications } from '@/services/prayer/notifications';
import { publishPrayerSurfaces } from '@/services/prayer/surfaces';
import { useI18nStore } from '@/i18n';
import { usePrayerStore } from '@/stores/prayerStore';
import { useTheme } from '@/theme/ThemeProvider';

export function PrayerAlertSync() {
  const client = useQueryClient();
  const location = usePrayerStore((state) => state.location);
  const methodId = usePrayerStore((state) => state.methodId);
  const alerts = usePrayerStore((state) => state.alerts);
  const sound = usePrayerStore((state) => state.sound);
  const lockScreen = usePrayerStore((state) => state.lockScreenNotifications);
  const liveActivityEnabled = usePrayerStore((state) => state.liveActivityEnabled);
  const locale = useI18nStore((state) => state.locale);
  const { name: theme } = useTheme();
  const offset = useRef(new Date().getTimezoneOffset());
  const prayer = useQuery({
    queryKey: ['prayer-month', location.city, location.countryCode, methodId, location.latitude],
    queryFn: () => loadPrayerMonth({ location, methodId }),
  });

  useEffect(() => {
    if (!prayer.data) return;
    void schedulePrayerNotifications(prayer.data, alerts, sound, lockScreen);
    void publishPrayerSurfaces(prayer.data, location, alerts, theme, liveActivityEnabled);
  }, [prayer.data, alerts, sound, lockScreen, liveActivityEnabled, location, theme, locale]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      const current = new Date().getTimezoneOffset();
      if (current !== offset.current) {
        offset.current = current;
        void client.invalidateQueries({ queryKey: ['prayer-month'] });
        return;
      }
      if (!prayer.data) return;
      void schedulePrayerNotifications(prayer.data, alerts, sound, lockScreen);
      void publishPrayerSurfaces(prayer.data, location, alerts, theme, liveActivityEnabled);
    });
    return () => subscription.remove();
  }, [alerts, client, liveActivityEnabled, location, lockScreen, prayer.data, sound, theme]);

  useEffect(() => {
    function openPrayer(data: unknown) {
      if (!data || typeof data !== 'object' || !('kind' in data)) return;
      if (data.kind === 'prayer') router.push('/prayer');
    }
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      openPrayer(response.notification.request.content.data);
    });
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      openPrayer(response.notification.request.content.data);
      void Notifications.clearLastNotificationResponseAsync();
    });
    return () => subscription.remove();
  }, []);

  return null;
}
