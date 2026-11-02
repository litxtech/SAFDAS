import { View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Redirect, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/layout/Screen';
import {
  AdminAlertBubble,
  AdminGrid,
  AdminHero,
  AdminMetrics,
  AdminNavCard,
  AdminSection,
} from '@/components/admin/AdminKit';
import { useT, type I18nKey } from '@/i18n';
import {
  fetchAdminAlerts,
  markAdminAlertSeen,
  type AdminAlertKey,
} from '@/services/admin/alerts';
import { requireSupabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

type Link = {
  label: I18nKey;
  hint: I18nKey;
  href: Href;
  icon: keyof typeof Ionicons.glyphMap;
  alertKey?: AdminAlertKey;
};

const PEOPLE: Link[] = [
  { label: 'navUsers', hint: 'navUsersHint', href: '/admin/users', icon: 'people' },
  { label: 'navDeletedAccounts', hint: 'navDeletedAccountsHint', href: '/admin/deleted-accounts', icon: 'trash' },
  { label: 'navRoles', hint: 'navRolesHint', href: '/admin/roles', icon: 'shield' },
  { label: 'navDemo', hint: 'navDemoHint', href: '/admin/demo', icon: 'flask' },
];

const SAFETY: Link[] = [
  { label: 'moderationConsole', hint: 'navReportsHint', href: '/admin/reports', icon: 'shield-checkmark', alertKey: 'reports' },
  { label: 'posts', hint: 'navPostsHint', href: '/admin/posts', icon: 'newspaper' },
  { label: 'navVoiceRooms', hint: 'navRoomsHint', href: '/admin/rooms', icon: 'mic', alertKey: 'live' },
];

const PLATFORM: Link[] = [
  { label: 'safdasAi', hint: 'safdasAiHint', href: '/admin/ai', icon: 'sparkles' },
  { label: 'navDailyMessages', hint: 'navDailyMessagesHint', href: '/admin/daily-messages', icon: 'mail' },
  { label: 'events', hint: 'navEventsHint', href: '/admin/events', icon: 'calendar' },
  { label: 'navHelpCalls', hint: 'navHelpHint', href: '/admin/help', icon: 'hand-left', alertKey: 'help' },
  { label: 'navContent', hint: 'navContentHint', href: '/admin/content', icon: 'book' },
  { label: 'contentCatalogTitle', hint: 'contentCatalogSubtitle', href: '/admin/catalog', icon: 'cloud-download', alertKey: 'catalog' },
  { label: 'navAdhanSounds', hint: 'navAdhanSoundsHint', href: '/admin/adhan-sounds', icon: 'musical-notes' },
  { label: 'studioAdminTitle', hint: 'studioAdminHint', href: '/admin/studio', icon: 'mic' },
  { label: 'navAudit', hint: 'navAuditHint', href: '/admin/audit', icon: 'time' },
  { label: 'navApi', hint: 'navApiHint', href: '/admin/api', icon: 'pulse' },
];

const ALERT_ICONS: Record<AdminAlertKey, keyof typeof Ionicons.glyphMap> = {
  reports: 'flag',
  catalog: 'cloud-download',
  help: 'hand-left',
  live: 'radio',
};

export default function AdminScreen() {
  const isStaff = useAuthStore((state) => state.isStaff);
  const t = useT();
  const queryClient = useQueryClient();

  const stats = useQuery({
    queryKey: ['admin-stats'],
    enabled: isStaff,
    refetchInterval: 45_000,
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

  const alerts = useQuery({
    queryKey: ['admin-alerts'],
    enabled: isStaff,
    refetchInterval: 20_000,
    queryFn: fetchAdminAlerts,
  });

  if (!isStaff) return <Redirect href="/(tabs)" />;

  const badgeByKey = new Map((alerts.data ?? []).map((a) => [a.key, a.count]));

  async function openAlert(key: AdminAlertKey, href: Href, latestAt: string | null) {
    await markAdminAlertSeen(key, latestAt);
    await queryClient.invalidateQueries({ queryKey: ['admin-alerts'] });
    await queryClient.invalidateQueries({ queryKey: ['admin-badge'] });
    router.push(href);
  }

  function openLink(link: Link) {
    if (link.alertKey) {
      const hit = (alerts.data ?? []).find((a) => a.key === link.alertKey);
      void openAlert(link.alertKey, link.href, hit?.latestAt ?? null);
      return;
    }
    router.push(link.href);
  }

  function section(title: string, links: Link[], toneOffset: number) {
    return (
      <View style={{ gap: 10 }}>
        <AdminSection title={title} />
        <AdminGrid>
          {links.map((link, index) => (
            <AdminNavCard
              key={link.label}
              title={t(link.label)}
              subtitle={t(link.hint)}
              icon={link.icon}
              toneIndex={toneOffset + index}
              badge={link.alertKey ? badgeByKey.get(link.alertKey) : undefined}
              onPress={() => openLink(link)}
            />
          ))}
        </AdminGrid>
      </View>
    );
  }

  const alertRows = alerts.data ?? [];

  return (
    <Screen scroll tabBar>
      <AdminHero
        title={t('adminPanel')}
        subtitle={t('adminHomeHint')}
        trailing={
          alertRows.length > 0 ? (
            <View
              style={{
                minWidth: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: '#E91429',
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 8,
              }}
            >
              <Ionicons name="notifications" size={14} color="#fff" />
            </View>
          ) : null
        }
      />

      <View style={{ gap: 18, paddingBottom: 16 }}>
        {alertRows.length > 0 ? (
          <View style={{ gap: 8 }}>
            <AdminSection title={t('adminAlertsTitle')} />
            {alertRows.map((alert) => (
              <AdminAlertBubble
                key={alert.key}
                title={t(alert.titleKey)}
                body={t(alert.bodyKey, { count: alert.count })}
                icon={ALERT_ICONS[alert.key]}
                count={alert.count}
                onPress={() => void openAlert(alert.key, alert.href, alert.latestAt)}
              />
            ))}
          </View>
        ) : null}

        <AdminMetrics
          items={[
            { label: t('statUsers'), value: stats.data?.users ?? 0, icon: 'people', onPress: () => router.push('/admin/users') },
            { label: t('postCountLabel'), value: stats.data?.posts ?? 0, icon: 'newspaper', onPress: () => router.push('/admin/posts') },
            {
              label: t('statPendingReports'),
              value: stats.data?.reports ?? 0,
              icon: 'flag',
              onPress: () => void openAlert('reports', '/admin/reports', alerts.data?.find((a) => a.key === 'reports')?.latestAt ?? null),
            },
            {
              label: t('statLiveRooms'),
              value: stats.data?.rooms ?? 0,
              icon: 'mic',
              onPress: () => void openAlert('live', '/admin/rooms', alerts.data?.find((a) => a.key === 'live')?.latestAt ?? null),
            },
          ]}
        />

        {section(t('adminPeople'), PEOPLE, 0)}
        {section(t('adminSafety'), SAFETY, 4)}
        {section(t('adminPlatform'), PLATFORM, 1)}
      </View>
    </Screen>
  );
}
