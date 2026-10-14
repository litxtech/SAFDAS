import { Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Redirect, router } from 'expo-router';
import { Pressable } from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { AppHeader } from '@/components/ui/AppHeader';
import { useT } from '@/i18n';
import { requireSupabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/theme/ThemeProvider';

export default function AdminUsersScreen() {
  const t = useT();
  const isStaff = useAuthStore((state) => state.isStaff);
  const { colors } = useTheme();
  const query = useQuery({
    queryKey: ['admin-users'],
    enabled: isStaff,
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('profiles').select('id, username, display_name, created_at').order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
  if (!isStaff) return <Redirect href="/(tabs)" />;
  return (
    <Screen scroll>
      <AppHeader title={t('navUsers')} subtitle={t('usersSubtitle')} />
      {query.data?.map((user) => (
        <Pressable key={user.id as string} onPress={() => router.push({ pathname: '/user/[id]', params: { id: user.id as string } })}>
          <Text style={{ color: colors.text, paddingVertical: 10 }}>{user.display_name as string} · @{user.username as string}</Text>
        </Pressable>
      ))}
    </Screen>
  );
}
