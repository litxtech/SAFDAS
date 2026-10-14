import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PrayerDay } from './types';

const PREFIX = 'safdas:prayer:v1:';

export function prayerCacheKey(parts: {
  methodId: number;
  country: string;
  city: string;
  year: number;
  month: number;
}): string {
  return `${PREFIX}${parts.methodId}:${parts.country}:${parts.city}:${parts.year}-${parts.month}`;
}

export async function readMonthCache(key: string): Promise<PrayerDay[] | null> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PrayerDay[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function writeMonthCache(key: string, days: PrayerDay[]): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(days));
}
