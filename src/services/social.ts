import { queryClient } from '@/lib/queryClient';
import { requireSupabase } from '@/lib/supabase';

export type Person = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  verified: boolean;
  bio: string | null;
  following: boolean;
};

export type InboxRow = {
  id: string;
  title: string;
  username: string | null;
  avatar: string | null;
  peerId: string | null;
  preview: string;
  media: boolean;
  mine: boolean;
  at: string | null;
  unread: number;
  pinned: boolean;
  archived: boolean;
  muted: boolean;
  isGroup: boolean;
};

type MembershipRow = {
  conversation_id: string;
  last_read_at: string | null;
  pinned_at: string | null;
  archived_at: string | null;
  muted_until: string | null;
  marked_unread: boolean;
};

type MessagePreview = {
  conversation_id: string;
  body: string | null;
  created_at: string;
  sender_id: string;
  deleted_at: string | null;
  media_url: string | null;
};

async function loadMembership(userId: string): Promise<MembershipRow[]> {
  const client = requireSupabase();
  const membership = await client
    .from('conversation_members')
    .select('conversation_id, last_read_at, pinned_at, archived_at, muted_until, marked_unread')
    .eq('user_id', userId);
  if (!membership.error) {
    return (membership.data ?? []).map((row) => ({
      conversation_id: row.conversation_id as string,
      last_read_at: (row.last_read_at as string | null) ?? null,
      pinned_at: (row.pinned_at as string | null) ?? null,
      archived_at: (row.archived_at as string | null) ?? null,
      muted_until: (row.muted_until as string | null) ?? null,
      marked_unread: Boolean(row.marked_unread),
    }));
  }
  if (!/pinned_at|archived_at|muted_until|marked_unread/.test(membership.error.message)) {
    throw membership.error;
  }
  const basic = await client.from('conversation_members').select('conversation_id, last_read_at, pinned_at, archived_at').eq('user_id', userId);
  if (!basic.error) {
    return (basic.data ?? []).map((row) => ({
      conversation_id: row.conversation_id as string,
      last_read_at: (row.last_read_at as string | null) ?? null,
      pinned_at: (row.pinned_at as string | null) ?? null,
      archived_at: (row.archived_at as string | null) ?? null,
      muted_until: null,
      marked_unread: false,
    }));
  }
  const legacy = await client.from('conversation_members').select('conversation_id, last_read_at').eq('user_id', userId);
  if (legacy.error) throw legacy.error;
  return (legacy.data ?? []).map((row) => ({
    conversation_id: row.conversation_id as string,
    last_read_at: (row.last_read_at as string | null) ?? null,
    pinned_at: null,
    archived_at: null,
    muted_until: null,
    marked_unread: false,
  }));
}

async function loadMessagePreviews(ids: string[]): Promise<MessagePreview[]> {
  const client = requireSupabase();
  // Enough recent rows to cover latest + unread badges for typical inboxes.
  const limit = Math.min(800, Math.max(120, ids.length * 8));
  const rich = await client
    .from('messages')
    .select('conversation_id, body, created_at, sender_id, deleted_at, media_url')
    .in('conversation_id', ids)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (!rich.error) {
    return (rich.data ?? []).map((row) => ({
      conversation_id: row.conversation_id as string,
      body: (row.body as string | null) ?? null,
      created_at: row.created_at as string,
      sender_id: row.sender_id as string,
      deleted_at: (row.deleted_at as string | null) ?? null,
      media_url: (row.media_url as string | null) ?? null,
    }));
  }
  if (!/deleted_at|media_url/.test(rich.error.message)) throw rich.error;
  const basic = await client
    .from('messages')
    .select('conversation_id, body, created_at, sender_id')
    .in('conversation_id', ids)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (basic.error) throw basic.error;
  return (basic.data ?? []).map((row) => ({
    conversation_id: row.conversation_id as string,
    body: (row.body as string | null) ?? null,
    created_at: row.created_at as string,
    sender_id: row.sender_id as string,
    deleted_at: null,
    media_url: null,
  }));
}

function cleanTerm(value: string) {
  return value.replace(/[%_,.()]/g, ' ').trim();
}

