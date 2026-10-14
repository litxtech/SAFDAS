import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { Screen } from '@/components/layout/Screen';
import { AppCard } from '@/components/ui/AppCard';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppProgressBar } from '@/components/ui/AppProgressBar';
import { useT, type I18nKey } from '@/i18n';
import { requireSupabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/theme/ThemeProvider';

const TILES: { title: I18nKey; icon: keyof typeof Ionicons.glyphMap; href: Href; wide?: boolean }[] = [
  { title: 'quran', icon: 'book-outline', href: '/quran', wide: true },
  { title: 'prayerTimes', icon: 'time-outline', href: '/prayer' },
  { title: 'prayerTrack', icon: 'checkmark-circle-outline', href: '/prayer/track' },
  { title: 'qibla', icon: 'compass-outline', href: '/qibla' },
  { title: 'duas', icon: 'heart-outline', href: '/duas' },
  { title: 'dhikr', icon: 'ellipse-outline', href: '/dhikr' },
  { title: 'khatm', icon: 'layers-outline', href: '/khatm' },
  { title: 'groupKhatm', icon: 'people-circle-outline', href: '/khatm/group' },
  { title: 'ramadan', icon: 'moon-outline', href: '/ramadan' },
  { title: 'calendar', icon: 'calendar-outline', href: '/calendar' },
  { title: 'hajj', icon: 'map-outline', href: '/hajj' },
  { title: 'journal', icon: 'journal-outline', href: '/journal' },
  { title: 'education', icon: 'school-outline', href: '/education' },
  { title: 'circles', icon: 'people-outline', href: '/circles', wide: true },
  { title: 'rooms', icon: 'mic-outline', href: '/rooms' },
  { title: 'mosques', icon: 'business-outline', href: '/mosques' },
  { title: 'events', icon: 'calendar-number-outline', href: '/events' },
  { title: 'help', icon: 'hand-left-outline', href: '/help' },
  { title: 'family', icon: 'home-outline', href: '/family' },
];

const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;

export default function WorshipScreen() {
  const { colors } = useTheme();
  const t = useT();
  const userId = useAuthStore((state) => state.session?.user.id);
  const client = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const tracking = useQuery({
    queryKey: ['prayer-tracking', userId, today],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('prayer_tracking')
        .select('prayer_name, status')
        .eq('user_id', userId)
        .eq('prayer_date', today);
      if (error) throw error;
      return data ?? [];
    },
  });

  async function mark(prayer: string) {
    if (!userId) return;
    const current = tracking.data?.find((row) => row.prayer_name === prayer)?.status;
    const status = current === 'prayed' ? 'unmarked' : 'prayed';
    const { error } = await requireSupabase().from('prayer_tracking').upsert(
      {
        user_id: userId,
        prayer_date: today,
        prayer_name: prayer,
        status,
      },
      { onConflict: 'user_id,prayer_date,prayer_name' },
    );
    if (!error) void client.invalidateQueries({ queryKey: ['prayer-tracking', userId, today] });
  }

  const done = PRAYERS.filter((prayer) => tracking.data?.some((row) => row.prayer_name === prayer && row.status === 'prayed')).length;

  return (
    <Screen scroll tabBar>
      <AppHeader title={t('worship')} subtitle={t('dailyPrayer')} />
      <AppCard>
        <Text style={{ color: colors.text, fontWeight: '700', marginBottom: 8 }}>{t('dailyPrayer')}</Text>
        <AppProgressBar value={(done / 5) * 100} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 }}>
          {PRAYERS.map((prayer) => {
            const active = tracking.data?.some((row) => row.prayer_name === prayer && row.status === 'prayed');
            return (
              <Pressable key={prayer} onPress={() => void mark(prayer)} style={{ alignItems: 'center', gap: 6 }}>
                <Ionicons name={active ? 'checkmark-circle' : 'ellipse-outline'} size={28} color={active ? colors.primary : colors.iconMuted} />
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t(prayer)}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={{ color: colors.textSecondary, marginTop: 12, fontSize: 12 }}>{t('privateWorship')}</Text>
      </AppCard>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {TILES.map((tile) => (
          <Pressable key={tile.title} onPress={() => router.push(tile.href)} style={{ width: tile.wide ? '100%' : '47%' }}>
            <AppCard>
              <Ionicons name={tile.icon} size={22} color={colors.primary} />
              <Text style={{ color: colors.text, fontWeight: '700', marginTop: 10 }}>{t(tile.title)}</Text>
            </AppCard>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
