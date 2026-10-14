import { Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/layout/Screen';
import { AppButton } from '@/components/ui/AppButton';
import { AppEmptyState } from '@/components/ui/AppEmptyState';
import { AppHeader } from '@/components/ui/AppHeader';
import { useT } from '@/i18n';
import { requireSupabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/theme/ThemeProvider';

export default function BlockedScreen() {
  const { colors } = useTheme();
  const t = useT();
  const userId = useAuthStore((state) => state.session?.user.id);
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['blocked', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const db = requireSupabase();
      const { data, error } = await db.from('user_blocks').select('blocked_id').eq('blocker_id', userId);
      if (error) throw error;
      const ids = (data ?? []).map((row) => row.blocked_id as string);
      if (!ids.length) return [];
      const profiles = await db.from('profiles').select('id, username, display_name').in('id', ids);
      if (profiles.error) throw profiles.error;
      return profiles.data ?? [];
    },
  });

  async function unblock(blockedId: string) {
    await requireSupabase().from('user_blocks').delete().eq('blocker_id', userId).eq('blocked_id', blockedId);
    void client.invalidateQueries({ queryKey: ['blocked', userId] });
  }

  return (
    <Screen scroll>
      <AppHeader title={t('blockedTitle')} subtitle={t('blockedSubtitle')} />
      {(query.data ?? []).length === 0 ? <AppEmptyState icon="ban-outline" title={t('noBlockedTitle')} body={t('noBlockedBody')} /> : null}
      {query.data?.map((person) => (
        <View key={person.id as string} style={{ gap: 4 }}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>{person.display_name as string}</Text>
          <Text style={{ color: colors.textSecondary }}>@{person.username as string}</Text>
          <AppButton label={t('unblock')} variant="secondary" onPress={() => void unblock(person.id as string)} />
        </View>
      ))}
    </Screen>
  );
}