export async function searchPeople(term: string, offset = 0): Promise<Person[]> {
  const query = cleanTerm(term);
  if (query.length < 2) return [];
  const client = requireSupabase();
  const me = (await client.auth.getUser()).data.user?.id;
  let result = await client
    .from('profiles')
    .select('id, username, display_name, avatar_url, verified, bio')
    .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
    .is('disabled_at', null)
    .order('username')
    .range(offset, offset + 19);
  if (result.error && /disabled_at/.test(result.error.message)) {
    result = await client
      .from('profiles')
      .select('id, username, display_name, avatar_url, verified, bio')
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
      .order('username')
      .range(offset, offset + 19);
  }
  const { data, error } = result;
  if (error) throw error;
  const { getBlockedUserIds } = await import('@/services/safety');
  const blocked = await getBlockedUserIds().catch(() => new Set<string>());
  const ids = (data ?? []).map((row) => row.id as string).filter((id) => !blocked.has(id));
  let followed = new Set<string>();
  if (me && ids.length) {
    const { data: follows } = await client.from('follows').select('following_id').eq('follower_id', me).in('following_id', ids);
    followed = new Set((follows ?? []).map((row) => row.following_id as string));
  }
  return (data ?? [])
    .filter((row) => row.id !== me && !blocked.has(row.id as string))
    .map((row) => ({
      id: row.id as string,
      username: (row.username as string | null) ?? null,
      display_name: (row.display_name as string | null) ?? null,
      avatar_url: (row.avatar_url as string | null) ?? null,
      verified: Boolean(row.verified),
      bio: (row.bio as string | null) ?? null,
      following: followed.has(row.id as string),
    }));
}

export async function openDirectChat(otherUserId: string) {
  const client = requireSupabase();
  const { data, error } = await client.rpc('get_or_create_direct_conversation', { other_user: otherUserId });
  if (error || !data) throw error ?? new Error('chat');
  return data as string;
}

export async function fetchInbox(userId: string): Promise<InboxRow[]> {
  const client = requireSupabase();
  const blockedPromise = import('@/services/safety')
    .then(({ getBlockedUserIds }) => getBlockedUserIds())
    .catch(() => new Set<string>());

  const mine = await loadMembership(userId);
  const ids = mine.map((row) => row.conversation_id);
  if (!ids.length) return [];

  const mineById = new Map(mine.map((row) => [row.conversation_id, row]));

  // Membership already resolved — load conversation metadata, peers, and previews together.
  const [conversationsResult, membersResult, messages, blockedIds] = await Promise.all([
    client.from('conversations').select('id, is_group, title, avatar_url').in('id', ids),
    client.from('conversation_members').select('conversation_id, user_id').in('conversation_id', ids),
    loadMessagePreviews(ids),
    blockedPromise,
  ]);
  if (conversationsResult.error) throw conversationsResult.error;
  if (membersResult.error) throw membersResult.error;

  const peerByConversation = new Map<string, string>();
  const otherIds = new Set<string>();
  for (const row of membersResult.data ?? []) {
    const cid = row.conversation_id as string;
    const uid = row.user_id as string;
    if (uid === userId) continue;
    if (!peerByConversation.has(cid)) peerByConversation.set(cid, uid);
    otherIds.add(uid);
  }

  const profileIds = [...otherIds];
  const { data: profiles } = profileIds.length
    ? await client.from('profiles').select('id, username, display_name, avatar_url').in('id', profileIds)
    : { data: [] as { id: string; username: string | null; display_name: string | null; avatar_url: string | null }[] };
  const profileMap = new Map((profiles ?? []).map((row) => [row.id as string, row]));
  const conversationMap = new Map((conversationsResult.data ?? []).map((row) => [row.id as string, row]));

  const latestById = new Map<string, MessagePreview>();
  const unreadById = new Map<string, number>();
  for (const message of messages) {
    if (!latestById.has(message.conversation_id)) latestById.set(message.conversation_id, message);
    if (message.sender_id === userId || message.deleted_at) continue;
    const readAt = mineById.get(message.conversation_id)?.last_read_at;
    if (readAt && message.created_at <= readAt) continue;
    unreadById.set(message.conversation_id, (unreadById.get(message.conversation_id) ?? 0) + 1);
  }

  const now = Date.now();
  return ids
    .map((id) => {
      const self = mineById.get(id);
      const conversation = conversationMap.get(id);
      const isGroup = Boolean(conversation?.is_group);
      const otherId = peerByConversation.get(id);
      const profile = otherId ? profileMap.get(otherId) : undefined;
      const latest = latestById.get(id);
      const unreadBase = unreadById.get(id) ?? 0;
      const unread = self?.marked_unread ? Math.max(1, unreadBase) : unreadBase;
      const name =
        (conversation?.title as string | null) ||
        (profile?.display_name as string | null) ||
        (profile?.username as string | null) ||
        '';
      const body = latest?.deleted_at ? '' : (latest?.body ?? '').trim();
      const mutedUntil = self?.muted_until ? new Date(self.muted_until).getTime() : 0;
      return {
        id,
        title: name,
        username: (profile?.username as string | null) ?? null,
        avatar: ((conversation?.avatar_url as string | null) ?? (profile?.avatar_url as string | null)) ?? null,
        peerId: isGroup ? null : otherId ?? null,
        preview: body,
        media: !body && Boolean(latest?.media_url) && !latest?.deleted_at,
        mine: latest?.sender_id === userId,
        at: latest?.created_at ?? null,
        unread,
        pinned: Boolean(self?.pinned_at),
        archived: Boolean(self?.archived_at),
        muted: mutedUntil > now,
        isGroup,
      } satisfies InboxRow;
    })
    .filter((row) => {
      if (!row.isGroup && row.peerId && blockedIds.has(row.peerId)) return false;
      if (!row.isGroup && row.peerId && !row.title && !row.username) return false;
      return true;
    })
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || String(b.at ?? '').localeCompare(String(a.at ?? '')));
}

