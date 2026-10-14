export type PrayerKey = 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

export type PrayerSource = 'aladhan' | 'cache' | 'fallback';

export type PrayerInstant = {
  key: PrayerKey;
  at: string;
};

export type PrayerDay = {
  date: string;
  timezone: string;
  utcOffsetMinutes: number;
  hijriLabel: string | null;
  gregorianLabel: string;
  methodId: number;
  methodName: string;
  timings: PrayerInstant[];
  source: PrayerSource;
  fetchedAt: string;
  disclaimer: string;
};

export type PrayerLocation = {
  countryCode: string;
  countryName: string;
  city: string;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  utcOffsetMinutes: number | null;
  source: 'gps' | 'manual';
};

export type PrayerQuery = {
  location: PrayerLocation;
  methodId: number;
  date?: Date;
};
