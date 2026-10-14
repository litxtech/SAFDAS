import { useState } from 'react';
import { Text } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/layout/Screen';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppInput } from '@/components/ui/AppInput';
import { AppProgressBar } from '@/components/ui/AppProgressBar';
import { useT } from '@/i18n';
import { requireSupabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/theme/ThemeProvider';

export default function KhatmScreen() {
  const { colors } = useTheme();
  const t = useT();
  const userId = useAuthStore((state) => state.session?.user.id);
  const client = useQueryClient();
  const [title, setTitle] = useState('');
  const [page, setPage] = useState('1');
  const query = useQuery({
    queryKey: ['khatm', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('personal_khatms').select('*').eq('user_id', userId).order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function start() {
    if (!userId) return;
    await requireSupabase().from('personal_khatms').insert({ user_id: userId, title: title.trim() || t('khatm'), current_page: 1, total_pages: 604 });
    void client.invalidateQueries({ queryKey: ['khatm', userId] });
  }

  async function save(id: string) {
    const current = Math.min(604, Math.max(1, Number(page) || 1));
    await requireSupabase().from('personal_khatms').update({ current_page: current }).eq('id', id).eq('user_id', userId);
    void client.invalidateQueries({ queryKey: ['khatm', userId] });
  }

  return (
    <Screen scroll>
      <AppHeader title={t('khatm')} subtitle={t('khatmPrivate')} />
      <AppInput label={t('khatmName')} value={title} onChangeText={setTitle} />
      <AppButton label={t('startKhatm')} onPress={() => void start()} />
      {query.data?.map((item) => {
        const current = item.current_page as number;
        return (
          <AppCard key={item.id as string}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{item.title as string}</Text>
            <Text style={{ color: colors.textSecondary }}>{current} / 604</Text>
            <AppProgressBar value={(current / 604) * 100} />
            <AppInput label={t('pageLabel')} keyboardType="number-pad" value={page} onChangeText={setPage} />
            <AppButton label={t('saveProgress')} variant="secondary" onPress={() => void save(item.id as string)} />
          </AppCard>
        );
      })}
    </Screen>
  );
}
