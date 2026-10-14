import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/layout/Screen';
import { AppEmptyState } from '@/components/ui/AppEmptyState';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppTabs } from '@/components/ui/AppTabs';
import { dateLocale, useI18nStore, useT } from '@/i18n';
import { requireSupabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/theme/ThemeProvider';

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const t = useT();
  const locale = useI18nStore((state) => state.locale);
  const userId = useAuthStore((state) => state.session?.user.id);
  const [tab, setTab] = useState('all');
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['notifications', userId, tab],
    enabled: Boolean(userId),
    queryFn: async () => {
      let request = requireSupabase().from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50);
      if (tab !== 'all') request = request.eq('category', tab);
      const { data, error } = await request;
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <Screen scroll>
      <AppHeader title={t('notifications')} />
      <AppTabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'all', label: t('filterAll') },
          { key: 'social', label: t('filterSocial') },
          { key: 'worship', label: t('worship') },
          { key: 'community', label: t('filterCommunity') },
          { key: 'security', label: t('filterSecurity') },
        ]}
      />
      {(query.data ?? []).length === 0 ? <AppEmptyState icon="notifications-outline" title={t('noNotificationsTitle')} body={t('noNotificationsBody')} /> : null}
      {query.data?.map((item) => (
        <Pressable
          key={item.id as string}
          onPress={() => {
            void requireSupabase().from('notifications').update({ read_at: new Date().toISOString() }).eq('id', item.id);
            void client.invalidateQueries({ queryKey: ['notifications', userId, tab] });
          }}
          style={{ backgroundColor: item.read_at ? 'transparent' : colors.unread, borderRadius: 16, padding: 12 }}
        >
          <Text style={{ color: colors.text }}>{item.body as string}</Text>
          <Text style={{ color: colors.textSecondary }}>{new Date(item.created_at as string).toLocaleString(dateLocale(locale))}</Text>
        </Pressable>
      ))}
    </Screen>
  );
}
