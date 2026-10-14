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

export default function AdminRolesScreen() {
  const t = useT();
  const isStaff = useAuthStore((state) => state.isStaff);
  const { colors } = useTheme();
  const query = useQuery({
    queryKey: ['admin-roles'],
    enabled: isStaff,
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('roles').select('id, name').order('name');
      if (error) throw error;
      return data ?? [];
    },
  });
  if (!isStaff) return <Redirect href="/(tabs)" />;
  return (
    <Screen scroll>
      <AppHeader title={t('rolesTitle')} subtitle={t('rolesSubtitle')} />
      {query.data?.map((role) => (
        <AppCard key={role.id as string}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>{role.name as string}</Text>
        </AppCard>
      ))}
    </Screen>
  );
}
