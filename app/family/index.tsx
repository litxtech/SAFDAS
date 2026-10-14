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

export default function FamilyScreen() {
  const t = useT();
  const { colors } = useTheme();
  const userId = useAuthStore((state) => state.session?.user.id);
  const client = useQueryClient();
  const [name, setName] = useState('');
  const query = useQuery({
    queryKey: ['family', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('family_groups').select('id, name').eq('owner_id', userId);
      if (error) throw error;
      return data ?? [];
    },
  });

  async function create() {
    if (!userId || name.trim().length < 2) return;
    await requireSupabase().from('family_groups').insert({ owner_id: userId, name: name.trim() });
    void client.invalidateQueries({ queryKey: ['family', userId] });
  }

  return (
    <Screen scroll>
      <AppHeader title={t('family')} subtitle={t('familySubtitle')} />
      <AppInput label={t('groupName')} value={name} onChangeText={setName} />
      <AppButton label={t('createGroup')} onPress={() => void create()} />
      {query.data?.map((group) => (
        <AppCard key={group.id as string}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>{group.name as string}</Text>
        </AppCard>
      ))}
    </Screen>
  );
}
