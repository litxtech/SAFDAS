import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { create } from 'zustand';
import { translate, useI18nStore } from '@/i18n';
import { queryClient } from '@/lib/queryClient';
import { ensureNotificationPermission } from '@/services/prayer/notifications';
import { unreadInboxTotal, type InboxRow } from '@/services/social';
import { useAuthStore } from '@/stores/authStore';

export type LiveMessage = {
  id: string;
  conversation_id: string;
  body: string | null;
  sender_id: string;
  created_at: string;
  reply_to: string | null;
  media_url: string | null;
  media_type: string | null;
  deleted_at: string | null;
  edited_at?: string | null;
  duration_ms?: number | null;
  pinned_at?: string | null;
};

export type ChatMessage = Omit<LiveMessage, 'conversation_id'> & {
  pending?: boolean;
  failed?: boolean;
  /** 0–1 while a local media file is uploading. */
  uploadProgress?: number;
};

type ReadListener = (conversationId: string, lastReadAt: string | null) => void;
type MessageListener = (message: LiveMessage) => void;

type ChatLiveState = {
  activeId: string | null;
  online: string[];
  ready: boolean;
  setActiveId: (id: string | null) => void;
  setOnline: (ids: string[]) => void;
  setReady: (ready: boolean) => void;
};

const messageListeners = new Set<MessageListener>();
const readListeners = new Set<ReadListener>();
const seen = new Set<string>();
let channelReady: Promise<void> | null = null;
let lastInboxInvalidate = 0;
const INBOX_INVALIDATE_MIN_MS = 8_000;

function softInvalidateInbox(id: string) {
  const now = Date.now();
  if (now - lastInboxInvalidate < INBOX_INVALIDATE_MIN_MS) return;
  lastInboxInvalidate = now;
  void queryClient.invalidateQueries({ queryKey: ['conversations', id] });
  void queryClient.invalidateQueries({ queryKey: ['unread-count', id] });
}

export const useChatLiveStore = create<ChatLiveState>((set) => ({
  activeId: null,
  online: [],
  ready: false,
  setActiveId: (activeId) => set({ activeId }),
  setOnline: (online) => set({ online }),
  setReady: (ready) => set({ ready }),
}));

export function subscribeLiveMessages(listener: MessageListener) {
  messageListeners.add(listener);
  return () => messageListeners.delete(listener);
}

export function subscribeReadReceipts(listener: ReadListener) {
  readListeners.add(listener);
  return () => readListeners.delete(listener);
}

export function emitReadReceipt(conversationId: string, lastReadAt: string | null) {
  readListeners.forEach((listener) => listener(conversationId, lastReadAt));
}

export function asLiveMessage(row: Record<string, unknown>): LiveMessage | null {
  if (typeof row.id !== 'string' || typeof row.conversation_id !== 'string' || typeof row.sender_id !== 'string') return null;
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    body: typeof row.body === 'string' ? row.body : null,
    sender_id: row.sender_id,
    created_at: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
    reply_to: typeof row.reply_to === 'string' ? row.reply_to : null,
    media_url: typeof row.media_url === 'string' ? row.media_url : null,
    media_type: typeof row.media_type === 'string' ? row.media_type : null,
    deleted_at: typeof row.deleted_at === 'string' ? row.deleted_at : null,
    edited_at: typeof row.edited_at === 'string' ? row.edited_at : null,
    duration_ms: typeof row.duration_ms === 'number' ? row.duration_ms : null,
    pinned_at: typeof row.pinned_at === 'string' ? row.pinned_at : null,
  };
}

function userId() {
  return useAuthStore.getState().session?.user.id ?? null;
}

function inboxKey() {
  const id = userId();
  return id ? (['conversations', id] as const) : null;
}

function placeRow(rest: InboxRow[], row: InboxRow) {
  const pinned = rest.filter((item) => item.pinned);
  const normal = rest.filter((item) => !item.pinned);
  return row.pinned ? [row, ...pinned, ...normal] : [...pinned, row, ...normal];
}

function writeInbox(rows: InboxRow[]) {
  const key = inboxKey();
  const id = userId();
  if (!key || !id) return;
  const total = unreadInboxTotal(rows);
  queryClient.setQueryData(key, rows);
  queryClient.setQueryData(['unread-count', id], total);
  void Notifications.setBadgeCountAsync(total).catch(() => undefined);
}

export function markConversationRead(conversationId: string) {
  const key = inboxKey();
  if (!key) return;
  const rows = queryClient.getQueryData<InboxRow[]>(key);
  if (!rows) return;
  writeInbox(rows.map((row) => (row.id === conversationId ? { ...row, unread: 0 } : row)));
}

export function patchConversation(conversationId: string, patch: Partial<Pick<InboxRow, 'pinned' | 'archived' | 'unread' | 'muted'>>) {
  const key = inboxKey();
  if (!key) return;
  const rows = queryClient.getQueryData<InboxRow[]>(key);
  if (!rows) return;
  const current = rows.find((row) => row.id === conversationId);
  if (!current) return;
  const next = { ...current, ...patch };
  writeInbox(placeRow(rows.filter((row) => row.id !== conversationId), next));
}

export function removeConversation(conversationId: string) {
  const key = inboxKey();
  if (!key) return;
  const rows = queryClient.getQueryData<InboxRow[]>(key);
  if (!rows) return;
  writeInbox(rows.filter((row) => row.id !== conversationId));
}

