import { defaultAlerts, planPrayerAlerts, ALERT_MAX } from '../src/services/prayer/alertPlan.ts';
import type { PrayerDay, PrayerKey } from '../src/services/prayer/types.ts';

const keys: PrayerKey[] = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
const alerts = defaultAlerts(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']);
alerts.sunrise = { enabled: true, atTime: true, leadMinutes: 15 };
alerts.fajr = { enabled: true, atTime: true, leadMinutes: 10 };

function day(offset: number): PrayerDay {
  const date = new Date(Date.UTC(2026, 9, 14 + offset, 0, 0, 0));
  const iso = date.toISOString().slice(0, 10);
  return {
    date: iso,
    timezone: 'Europe/Istanbul',
    utcOffsetMinutes: 180,
    hijriLabel: '22 Rebiülahir 1448',
    gregorianLabel: iso,
    methodId: 13,
    methodName: 'Turkey',
    source: 'aladhan',
    fetchedAt: date.toISOString(),
    disclaimer: '',
    timings: keys.map((key, index) => ({
      key,
      at: new Date(Date.UTC(2026, 9, 14 + offset, 3 + index, 15, 0)).toISOString(),
    })),
  };
}

const now = Date.UTC(2026, 9, 14, 0, 0, 0);
const planned = planPrayerAlerts(Array.from({ length: 10 }, (_, index) => day(index)), alerts, now);
const ids = new Set(planned.map((item) => item.identifier));
if (ids.size !== planned.length) throw new Error('duplicate identifiers');
if (planned.length > ALERT_MAX) throw new Error(`over cap ${planned.length}`);
if (planned.some((item) => item.at.getTime() <= now)) throw new Error('past alert');
if (planned.some((item) => item.at.getTime() > now + 4 * 24 * 60 * 60 * 1000)) throw new Error('beyond horizon');
const sunrise = planned.filter((item) => item.key === 'sunrise');
if (!sunrise.some((item) => item.slot === 'at') || !sunrise.some((item) => item.slot === 'lead')) {
  throw new Error('sunrise at-time and lead were not both planned');
}
const disabled = defaultAlerts([]);
if (planPrayerAlerts([day(0)], disabled, now).length !== 0) throw new Error('disabled prayers were scheduled');
console.log(`planned ${planned.length} unique alerts within ${ALERT_MAX}`);
