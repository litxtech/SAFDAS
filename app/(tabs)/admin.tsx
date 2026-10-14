import { Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router, Redirect, type Href } from 'expo-router';
import { Screen } from '@/components/layout/Screen';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppHeader } from '@/components/ui/AppHeader';
import { useT, type I18nKey } from '@/i18n';
import { requireSupabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/theme/ThemeProvider';

const LINKS: { label: I18nKey; href: Href }[] = [
  { label: 'navUsers', href: '/admin/users' },
  { label: 'posts', href: '/admin/posts' },
  { label: 'navReports', href: '/admin/reports' },
  { label: 'navVoiceRooms', href: '/admin/rooms' },
  { label: 'events', href: '/admin/events' },
  { label: 'navHelpCalls', href: '/admin/help' },
  { label: 'navContent', href: '/admin/content' },
  { label: 'navRoles', href: '/admin/roles' },
  { label: 'navAudit', href: '/admin/audit' },
  { label: 'navApi', href: '/admin/api' },
];

export default function AdminScreen() {
  const isStaff = useAuthStore((state) => state.isStaff);
  const { colors } = useTheme();
  const t = useT();
  const stats = useQuery({
    queryKey: ['admin-stats'],
    enabled: isStaff,
    queryFn: async () => {
      const client = requireSupabase();
      const [users, posts, reports, rooms] = await Promise.all([
        client.from('profiles').select('id', { count: 'exact', head: true }),
        client.from('posts').select('id', { count: 'exact', head: true }),
        client.from('reports').select('id', { count: 'exact', head: true }).in('status', ['received', 'waiting', 'in_review']),
        client.from('live_rooms').select('id', { count: 'exact', head: true }).eq('status', 'live'),
      ]);
      return {
        users: users.count ?? 0,
        posts: posts.count ?? 0,
        reports: reports.count ?? 0,
        rooms: rooms.count ?? 0,
      };
    },
  });

  if (!isStaff) return <Redirect href="/(tabs)" />;

  const cards: { label: I18nKey; value: number }[] = [
    { label: 'statUsers', value: stats.data?.users ?? 0 },
    { label: 'postCountLabel', value: stats.data?.posts ?? 0 },
    { label: 'statPendingReports', value: stats.data?.reports ?? 0 },
    { label: 'statLiveRooms', value: stats.data?.rooms ?? 0 },
  ];

  return (
    <Screen scroll tabBar>
      <AppHeader title={t('adminPanel')} subtitle={t('adminSubtitle')} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {cards.map((card) => (
          <View key={card.label} style={{ width: '47%' }}>
            <AppCard>
              <Text style={{ color: colors.textSecondary }}>{t(card.label)}</Text>
              <Text style={{ color: colors.text, fontSize: 28, fontWeight: '700' }}>{card.value}</Text>
            </AppCard>
          </View>
        ))}
      </View>
      {LINKS.map((link) => (
        <AppButton key={link.label} label={t(link.label)} variant="secondary" onPress={() => router.push(link.href)} />
      ))}
    </Screen>
  );
}
