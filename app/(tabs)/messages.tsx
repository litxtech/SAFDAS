import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { RectButton } from 'react-native-gesture-handler';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { router } from 'expo-router';
import { Screen } from '@/components/layout/Screen';
import { AppAvatar } from '@/components/ui/AppAvatar';
import { AppBottomSheet } from '@/components/ui/AppBottomSheet';
import { AppEmptyState } from '@/components/ui/AppEmptyState';
import { AppSearchBar } from '@/components/ui/AppSearchBar';
import { formatListTime } from '@/components/chat/format';
import { useI18nStore, useT, type Locale } from '@/i18n';
import { queryClient } from '@/lib/queryClient';
import { requireSupabase } from '@/lib/supabase';
import { patchConversation, removeConversation, useChatLiveStore } from '@/services/chatLive';
import { readInboxCache } from '@/services/inboxCache';
import { markUnread, setMuted } from '@/services/messaging';
import { fetchInbox, type InboxRow } from '@/services/social';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { useTheme } from '@/theme/ThemeProvider';

type Folder = 'all' | 'unread' | 'groups' | 'archived';

const ROW_H = 76;
const ACTION_W = 76;

export default function MessagesScreen() {
  const { colors } = useTheme();
  const t = useT();
  const locale = useI18nStore((state) => state.locale);
  const userId = useAuthStore((state) => state.session?.user.id);
  const show = useToastStore((state) => state.show);
  const online = useChatLiveStore((state) => state.online);
  const presenceReady = useChatLiveStore((state) => state.ready);
  const [term, setTerm] = useState('');
  const [folder, setFolder] = useState<Folder>('all');
  const [menu, setMenu] = useState<InboxRow | null>(null);
  const openSwipeRef = useRef<Swipeable | null>(null);
  useEffect(() => {
    if (!userId) return;
    const key = ['conversations', userId] as const;
    if (queryClient.getQueryData(key)) return;
    void readInboxCache(userId).then((cached) => {
      if (cached?.length && !queryClient.getQueryData(key)) {
        queryClient.setQueryData(key, cached);
      }
    });
  }, [userId]);

  const query = useQuery({
    queryKey: ['conversations', userId],
    enabled: Boolean(userId),
    queryFn: () => fetchInbox(userId as string),
    staleTime: 20_000,
    gcTime: 1000 * 60 * 30,
    placeholderData: (prev) => prev,
  });

  const needle = term.trim().toLocaleLowerCase();
  const source = query.data ?? [];
  const unreadCount = source.reduce((sum, row) => sum + (row.archived ? 0 : row.unread), 0);
  const filtered = source.filter((row) => {
    if (folder === 'archived') return row.archived;
    if (row.archived) return false;
    if (folder === 'unread' && row.unread < 1) return false;
    if (folder === 'groups' && !row.isGroup) return false;
    if (!needle) return true;
    return `${row.title} ${row.username ?? ''} ${row.preview}`.toLocaleLowerCase().includes(needle);
  });

  async function setPinned(row: InboxRow, pinned: boolean) {
    if (!userId) return;
    patchConversation(row.id, { pinned });
    const { error } = await requireSupabase()
      .from('conversation_members')
      .update({ pinned_at: pinned ? new Date().toISOString() : null })
      .eq('conversation_id', row.id)
      .eq('user_id', userId);
    if (error) show(error.message, 'error');
  }

  async function setArchived(row: InboxRow, archived: boolean) {
    if (!userId) return;
    patchConversation(row.id, { archived });
    const { error } = await requireSupabase()
      .from('conversation_members')
      .update({ archived_at: archived ? new Date().toISOString() : null })
      .eq('conversation_id', row.id)
      .eq('user_id', userId);
    if (error) show(error.message, 'error');
  }

  async function mute(row: InboxRow, muted: boolean) {
    if (!userId) return;
    patchConversation(row.id, { muted });
    try {
      await setMuted(row.id, userId, muted);
    } catch (error) {
      show(error instanceof Error ? error.message : t('messageFailed'), 'error');
    }
  }

  async function unread(row: InboxRow) {
    if (!userId) return;
    patchConversation(row.id, { unread: Math.max(1, row.unread) });
    try {
      await markUnread(row.id, userId);
    } catch (error) {
      show(error instanceof Error ? error.message : t('messageFailed'), 'error');
    }
  }

  async function remove(row: InboxRow) {
    if (!userId) return;
    removeConversation(row.id);
    const { error } = await requireSupabase().from('conversation_members').delete().eq('conversation_id', row.id).eq('user_id', userId);
    if (error) show(error.message, 'error');
  }

  function preview(row: InboxRow) {
    const text = row.preview || (row.media ? t('photoMessage') : row.at ? t('mediaMessage') : '');
    if (!text) return t('emptyChatsBody');
    return row.mine ? `${t('youLabel')}: ${text}` : text;
  }

  const closeOpen = useCallback(() => {
    openSwipeRef.current?.close();
    openSwipeRef.current = null;
  }, []);

  const folders: { id: Folder; label: string }[] = [
    { id: 'all', label: t('allChats') },
    { id: 'unread', label: unreadCount > 0 ? `${t('unreadFolder')} ${unreadCount}` : t('unreadFolder') },
    { id: 'groups', label: t('groupsFolder') },
    { id: 'archived', label: t('archivedFolder') },
  ];

  return (
    <Screen padded={false} tabBar>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.text }]}>{t('messages')}</Text>
          <View style={styles.actions}>
            <Pressable accessibilityLabel={t('callsTitle')} onPress={() => router.push('/calls')} style={[styles.compose, { backgroundColor: colors.primaryMuted }]}>
              <Ionicons name="call-outline" size={20} color={colors.primary} />
            </Pressable>
            <Pressable accessibilityLabel={t('search')} onPress={() => router.push('/chat/search-global')} style={[styles.compose, { backgroundColor: colors.primaryMuted }]}>
              <Ionicons name="search" size={20} color={colors.primary} />
            </Pressable>
            <Pressable accessibilityLabel={t('newMessage')} onPress={() => router.push('/chat/compose')} style={[styles.compose, { backgroundColor: colors.primaryMuted }]}>
              <Ionicons name="create-outline" size={22} color={colors.primary} />
            </Pressable>
          </View>
        </View>
        <AppSearchBar value={term} onChangeText={setTerm} placeholder={t('searchChatsPlaceholder')} />
        <FlatList
          horizontal
          data={folders}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.folders}
          renderItem={({ item }) => {
            const selected = folder === item.id;
            return (
              <Pressable onPress={() => setFolder(item.id)} style={[styles.folder, { backgroundColor: selected ? colors.primary : colors.backgroundSecondary }]}>
                <Text style={{ color: selected ? colors.onPrimary : colors.textSecondary, fontWeight: '700', fontSize: 13 }}>{item.label}</Text>
              </Pressable>
            );
          }}
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        directionalLockEnabled
        keyboardShouldPersistTaps="handled"
        initialNumToRender={12}
        windowSize={8}
        getItemLayout={(_, index) => ({ length: ROW_H, offset: ROW_H * index, index })}
        refreshControl={<RefreshControl refreshing={query.isRefetching && !query.isLoading} onRefresh={() => void query.refetch()} tintColor={colors.primary} />}
        contentContainerStyle={styles.list}
        onScrollBeginDrag={closeOpen}
        ListEmptyComponent={
          query.isLoading && !query.data ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <AppEmptyState icon="chatbubbles-outline" title={t('emptyChatsTitle')} body={t('emptyChatsBody')} actionLabel={t('newMessage')} onAction={() => router.push('/chat/compose')} />
          )
        }
        renderItem={({ item }) => (
          <InboxSwipeRow
            item={item}
            colors={colors}
            locale={locale}
            online={presenceReady && Boolean(item.peerId) && online.includes(item.peerId as string)}
            preview={preview(item)}
            openSwipeRef={openSwipeRef}
            labels={{
              pin: item.pinned ? t('unpinChat') : t('pinChat'),
              mute: item.muted ? t('unmuteChat') : t('muteChat'),
              unread: t('markUnread'),
              archive: t('archivedFolder'),
              delete: t('deleteChat'),
              fallback: t('userFallback'),
            }}
            onOpenChat={() => router.push({ pathname: '/chat/[id]', params: { id: item.id } })}
            onMenu={() => setMenu(item)}
            onPin={() => void setPinned(item, !item.pinned)}
            onMute={() => void mute(item, !item.muted)}
            onUnread={() => void unread(item)}
            onArchive={() => void setArchived(item, folder !== 'archived')}
            onDelete={() => void remove(item)}
          />
        )}
      />
      <AppBottomSheet visible={Boolean(menu)} title={menu?.title || t('messages')} onClose={() => setMenu(null)}>
        <SheetRow label={menu?.pinned ? t('unpinChat') : t('pinChat')} color={colors.text} onPress={() => { if (menu) void setPinned(menu, !menu.pinned); setMenu(null); }} />
        <SheetRow label={menu?.muted ? t('unmuteChat') : t('muteChat')} color={colors.text} onPress={() => { if (menu) void mute(menu, !menu.muted); setMenu(null); }} />
        <SheetRow label={t('markUnread')} color={colors.text} onPress={() => { if (menu) void unread(menu); setMenu(null); }} />
        <SheetRow label={menu?.archived ? t('messages') : t('archiveChat')} color={colors.text} onPress={() => { if (menu) void setArchived(menu, !menu.archived); setMenu(null); }} />
        <SheetRow label={t('createGroup')} color={colors.text} onPress={() => { setMenu(null); router.push('/chat/group-create'); }} />
        {menu?.peerId ? <SheetRow label={t('profile')} color={colors.text} onPress={() => { const peer = menu.peerId; setMenu(null); if (peer) router.push({ pathname: '/user/[id]', params: { id: peer } }); }} /> : null}
        <SheetRow label={t('deleteChat')} color={colors.error} onPress={() => { if (menu) void remove(menu); setMenu(null); }} />
      </AppBottomSheet>
    </Screen>
  );
}

