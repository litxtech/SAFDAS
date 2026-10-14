import { useState } from 'react';
import { Text } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/layout/Screen';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppInput } from '@/components/ui/AppInput';
import { useT } from '@/i18n';
import { requireSupabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/theme/ThemeProvider';

export default function JournalScreen() {
  const { colors } = useTheme();
  const t = useT();
  const userId = useAuthStore((state) => state.session?.user.id);
  const client = useQueryClient();
  const [body, setBody] = useState('');
  const query = useQuery({
    queryKey: ['journal', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('worship_journal').select('id, body, entry_date').eq('user_id', userId).order('entry_date', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function save() {
    if (!userId || body.trim().length < 2) return;
    await requireSupabase().from('worship_journal').insert({ user_id: userId, body: body.trim() });
    setBody('');
    void client.invalidateQueries({ queryKey: ['journal', userId] });
  }

  return (
    <Screen scroll>
      <AppHeader title={t('journal')} subtitle={t('journalSubtitle')} />
      <AppInput label={t('note')} multiline value={body} onChangeText={setBody} style={{ minHeight: 120, textAlignVertical: 'top' }} />
      <AppButton label={t('save')} onPress={() => void save()} />
      {query.data?.map((entry) => (
        <AppCard key={entry.id as string}>
          <Text style={{ color: colors.textSecondary }}>{entry.entry_date as string}</Text>
          <Text style={{ color: colors.text, lineHeight: 22, marginTop: 6 }}>{entry.body as string}</Text>
        </AppCard>
      ))}
    </Screen>
  );
}
