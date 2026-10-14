import { translate, useI18nStore } from '@/i18n';
import { methodName } from './methods';
import type { PrayerDay, PrayerKey, PrayerQuery } from './types';

const BASE = 'https://api.aladhan.com/v1';
const TIMEOUT_MS = 12_000;

const TIMING_KEYS: { api: string; key: PrayerKey }[] = [
  { api: 'Fajr', key: 'fajr' },
  { api: 'Sunrise', key: 'sunrise' },
  { api: 'Dhuhr', key: 'dhuhr' },
  { api: 'Asr', key: 'asr' },
  { api: 'Maghrib', key: 'maghrib' },
  { api: 'Isha', key: 'isha' },
];

type AladhanDay = {
  timings: Record<string, string>;
  date: {
    gregorian: { date: string; day: string; month: { number: number; en: string }; year: string };
    hijri: { day: string; month: { en: string; ar: string }; year: string };
  };
  meta: {
    timezone: string;
    method: { id: number; name: string };
    latitude?: number;
    longitude?: number;
    offset?: Record<string, number>;
  };
};

type AladhanResponse = {
  code: number;
  status: string;
  data: AladhanDay | AladhanDay[];
};

async function fetchJson(url: string): Promise<AladhanResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (response.status === 429) {
      throw new Error('AlAdhan istek sınırı aşıldı. Kısa süre sonra yeniden denenecek.');
    }
    if (!response.ok) {
      throw new Error(`AlAdhan yanıtı başarısız (${response.status}).`);
    }
    return (await response.json()) as AladhanResponse;
  } finally {
    clearTimeout(timer);
  }
}

function isoToOffsetMinutes(iso: string): number {
  const match = /([+-])(\d{2}):(\d{2})$/.exec(iso);
  if (!match) return -new Date().getTimezoneOffset();
  const sign = match[1] === '-' ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

function mapDay(day: AladhanDay, methodId: number): PrayerDay {
  const gregorian = day.date.gregorian;
  const [dd, mm, yyyy] = gregorian.date.split('-');
  const date = `${yyyy}-${mm}-${dd}`;
  const timings = TIMING_KEYS.map((item) => {
    const raw = day.timings[item.api] ?? '';
    const at = raw.includes('T') ? raw : `${date}T${raw.slice(0, 5)}:00`;
    return { key: item.key, at };
  });
  const first = timings[0]?.at ?? '';
  return {
    date,
    timezone: day.meta.timezone,
    utcOffsetMinutes: isoToOffsetMinutes(first),
    hijriLabel: `${day.date.hijri.day} ${day.date.hijri.month.en} ${day.date.hijri.year}`,
    gregorianLabel: `${gregorian.day} ${gregorian.month.en} ${gregorian.year}`,
    methodId: day.meta.method?.id ?? methodId,
    methodName: day.meta.method?.name ?? methodName(methodId, useI18nStore.getState().locale),
    timings,
    source: 'aladhan',
    fetchedAt: new Date().toISOString(),
    disclaimer: translate(useI18nStore.getState().locale, 'aladhanDisclaimer'),
  };
}

function endpoint(query: PrayerQuery, scope: 'day' | 'month'): string {
  const date = query.date ?? new Date();
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const params = new URLSearchParams({
    method: String(query.methodId),
    iso8601: 'true',
    school: '0',
  });
  const { location } = query;
  if (location.latitude != null && location.longitude != null && location.source === 'gps') {
    params.set('latitude', String(location.latitude));
    params.set('longitude', String(location.longitude));
    const path = scope === 'day' ? `timings/${day}-${month}-${year}` : `calendar/${year}/${month}`;
    return `${BASE}/${path}?${params.toString()}`;
  }
  params.set('city', location.district ? `${location.district}, ${location.city}` : location.city);
  params.set('country', location.countryName);
  const path = scope === 'day' ? `timingsByCity/${day}-${month}-${year}` : `calendarByCity/${year}/${month}`;
  return `${BASE}/${path}?${params.toString()}`;
}

export async function fetchPrayerDay(query: PrayerQuery): Promise<PrayerDay> {
  const payload = await fetchJson(endpoint(query, 'day'));
  if (payload.code !== 200 || Array.isArray(payload.data)) {
    throw new Error('AlAdhan günlük vakit yanıtı beklenen formatta değil.');
  }
  return mapDay(payload.data, query.methodId);
}

export async function fetchPrayerMonth(query: PrayerQuery): Promise<PrayerDay[]> {
  const payload = await fetchJson(endpoint(query, 'month'));
  if (payload.code !== 200 || !Array.isArray(payload.data)) {
    throw new Error('AlAdhan aylık vakit yanıtı beklenen formatta değil.');
  }
  return payload.data.map((day) => mapDay(day, query.methodId));
}

export function extractCoordinates(day: AladhanDay): { latitude: number; longitude: number } | null {
  if (typeof day.meta.latitude !== 'number' || typeof day.meta.longitude !== 'number') return null;
  return { latitude: day.meta.latitude, longitude: day.meta.longitude };
}