type ThemeColors = ReturnType<typeof useTheme>['colors'];

function InboxSwipeRow({
  item,
  colors,
  locale,
  online,
  preview,
  openSwipeRef,
  labels,
  onOpenChat,
  onMenu,
  onPin,
  onMute,
  onUnread,
  onArchive,
  onDelete,
}: {
  item: InboxRow;
  colors: ThemeColors;
  locale: Locale;
  online: boolean;
  preview: string;
  openSwipeRef: MutableRefObject<Swipeable | null>;
  labels: { pin: string; mute: string; unread: string; archive: string; delete: string; fallback: string };
  onOpenChat: () => void;
  onMenu: () => void;
  onPin: () => void;
  onMute: () => void;
  onUnread: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const rowRef = useRef<Swipeable | null>(null);

  const run = (action: () => void) => {
    rowRef.current?.close();
    if (openSwipeRef.current === rowRef.current) openSwipeRef.current = null;
    action();
  };

  return (
    <Swipeable
      ref={(ref) => {
        rowRef.current = ref;
      }}
      friction={1}
      overshootFriction={8}
      overshootLeft={false}
      overshootRight={false}
      leftThreshold={36}
      rightThreshold={36}
      dragOffsetFromLeftEdge={18}
      dragOffsetFromRightEdge={18}
      failOffsetY={[-12, 12]}
      containerStyle={{ backgroundColor: colors.background }}
      onSwipeableWillOpen={() => {
        if (openSwipeRef.current && openSwipeRef.current !== rowRef.current) {
          openSwipeRef.current.close();
        }
        openSwipeRef.current = rowRef.current;
      }}
      onSwipeableClose={() => {
        if (openSwipeRef.current === rowRef.current) openSwipeRef.current = null;
      }}
      renderLeftActions={() => (
        <View style={styles.swipeRow}>
          <SwipeAction color={colors.primary} icon={item.pinned ? 'pin' : 'pin-outline'} label={labels.pin} onPress={() => run(onPin)} />
          <SwipeAction color={colors.warning} icon={item.muted ? 'notifications' : 'notifications-off-outline'} label={labels.mute} onPress={() => run(onMute)} />
        </View>
      )}
      renderRightActions={() => (
        <View style={styles.swipeRow}>
          <SwipeAction color="#64748B" icon="mail-unread-outline" label={labels.unread} onPress={() => run(onUnread)} />
          <SwipeAction color={colors.warning} icon="archive-outline" label={labels.archive} onPress={() => run(onArchive)} />
          <SwipeAction color={colors.error} icon="trash-outline" label={labels.delete} onPress={() => run(onDelete)} />
        </View>
      )}
    >
      <Pressable onPress={onOpenChat} onLongPress={onMenu} delayLongPress={280} style={[styles.row, { backgroundColor: colors.background }]}>
        <View>
          <AppAvatar uri={item.avatar} name={item.title || item.username} size={54} />
          {online ? <View style={[styles.dot, { backgroundColor: colors.success, borderColor: colors.background }]} /> : null}
        </View>
        <View style={[styles.body, { borderBottomColor: colors.divider }]}>
          <View style={styles.line}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: item.unread > 0 ? '800' : '600', flex: 1 }} numberOfLines={1}>
              {item.title || labels.fallback}
            </Text>
            {item.at ? (
              <Text style={{ color: item.unread > 0 ? colors.primary : colors.textSecondary, fontSize: 12, fontWeight: '600' }}>
                {formatListTime(item.at, locale)}
              </Text>
            ) : null}
          </View>
          <View style={styles.line}>
            <Text style={{ color: item.unread > 0 ? colors.text : colors.textSecondary, flex: 1, fontSize: 14 }} numberOfLines={1}>
              {preview}
            </Text>
            {item.muted ? <Ionicons name="notifications-off" size={14} color={colors.iconMuted} /> : null}
            {item.pinned ? <Ionicons name="pin" size={14} color={colors.iconMuted} /> : null}
            {item.unread > 0 ? (
              <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                <Text style={{ color: colors.onPrimary, fontSize: 12, fontWeight: '800' }}>{item.unread > 99 ? '99+' : item.unread}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>
    </Swipeable>
  );
}

function SwipeAction({
  color,
  icon,
  label,
  onPress,
}: {
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <RectButton onPress={onPress} style={[styles.swipe, { backgroundColor: color }]}>
      <Ionicons name={icon} size={20} color="#fff" />
      <Text style={styles.swipeLabel} numberOfLines={1}>
        {label}
      </Text>
    </RectButton>
  );
}

function SheetRow({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
  return (
    <Pressable style={styles.sheetRow} onPress={onPress}>
      <Text style={{ color, fontSize: 16, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 34, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 8 },
  compose: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  folders: { gap: 8, paddingBottom: 4 },
  folder: { minHeight: 32, borderRadius: 16, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  list: { paddingBottom: 24, flexGrow: 1 },
  loading: { paddingTop: 72, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, gap: 12, height: ROW_H },
  dot: { position: 'absolute', right: 0, bottom: 0, width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  body: { flex: 1, height: ROW_H, justifyContent: 'center', gap: 3, paddingRight: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  swipeRow: { flexDirection: 'row', height: ROW_H },
  swipe: { width: ACTION_W, height: ROW_H, alignItems: 'center', justifyContent: 'center', gap: 4 },
  swipeLabel: { color: '#fff', fontSize: 11, fontWeight: '700', textAlign: 'center', paddingHorizontal: 4 },
  sheetRow: { minHeight: 48, justifyContent: 'center' },
});
