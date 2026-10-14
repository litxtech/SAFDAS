import { FlatList, Pressable, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Screen } from '@/components/layout/Screen';
import { AppAvatar } from '@/components/ui/AppAvatar';
import { AppEmptyState } from '@/components/ui/AppEmptyState';
import { AppHeader } from '@/components/ui/AppHeader';
import { useT } from '@/i18n';
import { requireSupabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/theme/ThemeProvider';

type Row = {
  id: string;
  title: string;
  preview: string;
  at: string | null;
  unread: number;
};

export default function MessagesScreen() {
  const { colors } = useTheme();
  const t = useT();
  const userId = useAuthStore((state) => state.session?.user.id);
  const query = useQuery({
    queryKey: ['conversations', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<Row[]> => {
      const client = requireSupabase();
      const { data: members, error } = await client.from('conversation_members').select('conversation_id, last_read_at').eq('user_id', userId);
      if (error) throw error;
      const ids = (members ?? []).map((member) => member.conversation_id as string);
      if (!ids.length) return [];
      const { data: messages, error: messageError } = await client
        .from('messages')
        .select('conversation_id, body, created_at, sender_id')
        .in('conversation_id', ids)
        .order('created_at', { ascending: false })
        .limit(100);
      if (messageError) throw messageError;
      return ids.map((id) => {
        const latest = (messages ?? []).find((message) => message.conversation_id === id);
        const readAt = members?.find((member) => member.conversation_id === id)?.last_read_at;
        const unread = (messages ?? []).filter((message) => message.conversation_id === id && message.sender_id !== userId && (!readAt || message.created_at > readAt)).length;
        return {
          id,
          title: 'Sohbet',
          preview: (latest?.body as string | null) ?? 'Medya',
          at: (latest?.created_at as string | null) ?? null,
          unread,
        };
      });
    },
  });

  return (
    <Screen padded={false} tabBar>
      <FlatList
        data={query.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 8 }}
        ListHeaderComponent={<AppHeader title={t('messages')} />}
        ListEmptyComponent={<AppEmptyState icon="chatbubbles-outline" title={t('emptyChatsTitle')} body={t('emptyChatsBody')} />}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push({ pathname: '/chat/[id]', params: { id: item.id } })} style={{ flexDirection: 'row', gap: 12, paddingVertical: 10, alignItems: 'center' }}>
            <AppAvatar name={item.title} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{item.title}</Text>
              <Text style={{ color: colors.textSecondary }} numberOfLines={1}>{item.preview}</Text>
            </View>
            {item.unread > 0 ? (
              <View style={{ backgroundColor: colors.primary, borderRadius: 99, minWidth: 22, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ color: colors.onPrimary, fontWeight: '700', textAlign: 'center' }}>{item.unread}</Text>
              </View>
            ) : null}
          </Pressable>
        )}
      />
    </Screen>
  );
}
