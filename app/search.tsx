import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/layout/Screen';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppSearchBar } from '@/components/ui/AppSearchBar';
import { useT } from '@/i18n';
import { requireSupabase } from '@/lib/supabase';
import { useTheme } from '@/theme/ThemeProvider';

type Hit = { id: string; label: string; href: '/user/[id]' | '/circles/[id]' };

export default function SearchScreen() {
  const t = useT();
  const { colors } = useTheme();
  const [value, setValue] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);

  async function search(text: string) {
    setValue(text);
    if (text.trim().length < 2) {
      setHits([]);
      return;
    }
    const client = requireSupabase();
    const [users, circles] = await Promise.all([
      client.from('profiles').select('id, username, display_name').ilike('username', `%${text}%`).limit(10),
      client.from('circles').select('id, name').ilike('name', `%${text}%`).eq('visibility', 'public').limit(10),
    ]);
    setHits([
      ...(users.data ?? []).map((user) => ({ id: user.id as string, label: `@${user.username as string}`, href: '/user/[id]' as const })),
      ...(circles.data ?? []).map((circle) => ({ id: circle.id as string, label: circle.name as string, href: '/circles/[id]' as const })),
    ]);
  }

  return (
    <Screen scroll>
      <AppHeader title={t('search')} subtitle={t('searchSubtitle')} />
      <AppSearchBar value={value} onChangeText={(text) => void search(text)} placeholder={t('search')} />
      {hits.map((hit) => (
        <Pressable key={`${hit.href}${hit.id}`} onPress={() => router.push({ pathname: hit.href, params: { id: hit.id } })}>
          <Text style={{ color: colors.text, paddingVertical: 10 }}>{hit.label}</Text>
        </Pressable>
      ))}
    </Screen>
  );
}
