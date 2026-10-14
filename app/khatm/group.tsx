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
import { useToastStore } from '@/stores/toastStore';
import { useTheme } from '@/theme/ThemeProvider';

export default function GroupKhatmScreen() {
  const { colors } = useTheme();
  const t = useT();
  const userId = useAuthStore((state) => state.session?.user.id);
  const show = useToastStore((state) => state.show);
  const client = useQueryClient();
  const [title, setTitle] = useState('');
  const query = useQuery({
    queryKey: ['group-khatm'],
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('group_khatms').select('id, title, description').order('created_at', { ascending: false });
      if (error) throw error;
      const ids = (data ?? []).map((item) => item.id as string);
      const assignments = ids.length
        ? await requireSupabase().from('group_khatm_assignments').select('khatm_id, juz, status, user_id').in('khatm_id', ids)
        : { data: [] };
      return (data ?? []).map((item) => ({
        ...item,
        rows: (assignments.data ?? []).filter((row) => row.khatm_id === item.id),
      }));
    },
  });

  async function create() {
    if (!userId || title.trim().length < 3) return;
    const db = requireSupabase();
    const { data, error } = await db.from('group_khatms').insert({ owner_id: userId, title: title.trim(), visibility: 'public' }).select('id').single();
    if (error || !data) {
      show(error?.message ?? t('khatmOpenFailed'), 'error');
      return;
    }
    await db.from('group_khatm_members').insert({ khatm_id: data.id, user_id: userId });
    setTitle('');
    void client.invalidateQueries({ queryKey: ['group-khatm'] });
  }

  async function takeJuz(khatmId: string, taken: number[]) {
    if (!userId) return;
    const juz = Array.from({ length: 30 }, (_, index) => index + 1).find((value) => !taken.includes(value));
    if (!juz) {
      show(t('allJuzTaken'), 'info');
      return;
    }
    await requireSupabase().from('group_khatm_members').upsert({ khatm_id: khatmId, user_id: userId }, { onConflict: 'khatm_id,user_id' });
    const { error } = await requireSupabase().from('group_khatm_assignments').insert({ khatm_id: khatmId, user_id: userId, juz, status: 'assigned' });
    if (error) show(t('juzConflict'), 'error');
    void client.invalidateQueries({ queryKey: ['group-khatm'] });
  }

  return (
    <Screen scroll>
      <AppHeader title={t('groupKhatm')} subtitle={t('sameJuzHint')} />
      <AppInput label={t('khatmName')} value={title} onChangeText={setTitle} />
      <AppButton label={t('openCircleKhatm')} onPress={() => void create()} />
      {query.data?.map((item) => {
        const rows = item.rows as { juz: number; status: string; user_id: string }[];
        const done = rows.filter((row) => row.status === 'done').length;
        return (
          <AppCard key={item.id as string}>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 18 }}>{item.title as string}</Text>
            <Text style={{ color: colors.textSecondary }}>{t('juzProgress', { done })}</Text>
            <AppProgressBar value={(rows.length / 30) * 100} />
            <AppButton label={t('takeEmptyJuz')} variant="secondary" onPress={() => void takeJuz(item.id as string, rows.map((row) => row.juz))} />
          </AppCard>
        );
      })}
    </Screen>
  );
}