export function unreadInboxTotal(rows: InboxRow[]) {
  return rows.reduce((sum, row) => sum + (row.archived ? 0 : row.unread), 0);
}

export async function countUnread(userId: string) {
  const key = ['conversations', userId] as const;
  const cached = queryClient.getQueryData<InboxRow[]>(key);
  if (cached) return unreadInboxTotal(cached);
  const rows = await queryClient.fetchQuery({ queryKey: key, queryFn: () => fetchInbox(userId) });
  return unreadInboxTotal(rows);
}

export async function fetchSuggestions(userId?: string | null, limit = 12): Promise<Person[]> {
  const client = requireSupabase();
  const me = userId ?? (await client.auth.getUser()).data.user?.id ?? null;
  const exclude = new Set<string>();
  if (me) {
    exclude.add(me);
    const { data: follows } = await client.from('follows').select('following_id').eq('follower_id', me);
    for (const row of follows ?? []) exclude.add(row.following_id as string);
  }

  const fetchRows = async (withDisabledFilter: boolean) => {
    let query = client
      .from('profiles')
      .select('id, username, display_name, avatar_url, verified, bio')
      .not('username', 'is', null)
      .order('verified', { ascending: false })
      .order('username', { ascending: true })
      .limit(Math.min(60, Math.max(limit * 3, limit + exclude.size)));
    if (withDisabledFilter) query = query.is('disabled_at', null);
    if (exclude.size) query = query.not('id', 'in', `(${[...exclude].join(',')})`);
    return query;
  };

  let result = await fetchRows(true);
  if (result.error && /disabled_at/.test(result.error.message)) {
    result = await fetchRows(false);
  }
  if (result.error) throw result.error;

  const { getBlockedUserIds } = await import('@/services/safety');
  const blocked = await getBlockedUserIds().catch(() => new Set<string>());

  return (result.data ?? [])
    .filter((row) => !blocked.has(row.id as string))
    .slice(0, limit)
    .map((row) => ({
      id: row.id as string,
      username: (row.username as string | null) ?? null,
      display_name: (row.display_name as string | null) ?? null,
      avatar_url: (row.avatar_url as string | null) ?? null,
      verified: Boolean(row.verified),
      bio: (row.bio as string | null) ?? null,
      following: false,
    }));
}

export async function fetchCircles() {
  const { data, error } = await requireSupabase().from('circles').select('id, name, description, member_count').eq('visibility', 'public').order('member_count', { ascending: false }).limit(4);
  if (error) throw error;
  return data ?? [];
}
