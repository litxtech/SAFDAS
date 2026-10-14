import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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

export function PrayerHero({ day, city }: { day: PrayerDay; city: string }) {
  const { colors, name } = useTheme();
  const t = useT();
  const locale = useI18nStore((state) => state.locale);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const upcoming = nextPrayer(day, now);
  const gradient = name === 'dark' ? (['#3A2758', '#282B36', '#20222D'] as const) : (['#F7F1FC', '#FFFFFF', '#F8F8FC'] as const);

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
      <Text style={{ color: colors.textSecondary, marginTop: 16 }}>{t('nextPrayer')}</Text>
      <Text style={[styles.next, { color: colors.text }]}>{upcoming ? t(LABELS[upcoming.key]) : t('prayersDone')}</Text>
      <Text style={[styles.count, { color: colors.primary }]}>{upcoming ? formatCountdown(upcoming.at, now) : '--:--:--'}</Text>
      <View style={styles.times}>
        {day.timings.map((item) => (
          <View key={item.key} style={styles.time}>
            <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{t(LABELS[item.key])}</Text>
            <Text style={{ color: colors.text, fontWeight: '700' }}>
              {new Date(item.at).toLocaleTimeString(dateLocale(locale), { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        ))}
      </View>
      <Pressable onPress={() => router.push('/prayer')}>
        <Text style={{ color: colors.primary, fontWeight: '700', marginTop: 12 }}>{t('seeAllTimes')}</Text>
      </Pressable>
      <Text style={[styles.note, { color: colors.textSecondary }]}>{day.disclaimer}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, padding: 18, borderWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  city: { fontSize: 20, fontWeight: '700' },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start' },
  next: { fontSize: 28, fontWeight: '700', marginTop: 2 },
  count: { fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'], marginTop: 4 },
  times: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  time: { alignItems: 'center', gap: 2 },
  note: { fontSize: 11, lineHeight: 16, marginTop: 12 },
});
