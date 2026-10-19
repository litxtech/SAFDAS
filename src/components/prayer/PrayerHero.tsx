import { useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { formatCountdown, nextPrayer } from '@/services/prayer/service';
import type { PrayerDay, PrayerKey } from '@/services/prayer/types';
import { dateLocale, useI18nStore, useT, type I18nKey } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';

const LABELS: Record<PrayerKey, I18nKey> = {
  fajr: 'fajr',
  sunrise: 'sunrise',
  dhuhr: 'dhuhr',
  asr: 'asr',
  maghrib: 'maghrib',
  isha: 'isha',
};

export function PrayerHero({ day, city, compact }: { day: PrayerDay; city: string; compact?: boolean }) {
  const { colors, name } = useTheme();
  const t = useT();
  const locale = useI18nStore((state) => state.locale);
  const focused = useIsFocused();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!focused) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer) return;
      setNow(new Date());
      timer = setInterval(() => setNow(new Date()), 1000);
    };
    const stop = () => {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    };
    if (AppState.currentState === 'active') start();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') start();
      else stop();
    });
    return () => {
      stop();
      sub.remove();
    };
  }, [focused]);
  const upcoming = nextPrayer(day, now);
  const gradient = name === 'dark' ? (['#3A2758', '#282B36', '#20222D'] as const) : (['#F7F1FC', '#FFFFFF', '#F8F8FC'] as const);

  const timeLabel = (at: string) => new Date(at).toLocaleTimeString(dateLocale(locale), { hour: '2-digit', minute: '2-digit' });

  if (compact) {
    return (
      <Pressable accessibilityRole="button" onPress={() => router.push('/prayer')}>
        <LinearGradient colors={gradient} style={[styles.compact, { borderColor: colors.border }]}>
          <View style={styles.compactTop}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }} numberOfLines={1}>
                {t('nextPrayer')} · {city}
              </Text>
              <Text style={[styles.compactName, { color: colors.text }]} numberOfLines={1}>
                {upcoming ? t(LABELS[upcoming.key]) : t('prayersDone')}
              </Text>
            </View>
            <View style={[styles.countPill, { backgroundColor: colors.primaryMuted }]}>
              <Text style={[styles.compactCount, { color: colors.primary }]}>{upcoming ? formatCountdown(upcoming.at, now) : '--:--'}</Text>
            </View>
          </View>
          <View style={styles.compactTimes}>
            {day.timings.map((item) => {
              const active = upcoming?.key === item.key;
              return (
                <View key={item.key} style={[styles.compactTime, active && { backgroundColor: colors.primary }]}>
                  <Text style={{ color: active ? colors.onPrimary : colors.textSecondary, fontSize: 10 }} numberOfLines={1}>
                    {t(LABELS[item.key])}
                  </Text>
                  <Text style={{ color: active ? colors.onPrimary : colors.text, fontSize: 12, fontWeight: '700' }}>{timeLabel(item.at)}</Text>
                </View>
              );
            })}
          </View>
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <LinearGradient colors={gradient} style={[styles.card, { borderColor: colors.border }]}>
      <View style={styles.row}>
        <View>
          <Text style={[styles.city, { color: colors.text }]}>{city}</Text>
          <Text style={{ color: colors.textSecondary }}>{day.hijriLabel ?? day.gregorianLabel}</Text>
        </View>
        <View style={[styles.pill, { backgroundColor: colors.primaryMuted }]}>
          <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>{day.source === 'aladhan' ? 'AlAdhan' : day.source === 'cache' ? t('sourceCache') : t('sourceFallback')}</Text>
        </View>
      </View>
      <View style={styles.nextRow}>
        <View>
          <Text style={{ color: colors.textSecondary }}>{t('nextPrayer')}</Text>
          <Text style={[styles.next, { color: colors.text }]}>{upcoming ? t(LABELS[upcoming.key]) : t('prayersDone')}</Text>
        </View>
        <Text style={[styles.count, { color: colors.primary }]}>{upcoming ? formatCountdown(upcoming.at, now) : '--:--'}</Text>
      </View>
      <View style={styles.times}>
        {day.timings.map((item) => (
          <View key={item.key} style={styles.time}>
            <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{t(LABELS[item.key])}</Text>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{timeLabel(item.at)}</Text>
          </View>
        ))}
      </View>
      <Pressable onPress={() => router.push('/prayer')}>
        <Text style={{ color: colors.primary, fontWeight: '700', marginTop: 12 }}>{t('seeAllTimes')}</Text>
      </Pressable>
      <Text style={[styles.note, { color: colors.textSecondary }]} numberOfLines={2}>{day.disclaimer}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, padding: 14, borderWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  city: { fontSize: 16, fontWeight: '700' },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  nextRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 10 },
  next: { fontSize: 20, fontWeight: '700' },
  count: { fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },
  times: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  time: { alignItems: 'center', gap: 2 },
  note: { fontSize: 11, lineHeight: 16, marginTop: 12 },
  compact: { borderRadius: 18, paddingHorizontal: 12, paddingVertical: 10, borderWidth: StyleSheet.hairlineWidth, gap: 8 },
  compactTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  compactName: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3, marginTop: 1 },
  countPill: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  compactCount: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  compactTimes: { flexDirection: 'row', gap: 4 },
  compactTime: { flex: 1, alignItems: 'center', borderRadius: 10, paddingVertical: 4, gap: 1 },
});
