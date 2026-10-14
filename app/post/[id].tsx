import { useState } from 'react';
import { Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/layout/Screen';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { useT } from '@/i18n';
import { requireSupabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/theme/ThemeProvider';

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const t = useT();
  const userId = useAuthStore((state) => state.session?.user.id);
  const client = useQueryClient();
  const [text, setText] = useState('');
  const query = useQuery({
    queryKey: ['comments', id],
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('comments').select('id, body, created_at, profiles(username)').eq('post_id', id).is('deleted_at', null).order('created_at');
      if (error) throw error;
      return data ?? [];
    },
  });

  async function send() {
    if (!userId || !text.trim() || !id) return;
    const { error } = await requireSupabase().from('comments').insert({ post_id: id, author_id: userId, body: text.trim() });
    if (!error) {
      setText('');
      void client.invalidateQueries({ queryKey: ['comments', id] });
    }
  }

  return (
    <Screen scroll>
      <Text style={{ color: colors.text, fontSize: 28, fontWeight: '700' }}>{t('commentsTitle')}</Text>
      {query.data?.map((comment) => {
        const profile = comment.profiles as { username?: string } | { username?: string }[] | null;
        const username = Array.isArray(profile) ? profile[0]?.username : profile?.username;
        return (
          <View key={comment.id as string} style={{ gap: 4 }}>
            <Text style={{ color: colors.primary, fontWeight: '700' }}>@{username ?? t('userFallback')}</Text>
            <Text style={{ color: colors.text }}>{comment.body as string}</Text>
          </View>
        );
      })}
      <AppInput label={t('comment')} value={text} onChangeText={setText} />
      <AppButton label={t('send')} onPress={() => void send()} />
    </Screen>
  );
}
