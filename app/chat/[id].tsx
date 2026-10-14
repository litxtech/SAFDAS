import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/layout/Screen';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { useT } from '@/i18n';
import { requireSupabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/theme/ThemeProvider';

type Message = { id: string; body: string | null; sender_id: string; created_at: string };

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const t = useT();
  const userId = useAuthStore((state) => state.session?.user.id);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    if (!id) return;
    const client = requireSupabase();
    void client.from('messages').select('id, body, sender_id, created_at').eq('conversation_id', id).order('created_at').then(({ data }) => {
      setMessages((data as Message[] | null) ?? []);
    });
    void client.from('conversation_members').update({ last_read_at: new Date().toISOString() }).eq('conversation_id', id).eq('user_id', userId);
    const channel = client
      .channel(`chat:${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` }, (payload) => {
        setMessages((current) => [...current, payload.new as Message]);
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.userId !== userId) setTyping(true);
      })
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [id, userId]);

  async function send() {
    if (!userId || !id || !text.trim()) return;
    const body = text.trim();
    setText('');
    await requireSupabase().from('messages').insert({ conversation_id: id, sender_id: userId, body });
  }

  return (
    <Screen>
      <View style={{ flex: 1, gap: 8 }}>
        {messages.map((message) => {
          const mine = message.sender_id === userId;
          return (
            <View key={message.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', backgroundColor: mine ? colors.outgoingBubble : colors.incomingBubble, borderRadius: 18, padding: 12, maxWidth: '80%' }}>
              <Text style={{ color: mine ? colors.onPrimary : colors.text }}>{message.body}</Text>
            </View>
          );
        })}
        {typing ? <Text style={{ color: colors.textSecondary }}>{t('typing')}</Text> : null}
      </View>
      <AppInput
        label={t('messageLabel')}
        value={text}
        onChangeText={(value) => {
          setText(value);
          void requireSupabase().channel(`chat:${id}`).send({ type: 'broadcast', event: 'typing', payload: { userId } });
        }}
      />
      <AppButton label={t('send')} onPress={() => void send()} />
    </Screen>
  );
}
