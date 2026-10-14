import { Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Redirect } from 'expo-router';
import { Screen } from '@/components/layout/Screen';
import { AppCard } from '@/components/ui/AppCard';
import { AppHeader } from '@/components/ui/AppHeader';
import { useT } from '@/i18n';
import { requireSupabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/theme/ThemeProvider';

export default function AdminPostsScreen() {
  const isStaff = useAuthStore((state) => state.isStaff);
  const { colors } = useTheme();
  const t = useT();
  const query = useQuery({
    queryKey: ['admin-posts'],
    enabled: isStaff,
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('posts').select('id, body, created_at').order('created_at', { ascending: false }).limit(40);
      if (error) throw error;
      return data ?? [];
    },
  });
  if (!isStaff) return <Redirect href="/(tabs)" />;
  return (
    <Screen scroll>
      <AppHeader title={t('posts')} subtitle={t('postsModerationHint')} />
      {query.data?.map((post) => (
        <AppCard key={post.id as string}>
          <Text style={{ color: colors.text }}>{(post.body as string) || t('mediaPost')}</Text>
          <Text style={{ color: colors.textSecondary, marginTop: 6 }}>{new Date(post.created_at as string).toLocaleString('tr-TR')}</Text>
        </AppCard>
      ))}
    </Screen>
  );
}
