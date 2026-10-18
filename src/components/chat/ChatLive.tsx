import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { queryClient } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import { asLiveMessage, emitReadReceipt, publishLiveMessage, publishMessageUpdate, useChatLiveStore } from '@/services/chatLive';
import { useAuthStore } from '@/stores/authStore';

const INVALIDATE_MIN_MS = 12_000;

export function ChatLive() {
  const userId = useAuthStore((state) => state.session?.user.id);
  const lastInvalidate = useRef(0);

  useEffect(() => {
    const client = supabase;
    if (!client || !userId) return;

    const softInvalidate = () => {
      const now = Date.now();
      if (now - lastInvalidate.current < INVALIDATE_MIN_MS) return;
      lastInvalidate.current = now;
      void queryClient.invalidateQueries({ queryKey: ['conversations', userId] });
      void queryClient.invalidateQueries({ queryKey: ['unread-count', userId] });
    };

    const messages = client
      .channel(`safdas-messages:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const message = asLiveMessage(payload.new as Record<string, unknown>);
        if (message) publishLiveMessage(message, true);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
        const message = asLiveMessage(payload.new as Record<string, unknown>);
        if (message) publishMessageUpdate(message);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversation_members' }, (payload) => {
        const row = payload.new as { conversation_id?: string; user_id?: string; last_read_at?: string | null };
        if (!row.conversation_id || !row.user_id || row.user_id === userId) return;
        emitReadReceipt(row.conversation_id, row.last_read_at ?? null);
      })
      .subscribe((status) => {
        // Avoid refetch storm on every reconnect — inbox already hydrates from cache/query.
        if (status === 'SUBSCRIBED') softInvalidate();
      });

    const presence = client.channel('safdas-online', { config: { presence: { key: userId } } });
    presence.on('presence', { event: 'sync' }, () => {
      useChatLiveStore.getState().setOnline(Object.keys(presence.presenceState()));
      useChatLiveStore.getState().setReady(true);
    });
    void presence.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') await presence.track({ at: Date.now() });
    });

    const app = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      softInvalidate();
    });

    return () => {
      app.remove();
      void client.removeChannel(messages);
      void client.removeChannel(presence);
      useChatLiveStore.getState().setOnline([]);
      useChatLiveStore.getState().setReady(false);
    };
  }, [userId]);

  return null;
}
