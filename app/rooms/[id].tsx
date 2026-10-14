import { useEffect, useState } from 'react';
import { AppState, Linking, Share, Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { requestRecordingPermissionsAsync } from 'expo-audio';
import { Screen } from '@/components/layout/Screen';
import { AppAvatar } from '@/components/ui/AppAvatar';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppHeader } from '@/components/ui/AppHeader';
import { useT } from '@/i18n';
import { requireSupabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { useTheme } from '@/theme/ThemeProvider';

type Member = { user_id: string; role: string; mic: string; display_name: string | null };

export default function RoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const t = useT();
  const userId = useAuthStore((state) => state.session?.user.id);
  const profile = useAuthStore((state) => state.profile);
  const show = useToastStore((state) => state.show);
  const [title, setTitle] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [voice, setVoice] = useState('');

  useEffect(() => {
    if (!id || !userId) return;
    const client = requireSupabase();
    void client.from('live_rooms').select('title, host_id').eq('id', id).maybeSingle().then(({ data }) => {
      if (data?.title) setTitle(data.title as string);
    });
    void client.from('live_room_members').upsert({ room_id: id, user_id: userId, role: 'listener', mic: 'off' });
    const load = async () => {
      const { data } = await client.from('live_room_members').select('user_id, role, mic, profiles(display_name)').eq('room_id', id);
      setMembers(
        (data ?? []).map((row) => {
          const profiles = row.profiles as { display_name?: string } | { display_name?: string }[] | null;
          const name = Array.isArray(profiles) ? profiles[0]?.display_name : profiles?.display_name;
          return { user_id: row.user_id as string, role: row.role as string, mic: row.mic as string, display_name: name ?? null };
        }),
      );
    };
    void load();
    const channel = client
      .channel(`room:${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_room_members', filter: `room_id=eq.${id}` }, () => {
        void load();
      })
      .subscribe();
    void refreshToken();
    return () => {
      void client.removeChannel(channel);
    };
  }, [id, userId, t]);

  async function refreshToken(attempt = 0) {
    if (!id) return;
    const { data, error } = await requireSupabase().functions.invoke('livekit-token', { body: { roomId: id } });
    if (error || !data) {
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        await refreshToken(attempt + 1);
        return;
      }
      setVoice(t('voiceFailed'));
      return;
    }
    setVoice(t('voiceReady'));
  }

  async function requestMic() {
    if (!id || !userId) return;
    if (AppState.currentState !== 'active') {
      show(t('micForegroundOnly'), 'error');
      return;
    }
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      show(t('micPermissionDenied'), 'error');
      await Linking.openSettings();
      return;
    }
    await requireSupabase().from('live_room_members').update({ mic: 'requested' }).eq('room_id', id).eq('user_id', userId);
    show(t('micNotOpened'), 'success');
  }

  async function leave() {
    if (!id || !userId) return;
    await requireSupabase().from('live_room_members').delete().eq('room_id', id).eq('user_id', userId);
    router.back();
  }

  return (
    <Screen scroll>
      <AppHeader title={title || t('rooms')} subtitle={profile?.display_name ?? ''} />
      <AppCard>
        <Text style={{ color: colors.textSecondary }}>{voice || t('voiceWaiting')}</Text>
        <Text style={{ color: colors.textSecondary }}>{t('micNotOpened')}</Text>
      </AppCard>
      <Text style={{ color: colors.text, fontWeight: '700' }}>{t('participants')}</Text>
      {members.map((member) => (
        <View key={member.user_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <AppAvatar name={member.display_name} speaking={member.mic === 'on'} />
          <View>
            <Text style={{ color: colors.text }}>{member.display_name ?? t('member')}</Text>
            <Text style={{ color: colors.textSecondary }}>{t('micState', { role: member.role, state: member.mic === 'off' ? t('micClosed') : member.mic })}</Text>
          </View>
        </View>
      ))}
      <AppButton label={t('requestMic')} onPress={() => void requestMic()} />
      <AppButton label={t('voiceRetry')} variant="secondary" onPress={() => void refreshToken()} />
      <AppButton label={t('shareRoom')} variant="secondary" onPress={() => void Share.share({ message: t('liveRoomShare', { title: title || t('rooms') }) })} />
      <AppButton label={t('reportAction')} variant="ghost" onPress={() => router.push({ pathname: '/report/create', params: { targetType: 'live_room', targetId: id } })} />
      <AppButton label={t('leaveRoom')} variant="secondary" onPress={() => void leave()} />
    </Screen>
  );
}
