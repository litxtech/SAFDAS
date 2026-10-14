import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { translate, useI18nStore } from '@/i18n';
import type { I18nKey } from '@/i18n';
import { planPrayerAlerts, type AlertSound, type PrayerAlerts } from './alertPlan';
import type { PrayerDay, PrayerKey } from './types';

const LABEL_KEYS: Record<PrayerKey, I18nKey> = {
  fajr: 'fajr',
  sunrise: 'sunrise',
  dhuhr: 'dhuhr',
  asr: 'asr',
  maghrib: 'maghrib',
  isha: 'isha',
};

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const silent = notification.request.content.data?.soundMode === 'silent';
    return {
      shouldShowAlert: true,
      shouldPlaySound: !silent,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    };
  },
});

function channelId(sound: AlertSound, lockScreen: boolean) {
  const audible = sound === 'silent' ? 'silent' : 'sound';
  return `prayer-${audible}-${lockScreen ? 'public' : 'private'}`;
}

async function ensureChannels(sound: AlertSound, lockScreen: boolean) {
  if (Platform.OS !== 'android') return;
  const id = channelId(sound, lockScreen);
  const silent = sound === 'silent';
  await Notifications.deleteNotificationChannelAsync(id).catch(() => undefined);
  await Notifications.setNotificationChannelAsync(id, {
    name: 'Namaz vakitleri',
    importance: silent ? Notifications.AndroidImportance.DEFAULT : Notifications.AndroidImportance.HIGH,
    lockscreenVisibility: lockScreen
      ? Notifications.AndroidNotificationVisibility.PUBLIC
      : Notifications.AndroidNotificationVisibility.PRIVATE,
    enableVibrate: !silent,
    sound: silent ? null : 'default',
    ...(silent ? {} : { vibrationPattern: [0, 200, 120, 200] }),
  });
}

export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

let queue: Promise<number> = Promise.resolve(0);

export function schedulePrayerNotifications(
  days: PrayerDay[],
  alerts: PrayerAlerts,
  sound: AlertSound,
  lockScreen: boolean,
): Promise<number> {
  queue = queue.then(() => schedulePrayerNotificationsNow(days, alerts, sound, lockScreen)).catch(() => 0);
  return queue;
}

async function cancelPrayerNotifications() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((item) => item.content.data?.kind === 'prayer' || item.identifier.startsWith('safdas-prayer-'))
      .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)),
  );
}

async function schedulePrayerNotificationsNow(
  days: PrayerDay[],
  alerts: PrayerAlerts,
  sound: AlertSound,
  lockScreen: boolean,
): Promise<number> {
  await cancelPrayerNotifications();
  const granted = await ensureNotificationPermission();
  if (!granted) return 0;
  await ensureChannels(sound, lockScreen);

  const locale = useI18nStore.getState().locale;
  const planned = planPrayerAlerts(days, alerts);
  const audible = sound !== 'silent';
  const selectedChannel = channelId(sound, lockScreen);
  const timeZone = days[0]?.timezone ?? null;

  for (const item of planned) {
    const name = translate(locale, LABEL_KEYS[item.key]);
    const clock = formatClock(item.prayerAt, timeZone, locale);
    const body =
      item.slot === 'lead'
        ? translate(locale, 'prayerAlertLead', { time: clock, minutes: item.leadMinutes })
        : translate(locale, 'prayerAlertAt', { time: clock });
    await Notifications.scheduleNotificationAsync({
      identifier: item.identifier,
      content: {
        title: `SAFDAŞ · ${name}`,
        body,
        sound: audible ? 'default' : false,
        interruptionLevel: audible ? 'active' : 'passive',
        data: {
          kind: 'prayer',
          prayer: item.key,
          slot: item.slot,
          soundMode: audible ? 'sound' : 'silent',
          url: 'safdas://prayer',
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: item.at,
        channelId: selectedChannel,
      },
    });
  }
  return planned.length;
}

function formatClock(iso: string, timeZone: string | null, locale: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: timeZone || undefined,
  }).format(date);
}
