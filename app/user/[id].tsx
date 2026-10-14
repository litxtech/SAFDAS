import { Text } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/layout/Screen';
import { AppAvatar } from '@/components/ui/AppAvatar';
import { AppButton } from '@/components/ui/AppButton';
import { useT } from '@/i18n';
import { requireSupabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { useTheme } from '@/theme/ThemeProvider';

export default function UserScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const t = useT();
  const me = useAuthStore((state) => state.session?.user.id);
  const show = useToastStore((state) => state.show);
  const client = useQueryClient();
  const profile = useQuery({
    queryKey: ['user', id],
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('profiles').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const follow = useQuery({
    queryKey: ['follow', me, id],
    enabled: Boolean(me && id),
    queryFn: async () => {
      const { data } = await requireSupabase().from('follows').select('status').eq('follower_id', me).eq('following_id', id).maybeSingle();
      return data?.status as string | undefined;
    },
  });

  async function toggleFollow() {
    if (!me || !id) return;
    if (follow.data) {
      await requireSupabase().from('follows').delete().eq('follower_id', me).eq('following_id', id);
    } else {
      const status = profile.data?.is_private ? 'pending' : 'accepted';
      const { error } = await requireSupabase().from('follows').insert({ follower_id: me, following_id: id, status });
      if (error) show(error.message, 'error');
    }
    void client.invalidateQueries({ queryKey: ['follow', me, id] });
  }

  async function message() {
    if (!me || !id) return;
    const { data, error } = await requireSupabase().rpc('get_or_create_direct_conversation', { other_user: id });
    if (error || !data) show(error?.message ?? t('chatFailed'), 'error');
    else router.push({ pathname: '/chat/[id]', params: { id: data as string } });
  }

  return (
    <Screen scroll>
      <AppAvatar uri={profile.data?.avatar_url as string | null} name={profile.data?.display_name as string | null} size={84} />
      <Text style={{ color: colors.text, fontSize: 28, fontWeight: '700' }}>{profile.data?.display_name as string}</Text>
      <Text style={{ color: colors.textSecondary }}>@{profile.data?.username as string}</Text>
      <Text style={{ color: colors.text }}>{profile.data?.bio as string}</Text>
      <AppButton label={follow.data === 'pending' ? t('followRequested') : follow.data ? t('unfollow') : t('follow')} onPress={() => void toggleFollow()} />
      <AppButton label={t('sendMessage')} variant="secondary" onPress={() => void message()} />
      <AppButton label={t('reportAction')} variant="ghost" onPress={() => router.push({ pathname: '/report/create', params: { targetType: 'profile', targetId: id } })} />
      <AppButton
        label={t('block')}
        variant="ghost"
        onPress={() => {
          if (!me || !id) return;
          void requireSupabase().rpc('block_user', { other_user: id }).then(({ error }) => show(error ? error.message : t('userBlocked'), error ? 'error' : 'success'));
        }}
      />
    </Screen>
  );
}
