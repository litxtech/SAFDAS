import { Platform } from 'react-native';
import { translate, useI18nStore, type I18nKey } from '@/i18n';
import type { ThemeName } from '@/theme/tokens';
import type { PrayerAlerts } from './alertPlan';
import type { PrayerDay, PrayerKey, PrayerLocation } from './types';

export const APP_GROUP = 'group.com.litxtech.namazim';
export const WIDGET_KIND = 'PrayerWidget';
const LIVE_ACTIVITY_MAX_MS = 2 * 60 * 60 * 1000;

const LABEL_KEYS: Record<PrayerKey, I18nKey> = {
  fajr: 'fajr',
  sunrise: 'sunrise',
  dhuhr: 'dhuhr',
  asr: 'asr',
  maghrib: 'maghrib',
  isha: 'isha',
};

export type WidgetSlot = {
  key: PrayerKey;
  name: string;
  epoch: number;
  time: string;
};

export type WidgetSnapshot = {
  city: string;
  hijri: string;
  theme: ThemeName;
  slots: WidgetSlot[];
  nextName: string;
  nextTime: string;
  nextEpoch: number;
  remaining: string;
  timesLine: string;
};

export function buildWidgetSnapshot(
  days: PrayerDay[],
  location: PrayerLocation,
  theme: ThemeName,
  now = Date.now(),
): WidgetSnapshot {
  const locale = useI18nStore.getState().locale;
  const relevant = days
    .filter((day) => day.timings.some((item) => new Date(item.at).getTime() > now - 12 * 60 * 60 * 1000))
    .slice(0, 2);
  const slots = relevant.flatMap((day) =>
    day.timings.map((item) => ({
      key: item.key,
      name: translate(locale, LABEL_KEYS[item.key]),
      epoch: Math.floor(new Date(item.at).getTime() / 1000),
      time: formatClock(item.at, day.timezone, locale),
    })),
  );
  const next = slots.find((slot) => slot.epoch * 1000 > now) ?? slots[slots.length - 1];
  const hijri = relevant.find((day) => day.timings.some((item) => Math.floor(new Date(item.at).getTime() / 1000) === next?.epoch))?.hijriLabel ?? relevant[0]?.hijriLabel ?? '';
  const remaining = next ? formatRemaining(next.epoch * 1000, now) : '--:--';
  return {
    city: location.city,
    hijri: hijri ?? '',
    theme,
    slots,
    nextName: next?.name ?? 'SAFDAŞ',
    nextTime: next?.time ?? '--:--',
    nextEpoch: next?.epoch ?? 0,
    remaining,
    timesLine: slots
      .slice(0, 6)
      .map((slot) => `${slot.name} ${slot.time}`)
      .join(' · '),
  };
}

export async function publishPrayerSurfaces(
  days: PrayerDay[],
  location: PrayerLocation,
  alerts: PrayerAlerts,
  theme: ThemeName,
  liveActivityEnabled: boolean,
) {
  const snapshot = buildWidgetSnapshot(days, location, theme);
  const json = JSON.stringify(snapshot);
  writeAppGroup(json);
  publishAndroidWidget(json);
  if (liveActivityEnabled) await syncLiveActivity(snapshot, alerts);
  else await endLiveActivity();
}

function writeAppGroup(json: string) {
  try {
    const { ExtensionStorage } = require('@bacons/apple-targets') as typeof import('@bacons/apple-targets');
    const storage = new ExtensionStorage(APP_GROUP);
    storage.set('snapshot', json);
    ExtensionStorage.reloadWidget(WIDGET_KIND);
  } catch {
    // App Group yazıcısı Expo Go ve Android'de yoktur.
  }
}

function publishAndroidWidget(json: string) {
  try {
    const native = require('safdas-activity') as typeof import('safdas-activity');
    native.publishWidgetSnapshot(json);
  } catch {
    // Native modül development build dışındaki çalıştırmalarda yoktur.
  }
}

async function syncLiveActivity(snapshot: WidgetSnapshot, alerts: PrayerAlerts) {
  if (Platform.OS !== 'ios') return;
  const next = snapshot.slots.find((slot) => slot.epoch * 1000 > Date.now());
  if (!next) {
    await endLiveActivity();
    return;
  }
  const pref = alerts[next.key];
  const leadMs = Math.min(LIVE_ACTIVITY_MAX_MS, Math.max(pref?.leadMinutes ?? 0, 20) * 60_000);
  const startsAt = next.epoch * 1000 - leadMs;
  if (Date.now() < startsAt || next.epoch * 1000 - Date.now() > LIVE_ACTIVITY_MAX_MS) {
    await endLiveActivity();
    return;
  }
  try {
    const native = require('safdas-activity') as typeof import('safdas-activity');
    const available = native.liveActivitiesAvailable();
    if (!available) return;
    await native.startPrayerActivity({
      city: snapshot.city,
      prayerKey: next.key,
      prayerName: next.name,
      prayerTime: next.time,
      endsAt: next.epoch * 1000,
    });
  } catch {
    // ActivityKit bu çalıştırmada yoksa sessizce geçilir.
  }
}

async function endLiveActivity() {
  if (Platform.OS !== 'ios') return;
  try {
    const native = require('safdas-activity') as typeof import('safdas-activity');
    await native.endPrayerActivity();
  } catch {
    // Native modül yoksa kapatılacak etkinlik de yoktur.
  }
}

function formatClock(iso: string, timeZone: string | null, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: timeZone || undefined,
  }).format(new Date(iso));
}

function formatRemaining(targetMs: number, now: number) {
  const minutes = Math.max(0, Math.floor((targetMs - now) / 60000));
  const hours = Math.floor(minutes / 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}
