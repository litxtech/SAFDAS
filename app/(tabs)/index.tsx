import { useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  useWindowDimensions,
  View,
  StyleSheet,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDrawer } from '@/components/navigation/SideDrawer';
import { Screen } from '@/components/layout/Screen';
import { PostCard, type FeedPost } from '@/components/feed/PostCard';
import { PrayerHero } from '@/components/prayer/PrayerHero';
import { AppAvatar } from '@/components/ui/AppAvatar';
import { AppEmptyState } from '@/components/ui/AppEmptyState';
import { AppErrorState } from '@/components/ui/AppErrorState';
import { AppIconButton } from '@/components/ui/AppIconButton';
import { AppSkeleton } from '@/components/ui/AppSkeleton';
import { isRtlLocale, useI18nStore, useT } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { fetchFeedPage } from '@/services/feed';
import { loadPrayerMonth } from '@/services/prayer/service';
import { fetchCircles, fetchSuggestions } from '@/services/social';
import { useAuthStore } from '@/stores/authStore';
import { usePrayerStore } from '@/stores/prayerStore';
import { useTheme } from '@/theme/ThemeProvider';

/* ─── Story skeleton pill ─── */
function StorySkeleton() {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 6, width: 64 }}>
      <AppSkeleton style={{ width: 56, height: 56, borderRadius: 28 }} />
      <AppSkeleton style={{ width: 44, height: 8, borderRadius: 4 }} />
    </View>
  );
}

