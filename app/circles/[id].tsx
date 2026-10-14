import { useState } from 'react';
import { Text } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/layout/Screen';
import { AppButton } from '@/components/ui/AppButton';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppTabs } from '@/components/ui/AppTabs';
import { useT } from '@/i18n';
import { requireSupabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/theme/ThemeProvider';

export default function CircleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const t = useT();
  const userId = useAuthStore((state) => state.session?.user.id);
  const [tab, setTab] = useState('about');
  const client = useQueryClient();
  const circle = useQuery({
    queryKey: ['circle', id],
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('circles').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const member = useQuery({
    queryKey: ['circle-member', id, userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data } = await requireSupabase().from('circle_members').select('role').eq('circle_id', id).eq('user_id', userId).maybeSingle();
      return data;
    },
  });

  async function join() {
    if (!userId || !id) return;
    await requireSupabase().from('circle_members').insert({ circle_id: id, user_id: userId, role: 'member' });
    void client.invalidateQueries({ queryKey: ['circle-member', id, userId] });
    void client.invalidateQueries({ queryKey: ['circle', id] });
  }

  return (
    <Screen scroll>
      <AppHeader title={(circle.data?.name as string) ?? t('circleFallback')} subtitle={t('memberCount', { count: (circle.data?.member_count as number | undefined) ?? 0 })} />
      <Text style={{ color: colors.text, lineHeight: 22 }}>{circle.data?.description as string}</Text>
      {member.data ? <Text style={{ color: colors.primary }}>{t('yourRole', { role: member.data.role as string })}</Text> : <AppButton label={t('join')} onPress={() => void join()} />}
      <AppTabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'about', label: t('about') },
          { key: 'posts', label: t('posts') },
          { key: 'events', label: t('events') },
        ]}
      />
      <Text style={{ color: colors.textSecondary }}>
        {tab === 'about' ? t('circleAboutHint') : t('circlePostsHint')}
      </Text>
    </Screen>
  );
}
