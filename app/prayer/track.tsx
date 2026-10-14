import { Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '@/components/layout/Screen';
import { AppCard } from '@/components/ui/AppCard';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppProgressBar } from '@/components/ui/AppProgressBar';
import { dateLocale, useI18nStore, useT } from '@/i18n';
import { requireSupabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/theme/ThemeProvider';

const NAMES = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
export default function PrayerTrackScreen() {
  const { colors } = useTheme();
  const t = useT();
  const locale = useI18nStore((state) => state.locale);
  const userId = useAuthStore((state) => state.session?.user.id);
  const query = useQuery({
    queryKey: ['prayer-history', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const from = new Date();
      from.setDate(from.getDate() - 6);
      const { data, error } = await requireSupabase()
        .from('prayer_tracking')
        .select('prayer_date, prayer_name, status')
        .eq('user_id', userId)
        .gte('prayer_date', from.toISOString().slice(0, 10));
      if (error) throw error;
      return data ?? [];
    },
  });

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = date.toISOString().slice(0, 10);
    const rows = (query.data ?? []).filter((row) => row.prayer_date === key && row.status === 'prayed');
    return { key, label: date.toLocaleDateString(dateLocale(locale), { weekday: 'short', day: 'numeric' }), done: rows.length };
  });

  return (
    <Screen scroll>
      <AppHeader title={t('prayerTrack')} subtitle={t('prayerTrackSubtitle')} />
      {days.map((day) => (
        <AppCard key={day.key}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{day.label}</Text>
            <Text style={{ color: colors.primary }}>{day.done}/5</Text>
          </View>
          <AppProgressBar value={(day.done / 5) * 100} />
          <Text style={{ color: colors.textSecondary }}>{NAMES.map((name) => t(name)).join(' · ')}</Text>
        </AppCard>
      ))}
      <Text style={{ color: colors.textSecondary, lineHeight: 20 }}>{t('prayerTrackHint')}</Text>
    </Screen>
  );
}
