import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Screen } from '@/components/layout/Screen';
import { StoryCard } from '@/components/stories/StoryCard';
import { useFeatureT } from '@/i18n/features';
import {
  clearStoryCategoryCache,
  fetchStories,
  fetchStoryCategories,
  fetchStoryConfig,
  storyCategoryName,
} from '@/services/stories/api';
import type { StoryFeedItem } from '@/services/stories/types';
import { useI18nStore } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';

type TabKey = 'for_you' | 'new' | 'saved' | 'categories';

const PAGE_SIZE = 12;

export default function StoriesScreen() {
  const { colors } = useTheme();
  const t = useFeatureT();
  const locale = useI18nStore((state) => state.locale);
  const [tab, setTab] = useState<TabKey>('for_you');
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const config = useQuery({
    queryKey: ['stories-config'],
    staleTime: 5 * 60_000,
    queryFn: fetchStoryConfig,
  });

  const categories = useQuery({
    queryKey: ['story-categories'],
    staleTime: 10 * 60_000,
    queryFn: () => fetchStoryCategories(),
  });

  const feed = useInfiniteQuery({
    queryKey: ['stories-feed', tab, categoryId],
    enabled: tab !== 'categories' && config.data?.enabled !== false,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      fetchStories({
        tab: tab === 'saved' ? 'saved' : tab === 'for_you' ? 'for_you' : 'new',
        categoryId,
        cursor: pageParam,
        limit: PAGE_SIZE,
      }),
    getNextPageParam: (last) => last.nextCursor,
    staleTime: 60_000,
  });

  const stories = useMemo(() => {
    const seen = new Set<string>();
    const rows: StoryFeedItem[] = [];
    for (const page of feed.data?.pages ?? []) {
      for (const item of page.items) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        rows.push(item);
      }
    }
    return rows;
  }, [feed.data]);

  const refresh = useCallback(() => {
    clearStoryCategoryCache();
    void categories.refetch();
    void feed.refetch();
  }, [categories, feed]);

  const tabs: { key: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'for_you', label: t('storiesForYou'), icon: 'sparkles-outline' },
    { key: 'new', label: t('storiesNew'), icon: 'time-outline' },
    { key: 'categories', label: t('storiesCategories'), icon: 'grid-outline' },
    { key: 'saved', label: t('storiesSaved'), icon: 'bookmark-outline' },
  ];

  const header = (
    <View style={{ gap: 14, paddingTop: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: colors.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.4 }}>
            {t('storiesTitle')}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19 }}>{t('storiesTagline')}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('storiesMine')}
          onPress={() => router.push('/stories/my')}
          style={[styles.iconButton, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
        >
          <Ionicons name="person-outline" size={18} color={colors.primary} />
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/stories/compose')}
        style={({ pressed }) => [
          styles.writeButton,
          { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 },
        ]}
      >
        <Ionicons name="create-outline" size={18} color={colors.onPrimary} />
        <Text style={{ color: colors.onPrimary, fontWeight: '800', fontSize: 14 }}>{t('storiesWrite')}</Text>
      </Pressable>

      {config.data && !config.data.enabled ? (
        <View style={[styles.notice, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
          <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
          <Text style={{ color: colors.textSecondary, fontSize: 12, flex: 1 }}>{t('storiesEmpty')}</Text>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 6 }}>
        {tabs.map((item) => {
          const active = tab === item.key;
          return (
            <Pressable
              key={item.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setTab(item.key)}
              style={[
                styles.tab,
                {
                  backgroundColor: active ? colors.primary : colors.backgroundSecondary,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                numberOfLines={1}
                style={{ color: active ? colors.onPrimary : colors.textSecondary, fontSize: 11, fontWeight: '800' }}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {tab !== 'categories' && (categories.data?.length ?? 0) > 0 ? (
        <FlatList
          horizontal
          data={[{ id: null, label: t('storiesCategoryAll') }, ...(categories.data ?? []).map((category) => ({
            id: category.id,
            label: storyCategoryName(category, locale),
          }))]}
          keyExtractor={(item) => item.id ?? 'all'}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6 }}
          renderItem={({ item }) => {
            const active = categoryId === item.id;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setCategoryId(item.id)}
                style={[
                  styles.pill,
                  {
                    backgroundColor: active ? colors.primaryMuted : 'transparent',
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={{ color: active ? colors.primary : colors.textSecondary, fontSize: 12, fontWeight: '700' }}>
                  {item.label}
                </Text>
              </Pressable>
            );
          }}
        />
      ) : null}

      {tab === 'categories' ? (
        <View style={{ gap: 8 }}>
          {(categories.data ?? []).map((category) => (
            <Pressable
              key={category.id}
              accessibilityRole="button"
              onPress={() => {
                setCategoryId(category.id);
                setTab('new');
              }}
              style={[styles.categoryRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={[styles.categoryIcon, { backgroundColor: colors.primaryMuted }]}>
                <Ionicons name="bookmark-outline" size={16} color={colors.primary} />
              </View>
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700', flex: 1 }} numberOfLines={1}>
                {storyCategoryName(category, locale)}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.iconMuted} />
            </Pressable>
          ))}
          {categories.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        </View>
      ) : null}
    </View>
  );

  return (
    <Screen padded={false} back={false} scroll={false}>
      <FlatList
        data={tab === 'categories' ? [] : stories}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        renderItem={({ item, index }) => (
          <View style={{ paddingTop: index === 0 ? 12 : 0 }}>
            <StoryCard
              story={item}
              featured={index === 0 && tab !== 'saved'}
              onPress={() => router.push({ pathname: '/stories/[id]', params: { id: item.id } })}
            />
          </View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 12 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={feed.isRefetching} onRefresh={refresh} tintColor={colors.primary} />}
        onEndReached={() => {
          if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          feed.isFetchingNextPage ? (
            <ActivityIndicator color={colors.primary} style={{ paddingVertical: 16 }} />
          ) : feed.hasNextPage ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => void feed.fetchNextPage()}
              style={[styles.loadMore, { borderColor: colors.border }]}
            >
              <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '800' }}>{t('storiesLoadMore')}</Text>
            </Pressable>
          ) : null
        }
        ListEmptyComponent={
          tab === 'categories' ? null : feed.isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ paddingVertical: 40 }} />
          ) : feed.isError ? (
            <View style={[styles.empty, { backgroundColor: colors.backgroundSecondary }]}>
              <Text style={{ color: colors.error, fontSize: 13, textAlign: 'center' }}>{t('storiesSaveFailed')}</Text>
              <Pressable accessibilityRole="button" onPress={() => void feed.refetch()}>
                <Text style={{ color: colors.primary, fontWeight: '800' }}>{t('storiesLoadMore')}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={[styles.empty, { backgroundColor: colors.backgroundSecondary }]}>
              <Ionicons name="book-outline" size={22} color={colors.iconMuted} />
              <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: 'center' }}>{t('storiesEmpty')}</Text>
            </View>
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  writeButton: {
    minHeight: 46,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  notice: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tab: {
    flex: 1,
    minHeight: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  pill: {
    minHeight: 30,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryRow: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  categoryIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    marginTop: 16,
    padding: 22,
    borderRadius: 16,
    alignItems: 'center',
    gap: 8,
  },
  loadMore: {
    marginTop: 4,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
