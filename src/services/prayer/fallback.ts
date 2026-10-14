import {
  CalculationMethod,
  Coordinates,
  Madhab,
  PrayerTimes,
  type CalculationParameters,
} from 'adhan';
import { dateLocale, translate, useI18nStore } from '@/i18n';
import { methodName } from './methods';
import type { PrayerDay, PrayerKey, PrayerQuery } from './types';

const KEYS: PrayerKey[] = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];

function parametersFor(methodId: number): CalculationParameters {
  switch (methodId) {
    case 13:
      return CalculationMethod.Turkey();
    case 4:
      return CalculationMethod.UmmAlQura();
    case 2:
      return CalculationMethod.NorthAmerica();
    case 5:
      return CalculationMethod.Egyptian();
    case 1:
      return CalculationMethod.Karachi();
    case 8:
      return CalculationMethod.Dubai();
    case 9:
      return CalculationMethod.Kuwait();
    case 10:
      return CalculationMethod.Qatar();
    case 11:
      return CalculationMethod.Singapore();
    case 15:
      return CalculationMethod.MoonsightingCommittee();
    case 3:
    case 12:
    default:
      return CalculationMethod.MuslimWorldLeague();
  }
}

function hijriLabel(date: Date): string | null {
  try {
    return new Intl.DateTimeFormat('tr-TR-u-ca-islamic', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  } catch {
    return null;
  }
}

/**
 * adhan, anı cihaz saat dilimine göre üretir. Konum başka bir saat dilimindeyse
 * son bilinen UTC farkı kadar kaydırılır. Bu yedek sonuç resmî takvim değildir.
 */
export function calculateFallbackDay(query: PrayerQuery, date = query.date ?? new Date()): PrayerDay | null {
  const { latitude, longitude, utcOffsetMinutes } = query.location;
  if (latitude == null || longitude == null) return null;

  const params = parametersFor(query.methodId);
  params.madhab = Madhab.Shafi;
  const prayerTimes = new PrayerTimes(new Coordinates(latitude, longitude), date, params);
  const deviceOffset = -date.getTimezoneOffset();
  const targetOffset = utcOffsetMinutes ?? deviceOffset;
  const shiftMs = (deviceOffset - targetOffset) * 60 * 1000;

  const map: Record<PrayerKey, Date> = {
    fajr: prayerTimes.fajr,
    sunrise: prayerTimes.sunrise,
    dhuhr: prayerTimes.dhuhr,
    asr: prayerTimes.asr,
    maghrib: prayerTimes.maghrib,
    isha: prayerTimes.isha,
  };

  const isoDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const locale = useI18nStore.getState().locale;

  return {
    date: isoDate,
    timezone: query.location.timezone ?? 'device',
    utcOffsetMinutes: targetOffset,
    hijriLabel: hijriLabel(date),
    gregorianLabel: date.toLocaleDateString(dateLocale(locale), { day: 'numeric', month: 'long', year: 'numeric' }),
    methodId: query.methodId,
    methodName: methodName(query.methodId, locale),
    timings: KEYS.map((key) => ({
      key,
      at: new Date(map[key].getTime() + shiftMs).toISOString(),
    })),
    source: 'fallback',
    fetchedAt: new Date().toISOString(),
    disclaimer: translate(locale, 'fallbackDisclaimer'),
  };
}