/* ─── Suggested Person Card ─── */
function SuggestedPerson({
  person,
}: {
  person: { id: string; avatar_url: string | null; display_name: string | null; username: string | null };
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/user/[id]', params: { id: person.id } })}
      style={[styles.suggCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <AppAvatar uri={person.avatar_url} name={person.display_name || person.username} size={48} />
      <Text style={[styles.suggName, { color: colors.text }]} numberOfLines={1}>
        {person.display_name || person.username}
      </Text>
      <Text style={[styles.suggUser, { color: colors.textSecondary }]} numberOfLines={1}>
        @{person.username}
      </Text>
      <View style={[styles.followBtn, { backgroundColor: colors.primary }]}>
        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Takip Et</Text>
      </View>
    </Pressable>
  );
}

/* ─── Tab pill ─── */
function FeedTab({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.tabPill,
        active
          ? { backgroundColor: colors.primary }
          : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth },
      ]}
    >
      <Text
        style={{
          fontSize: 13,
          fontWeight: '700',
          color: active ? '#fff' : colors.textSecondary,
          letterSpacing: 0.2,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/* ─── Post skeleton ─── */
function PostSkeleton() {
  return (
    <View style={{ paddingHorizontal: 14, paddingVertical: 14, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <AppSkeleton style={{ width: 42, height: 42, borderRadius: 21 }} />
        <View style={{ gap: 6, flex: 1 }}>
          <AppSkeleton style={{ width: 120, height: 10, borderRadius: 5 }} />
          <AppSkeleton style={{ width: 80, height: 8, borderRadius: 4 }} />
        </View>
      </View>
      <AppSkeleton style={{ width: '100%', height: 220, borderRadius: 16 }} />
      <AppSkeleton style={{ width: '70%', height: 10, borderRadius: 5 }} />
      <AppSkeleton style={{ width: '50%', height: 8, borderRadius: 4 }} />
    </View>
  );
}

export default function HomeScreen() {
  const { colors, name: themeName } = useTheme();
  const dark = themeName === 'dark';
  const t = useT();
  const client = useQueryClient();
  const profile = useAuthStore((state) => state.profile);
  const userId = useAuthStore((state) => state.session?.user.id);
  const location = usePrayerStore((state) => state.location);
  const methodId = usePrayerStore((state) => state.methodId);
  const drawer = useDrawer();
  const rtl = isRtlLocale(useI18nStore((state) => state.locale));
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'discover' | 'following'>('discover');
  // Let feed win the first network slot — prayer hero can fill in a beat later.
  const [prayerReady, setPrayerReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setPrayerReady(true), 450);
    return () => clearTimeout(timer);
  }, []);

  const prayer = useQuery({
    queryKey: ['prayer-month', location.city, location.countryCode, methodId, location.latitude],
    queryFn: () => loadPrayerMonth({ location, methodId }),
    enabled: prayerReady,
    staleTime: 30 * 60_000,
  });

  const feed = useInfiniteQuery({
    queryKey: ['feed', tab, userId],
    enabled: Boolean(userId),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchFeedPage(tab, userId as string, pageParam),
    getNextPageParam: (page) => page.nextOffset,
    staleTime: 5 * 60_000,
    refetchOnMount: false,
  });

  const posts = feed.data?.pages.flatMap((page) => page.posts) ?? [];

  const suggestions = useQuery({
    queryKey: ['suggestions', userId],
    enabled: Boolean(userId) && !feed.isLoading && posts.length === 0,
    staleTime: 10 * 60_000,
    refetchOnMount: false,
    queryFn: async () => {
      const [people, circles] = await Promise.all([fetchSuggestions(userId as string), fetchCircles()]);
      return { people, circles };
    },
  });

  useEffect(() => {
    if (!prayer.data || !supabase || !userId) return;
    void supabase.from('prayer_preferences').upsert({
      user_id: userId,
      country_code: location.countryCode,
      country_name: location.countryName,
      city: location.city,
      district: location.district,
      latitude: location.latitude,
      longitude: location.longitude,
      timezone: location.timezone,
      method_id: methodId,
      source: location.source,
    });
  }, [prayer.data, userId, location, methodId]);

  useEffect(() => {
    const realtime = supabase;
    if (!realtime || !userId) return;
    // Defer realtime so the first feed fetch isn't competing for the JS thread.
    let channel: ReturnType<typeof realtime.channel> | null = null;
    let softTimer: ReturnType<typeof setTimeout> | null = null;
    const softInvalidate = () => {
      if (softTimer) return;
      softTimer = setTimeout(() => {
        softTimer = null;
        void client.invalidateQueries({ queryKey: ['feed'] });
      }, 2_500);
    };
    const timer = setTimeout(() => {
      channel = realtime
        .channel(`feed:${userId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'post_likes' }, softInvalidate)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'posts' }, softInvalidate)
        .subscribe();
    }, 1200);
    return () => {
      clearTimeout(timer);
      if (softTimer) clearTimeout(softTimer);
      if (channel) void realtime.removeChannel(channel);
    };
  }, [client, userId]);

  const today = new Date().toISOString().slice(0, 10);
  const day = prayer.data?.find((item) => item.date === today) ?? prayer.data?.[0];

  const swipe = Gesture.Pan()
    .activeOffsetX([-28, 28])
    .failOffsetY([-12, 12])
    .onEnd((event) => {
      const startX = event.absoluteX - event.translationX;
      if (rtl ? startX > screenWidth - 22 : startX < 22) return;
      if (event.translationX < -48) runOnJS(setTab)('following');
      if (event.translationX > 48) runOnJS(setTab)('discover');
    });

  return (
    <Screen padded={false} tabBar bleedTop>
      {/* Header gesture dışında — kaydırma jesti arama/buton dokunuşlarını yutmasın */}
      <View style={[styles.topBar, { paddingTop: insets.top + 4, backgroundColor: colors.background }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('profile')}
          onPress={drawer.open}
          style={styles.avatarBtn}
          hitSlop={8}
        >
          <View style={[styles.avatarRingLg, { borderColor: colors.primary }]}>
            <AppAvatar uri={profile?.avatar_url} name={profile?.display_name} size={34} />
          </View>
        </Pressable>

        <View pointerEvents="none" style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[styles.brandText, { color: colors.primary }]}>{t('brand')}</Text>
        </View>

        <View style={styles.topActions}>
          <AppIconButton
            name="search-outline"
            accessibilityLabel={t('search')}
            onPress={() => router.push('/search')}
          />
          <AppIconButton
            name="notifications-outline"
            accessibilityLabel={t('notifications')}
            onPress={() => router.push('/notifications')}
          />
        </View>
      </View>

      <GestureDetector gesture={swipe}>
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 140 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={feed.isRefetching && !feed.isFetchingNextPage}
              tintColor={colors.primary}
              colors={[colors.primary]}
              onRefresh={() => void feed.refetch()}
            />
          }
          onEndReached={() => {
            if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          ListHeaderComponent={
            <View style={{ gap: 0 }}>
              {/* ── Prayer Hero ── */}
              <View style={{ paddingHorizontal: 14, paddingTop: 8, paddingBottom: 4 }}>
                {prayer.isLoading ? (
                  <AppSkeleton style={{ height: 96, borderRadius: 18 }} />
                ) : prayer.error ? (
                  <AppErrorState
                    message={(prayer.error as Error).message}
                    onRetry={() => void prayer.refetch()}
                  />
                ) : day ? (
                  <PrayerHero compact day={day} city={location.district ? `${location.district}, ${location.city}` : location.city} />
                ) : null}
              </View>

              {/* ── Feed Tabs ── */}
              <View style={styles.tabRow}>
                <FeedTab
                  label={t('discover')}
                  active={tab === 'discover'}
                  onPress={() => setTab('discover')}
                />
                <FeedTab
                  label={t('following')}
                  active={tab === 'following'}
                  onPress={() => setTab('following')}
                />
                <View style={{ flex: 1 }} />
                <Pressable
                  onPress={() => router.push('/search')}
                  style={[styles.filterBtn, { borderColor: colors.border }]}
                  hitSlop={8}
                >
                  <Ionicons name="options-outline" size={16} color={colors.icon} />
                </Pressable>
              </View>

              {/* Loading skeletons */}
              {feed.isLoading ? (
                <View>
                  <PostSkeleton />
                  <PostSkeleton />
                </View>
              ) : null}
              {feed.error ? (
                <View style={{ paddingHorizontal: 14 }}>
                  <AppErrorState
                    message={(feed.error as Error).message}
                    onRetry={() => void feed.refetch()}
                  />
                </View>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            feed.isLoading ? null : (
              <View style={{ gap: 24, paddingHorizontal: 14, paddingTop: 8 }}>
                <AppEmptyState
                  icon="images-outline"
                  title={tab === 'following' ? t('followingEmpty') : t('emptyFeedTitle')}
                  body={t('emptyFeedBody')}
                  actionLabel={t('createPost')}
                  onAction={() => router.push('/post/create')}
                />

                {/* Suggested people horizontal scroll */}
                {suggestions.data?.people.length ? (
                  <View style={{ gap: 10 }}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                      {t('suggestedPeople')}
                    </Text>
                    <FlatList
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      data={suggestions.data.people}
                      keyExtractor={(item) => item.id}
                      contentContainerStyle={{ gap: 10, paddingRight: 8 }}
                      renderItem={({ item }) => <SuggestedPerson person={item} />}
                    />
                  </View>
                ) : null}

                {/* Circles */}
                {suggestions.data?.circles.length ? (
                  <View style={{ gap: 10 }}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                      {t('suggestedCircles')}
                    </Text>
                    {suggestions.data.circles.map((circle) => (
                      <Pressable
                        key={circle.id as string}
                        onPress={() =>
                          router.push({ pathname: '/circles/[id]', params: { id: circle.id as string } })
                        }
                        style={[styles.circleRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
                      >
                        <View style={[styles.circleIcon, { backgroundColor: colors.primaryMuted }]}>
                          <Ionicons name="people" size={18} color={colors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.text, fontWeight: '700' }}>{circle.name as string}</Text>
                          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                            {t('membersCount', { count: (circle.member_count as number) ?? 0 })}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={colors.iconMuted} />
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            )
          }
          ListFooterComponent={
            feed.isFetchingNextPage ? (
              <View style={{ paddingHorizontal: 14 }}>
                <PostSkeleton />
              </View>
            ) : null
          }
          renderItem={({ item }: { item: FeedPost }) => (
            <PostCard post={item} onChange={() => void feed.refetch()} />
          )}
        />
      </GestureDetector>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingBottom: 8,
    zIndex: 2,
  },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  avatarBtn: { padding: 2 },
  avatarRingLg: {
    borderRadius: 999,
    borderWidth: 2,
    padding: 1,
  },
  brandText: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  tabPill: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 999,
  },
  filterBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  suggCard: {
    width: 130,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    padding: 14,
    gap: 6,
  },
  suggName: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  suggUser: { fontSize: 12, textAlign: 'center' },
  followBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
    marginTop: 4,
  },
  circleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  circleIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
