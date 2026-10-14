import { supabase } from '@/lib/supabase';
import { fetchPrayerDay, fetchPrayerMonth } from './aladhan';
import { prayerCacheKey, readMonthCache, writeMonthCache } from './cache';
import { calculateFallbackDay } from './fallback';
import type { PrayerDay, PrayerQuery } from './types';

const memory = new Map<string, PrayerDay[]>();

function dayFromMonth(days: PrayerDay[], date: Date): PrayerDay | undefined {
  const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return days.find((day) => day.date === iso);
}

async function recordHealth(ok: boolean, responseMs: number, message?: string) {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  if (!data.session) return;
  await supabase.from('api_health_logs').insert({
    provider_name: 'aladhan',
    status: ok ? 'ok' : 'error',
    response_time_ms: responseMs,
    error_message: message ?? null,
  });
}

export async function loadPrayerMonth(query: PrayerQuery): Promise<PrayerDay[]> {
  const date = query.date ?? new Date();
  const key = prayerCacheKey({
    methodId: query.methodId,
    country: query.location.countryCode,
    city: `${query.location.city}:${query.location.district ?? ''}:${query.location.latitude ?? ''}`,
    year: date.getFullYear(),
    month: date.getMonth() + 1,
  });

  const started = Date.now();
  try {
    const remote = await fetchPrayerMonth(query);
    memory.set(key, remote);
    await writeMonthCache(key, remote);
    await recordHealth(true, Date.now() - started);
    return remote;
  } catch (error) {
    await recordHealth(false, Date.now() - started, error instanceof Error ? error.message : 'unknown');
    const cached = memory.get(key) ?? (await readMonthCache(key));
    if (cached?.length) {
      return cached.map((day) => ({ ...day, source: 'cache' as const }));
    }
    const fallbackDays: PrayerDay[] = [];
    const cursor = new Date(date.getFullYear(), date.getMonth(), 1);
    const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    for (let day = 1; day <= last; day += 1) {
      cursor.setDate(day);
      const computed = calculateFallbackDay(query, new Date(cursor));
      if (computed) fallbackDays.push(computed);
    }
    if (fallbackDays.length) return fallbackDays;
    throw error;
  }
}

export async function loadPrayerDay(query: PrayerQuery): Promise<PrayerDay> {
  const date = query.date ?? new Date();
  try {
    const month = await loadPrayerMonth(query);
    const match = dayFromMonth(month, date);
    if (match) return match;
  } catch {
    // Günlük uç nokta aşağıda ayrıca denenir.
  }

  const started = Date.now();
  try {
    const day = await fetchPrayerDay(query);
    await recordHealth(true, Date.now() - started);
    return day;
  } catch (error) {
    await recordHealth(false, Date.now() - started, error instanceof Error ? error.message : 'unknown');
    const fallback = calculateFallbackDay(query, date);
    if (fallback) return fallback;
    throw error;
  }
}

export function nextPrayer(day: PrayerDay, now = new Date()): { key: PrayerDay['timings'][number]['key']; at: Date } | null {
  const upcoming = day.timings
    .map((item) => ({ key: item.key, at: new Date(item.at) }))
    .filter((item) => item.key !== 'sunrise' && item.at.getTime() > now.getTime())
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  return upcoming[0] ?? null;
}

export function formatCountdown(target: Date, now = new Date()): string {
  const diff = Math.max(0, target.getTime() - now.getTime());
  const totalSeconds = Math.floor(diff / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
}
