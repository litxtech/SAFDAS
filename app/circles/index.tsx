import { FlatList, Pressable, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Screen } from '@/components/layout/Screen';
import { AppButton } from '@/components/ui/AppButton';
import { AppEmptyState } from '@/components/ui/AppEmptyState';
import { AppHeader } from '@/components/ui/AppHeader';
import { useT } from '@/i18n';
import { requireSupabase } from '@/lib/supabase';
import { useTheme } from '@/theme/ThemeProvider';

export default function CirclesScreen() {
  const { colors } = useTheme();
  const t = useT();
  const query = useQuery({
    queryKey: ['circles'],
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('circles').select('id, name, description, cover_url, member_count').eq('visibility', 'public').order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <Screen padded={false}>
      <FlatList
        data={query.data ?? []}
        keyExtractor={(item) => item.id as string}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            <AppHeader title={t('circles')} />
            <AppButton label={t('createCircle')} onPress={() => router.push('/circles/create')} />
          </View>
        }
        ListEmptyComponent={<AppEmptyState icon="people-outline" title={t('noCircleTitle')} body={t('noCircleBody')} />}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push({ pathname: '/circles/[id]', params: { id: item.id as string } })} style={{ borderRadius: 20, overflow: 'hidden', backgroundColor: colors.surface }}>
            {item.cover_url ? <Image source={{ uri: item.cover_url as string }} style={{ height: 140 }} contentFit="cover" /> : <View style={{ height: 90, backgroundColor: colors.primaryDark }} />}
            <View style={{ padding: 14 }}>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 18 }}>{item.name as string}</Text>
              <Text style={{ color: colors.textSecondary }} numberOfLines={2}>{item.description as string}</Text>
              <Text style={{ color: colors.primary, marginTop: 6 }}>{t('memberCount', { count: item.member_count as number })}</Text>
            </View>
          </Pressable>
        )}
      />
    </Screen>
  );
}
