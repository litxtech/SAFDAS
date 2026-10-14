import { Text } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/layout/Screen';
import { AppCard } from '@/components/ui/AppCard';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppSwitch } from '@/components/ui/AppSwitch';
import { useT, type I18nKey } from '@/i18n';
import { requireSupabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/theme/ThemeProvider';

const STEPS: { key: string; title: I18nKey; body: I18nKey }[] = [
  { key: 'ihram', title: 'ihram', body: 'ihramBody' },
  { key: 'tawaf', title: 'tawaf', body: 'tawafBody' },
  { key: 'say', title: 'sayStep', body: 'sayBody' },
  { key: 'wuquf', title: 'wuquf', body: 'wuqufBody' },
  { key: 'notes', title: 'personalNote', body: 'personalNoteBody' },
];

export default function HajjScreen() {
  const { colors } = useTheme();
  const t = useT();
  const userId = useAuthStore((state) => state.session?.user.id);
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['hajj', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('hajj_notes').select('step_key, done').eq('user_id', userId);
      if (error) throw error;
      return data ?? [];
    },
  });

  async function toggle(step: string, done: boolean) {
    if (!userId) return;
    await requireSupabase().from('hajj_notes').upsert({ user_id: userId, step_key: step, done }, { onConflict: 'user_id,step_key' });
    void client.invalidateQueries({ queryKey: ['hajj', userId] });
  }

  return (
    <Screen scroll>
      <AppHeader title={t('hajj')} subtitle={t('hajjSubtitle')} />
      {STEPS.map((step) => (
        <AppCard key={step.key}>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 18 }}>{t(step.title)}</Text>
          <Text style={{ color: colors.textSecondary, lineHeight: 20, marginVertical: 8 }}>{t(step.body)}</Text>
          <AppSwitch label={t('stepDone')} value={Boolean(query.data?.find((row) => row.step_key === step.key && row.done))} onValueChange={(value) => void toggle(step.key, value)} />
        </AppCard>
      ))}
    </Screen>
  );
}