export function bumpConversation(conversationId: string, preview: string, at: string, media: boolean) {
  const key = inboxKey();
  if (!key) return;
  const rows = queryClient.getQueryData<InboxRow[]>(key);
  if (!rows) return;
  const current = rows.find((row) => row.id === conversationId);
  if (!current) return;
  const next: InboxRow = { ...current, preview, at, media, mine: true, unread: 0 };
  writeInbox(placeRow(rows.filter((row) => row.id !== conversationId), next));
}

function applyPreview(message: LiveMessage, increment: boolean) {
  const id = userId();
  const key = inboxKey();
  if (!id || !key) return '';
  const rows = queryClient.getQueryData<InboxRow[]>(key);
  if (!rows) {
    softInvalidateInbox(id);
    return '';
  }
  const current = rows.find((row) => row.id === message.conversation_id);
  if (!current) {
    softInvalidateInbox(id);
    return '';
  }
  const mine = message.sender_id === id;
  const viewing = useChatLiveStore.getState().activeId === message.conversation_id && AppState.currentState === 'active';
  const newer = !current.at || message.created_at >= current.at;
  const body = message.deleted_at ? '' : (message.body ?? '').trim();
  const next: InboxRow = {
    ...current,
    preview: newer ? body : current.preview,
    media: newer ? !body && Boolean(message.media_url) && !message.deleted_at : current.media,
    at: newer ? message.created_at : current.at,
    mine: newer ? mine : current.mine,
    archived: mine ? current.archived : false,
    unread: viewing || message.deleted_at ? (viewing ? 0 : current.unread) : mine ? current.unread : current.unread + (increment ? 1 : 0),
  };
  writeInbox(placeRow(rows.filter((row) => row.id !== message.conversation_id), next));
  return current.title;
}

export function publishLiveMessage(message: LiveMessage, notify: boolean) {
  if (seen.has(message.id)) {
    messageListeners.forEach((listener) => listener(message));
    return;
  }
  seen.add(message.id);
  if (seen.size > 500) {
    const extra = [...seen].slice(0, 200);
    extra.forEach((id) => seen.delete(id));
  }
  messageListeners.forEach((listener) => listener(message));
  const title = applyPreview(message, true);
  if (!notify || message.deleted_at) return;
  const id = userId();
  if (!id || message.sender_id === id) return;
  const viewing = useChatLiveStore.getState().activeId === message.conversation_id && AppState.currentState === 'active';
  if (viewing) return;
  const key = inboxKey();
  const rows = key ? queryClient.getQueryData<InboxRow[]>(key) : null;
  const muted = rows?.find((row) => row.id === message.conversation_id)?.muted;
  if (muted) return;
  void presentMessageNotification(title, message);
}

export function publishMessageUpdate(message: LiveMessage) {
  messageListeners.forEach((listener) => listener(message));
  applyPreview(message, false);
}

async function prepareMessageChannel() {
  if (channelReady) return channelReady;
  channelReady = (async () => {
    if (Platform.OS !== 'android') return;
    await Notifications.setNotificationChannelAsync('messages', {
      name: 'Mesajlar',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 180, 80, 180],
      sound: 'default',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      enableVibrate: true,
    });
  })();
  return channelReady;
}

async function presentMessageNotification(title: string, message: LiveMessage) {
  try {
    await prepareMessageChannel();
    const granted = await ensureNotificationPermission();
    if (!granted) return;
    const locale = useI18nStore.getState().locale;
    const body = message.body?.trim()
      || (message.media_url ? translate(locale, 'photoMessage') : translate(locale, 'newMessage'));
    await Notifications.scheduleNotificationAsync({
      identifier: `msg-${message.id}`,
      content: {
        title: title || translate(locale, 'newMessage'),
        body,
        sound: 'default',
        data: { kind: 'message', conversationId: message.conversation_id },
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      trigger: Platform.OS === 'android' ? { channelId: 'messages' } : null,
    });
  } catch {
    // Messaging still updates in the open chat if a notification cannot be posted.
  }
}

export function acceptServerMessage(list: ChatMessage[], server: ChatMessage, localId?: string): ChatMessage[] {
  const withoutLocal = localId ? list.filter((item) => item.id !== localId) : list;
  const index = withoutLocal.findIndex((item) => item.id === server.id);
  if (index >= 0) {
    const next = withoutLocal.slice();
    next[index] = { ...withoutLocal[index], ...server, pending: false, failed: false, uploadProgress: undefined };
    return sortMessages(next);
  }
  const pendingIndex = withoutLocal.findIndex((item) => {
    if (!item.pending || item.sender_id !== server.sender_id || item.body !== server.body) return false;
    if (item.media_url === server.media_url) return true;
    const localMedia = Boolean(item.media_url && /^(file|content|ph|assets-library):/.test(item.media_url));
    return localMedia && Boolean(server.media_url);
  });
  if (pendingIndex >= 0) {
    const next = withoutLocal.slice();
    next[pendingIndex] = { ...server, pending: false, failed: false, uploadProgress: undefined };
    return sortMessages(next);
  }
  return sortMessages([...withoutLocal, server]);
}

export function sortMessages(list: ChatMessage[]) {
  return [...list].sort((a, b) => {
    if (Boolean(a.pending) !== Boolean(b.pending)) return a.pending ? 1 : -1;
    return a.created_at.localeCompare(b.created_at);
  });
}
