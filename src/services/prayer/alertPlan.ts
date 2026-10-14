import type { PrayerDay, PrayerKey } from './types';

export const PRAYER_KEYS: PrayerKey[] = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
export const LEAD_OPTIONS = [0, 5, 10, 15, 30] as const;
export type LeadMinutes = (typeof LEAD_OPTIONS)[number];
export type AlertSound = 'silent' | 'system' | 'adhan';

export type PrayerAlert = {
  enabled: boolean;
  atTime: boolean;
  leadMinutes: LeadMinutes;
};

export type PrayerAlerts = Record<PrayerKey, PrayerAlert>;

export const ALERT_HORIZON_MS = 4 * 24 * 60 * 60 * 1000;
export const ALERT_MAX = 48;

export type PlannedAlert = {
  identifier: string;
  key: PrayerKey;
  at: Date;
  slot: 'at' | 'lead';
  leadMinutes: LeadMinutes;
  prayerAt: string;
};

export function isLeadMinutes(value: number): value is LeadMinutes {
  return (LEAD_OPTIONS as readonly number[]).includes(value);
}

export function defaultAlerts(enabled: readonly PrayerKey[]): PrayerAlerts {
  return {
    fajr: { enabled: enabled.includes('fajr'), atTime: true, leadMinutes: 0 },
    sunrise: { enabled: enabled.includes('sunrise'), atTime: true, leadMinutes: 0 },
    dhuhr: { enabled: enabled.includes('dhuhr'), atTime: true, leadMinutes: 0 },
    asr: { enabled: enabled.includes('asr'), atTime: true, leadMinutes: 0 },
    maghrib: { enabled: enabled.includes('maghrib'), atTime: true, leadMinutes: 0 },
    isha: { enabled: enabled.includes('isha'), atTime: true, leadMinutes: 0 },
  };
}

export function enabledPrayerKeys(alerts: PrayerAlerts): PrayerKey[] {
  return PRAYER_KEYS.filter((key) => alerts[key].enabled);
}

export function planPrayerAlerts(days: PrayerDay[], alerts: PrayerAlerts, now = Date.now()): PlannedAlert[] {
  const horizon = now + ALERT_HORIZON_MS;
  const planned: PlannedAlert[] = [];
  const seen = new Set<string>();

  for (const day of days) {
    for (const timing of day.timings) {
      const pref = alerts[timing.key];
      if (!pref?.enabled) continue;
      const at = new Date(timing.at).getTime();
      if (!Number.isFinite(at)) continue;

      if (pref.atTime && at > now + 15_000 && at <= horizon) {
        const identifier = `safdas-prayer-${day.date}-${timing.key}-at`;
        if (!seen.has(identifier)) {
          seen.add(identifier);
          planned.push({ identifier, key: timing.key, at: new Date(at), slot: 'at', leadMinutes: 0, prayerAt: timing.at });
        }
      }

      if (pref.leadMinutes > 0) {
        const lead = at - pref.leadMinutes * 60_000;
        if (lead > now + 15_000 && lead <= horizon) {
          const identifier = `safdas-prayer-${day.date}-${timing.key}-lead${pref.leadMinutes}`;
          if (!seen.has(identifier)) {
            seen.add(identifier);
            planned.push({
              identifier,
              key: timing.key,
              at: new Date(lead),
              slot: 'lead',
              leadMinutes: pref.leadMinutes,
              prayerAt: timing.at,
            });
          }
        }
      }
    }
  }

  planned.sort((left, right) => left.at.getTime() - right.at.getTime());
  return planned.slice(0, ALERT_MAX);
}
