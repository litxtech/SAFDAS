import { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Screen } from '@/components/layout/Screen';
import { PostCard } from '@/components/feed/PostCard';
import { PrayerHero } from '@/components/prayer/PrayerHero';
import { AppEmptyState } from '@/components/ui/AppEmptyState';
import { AppErrorState } from '@/components/ui/AppErrorState';
import { AppIconButton } from '@/components/ui/AppIconButton';
import { AppSkeleton } from '@/components/ui/AppSkeleton';
import { AppTabs } from '@/components/ui/AppTabs';
import { useT } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { fetchFeed } from '@/services/feed';
import { loadPrayerMonth } from '@/services/prayer/service';
import { useAuthStore } from '@/stores/authStore';
import { usePrayerStore } from '@/stores/prayerStore';
import { useTheme } from '@/theme/ThemeProvider';

export default function HomeScreen() {
  const { colors } = useTheme();
  const t = useT();
  const userId = useAuthStore((state) => state.session?.user.id);
  const location = usePrayerStore((state) => state.location);
  const methodId = usePrayerStore((state) => state.methodId);
  const [tab, setTab] = useState('discover');

  const prayer = useQuery({
    queryKey: ['prayer-month', location.city, location.countryCode, methodId, location.latitude],
    queryFn: () => loadPrayerMonth({ location, methodId }),
  });
  const feed = useQuery({
    queryKey: ['feed', tab, userId],
    enabled: Boolean(userId),
    queryFn: () => fetchFeed(tab === 'following' ? 'following' : 'discover', userId as string),
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

  const today = new Date().toISOString().slice(0, 10);
  const day = prayer.data?.find((item) => item.date === today) ?? prayer.data?.[0];

  return (
    <Screen padded={false} tabBar>
      <FlatList
        data={feed.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: 120 }}
        ListHeaderComponent={
          <View style={{ gap: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ color: colors.primary, fontWeight: '800', letterSpacing: 1.4 }}>{t('brand')}</Text>
                <Pressable onPress={() => router.push('/prayer/location')}>
                  <Text style={{ color: colors.textSecondary }}>{location.city}, {location.countryName}</Text>
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <AppIconButton name="add" accessibilityLabel={t('create')} onPress={() => router.push('/post/create')} />
                <AppIconButton name="search" accessibilityLabel={t('search')} onPress={() => router.push('/search')} />
                <AppIconButton name="notifications-outline" accessibilityLabel={t('notifications')} onPress={() => router.push('/notifications')} />
              </View>
            </View>
            {prayer.isLoading ? <AppSkeleton style={{ height: 220 }} /> : null}
            {prayer.error ? <AppErrorState message={(prayer.error as Error).message} onRetry={() => void prayer.refetch()} /> : null}
            {day ? <PrayerHero day={day} city={location.district ? `${location.district}, ${location.city}` : location.city} /> : null}
            <AppTabs
              value={tab}
              onChange={setTab}
              tabs={[
                { key: 'discover', label: t('discover') },
                { key: 'following', label: t('following') },
              ]}
            />
            {feed.isLoading ? <AppSkeleton style={{ height: 120 }} /> : null}
          </View>
        }
        ListEmptyComponent={
          feed.isLoading ? null : (
            <AppEmptyState
              icon="images-outline"
              title={t('emptyFeedTitle')}
              body={t('emptyFeedBody')}
              actionLabel={t('createPost')}
              onAction={() => router.push('/post/create')}
            />
          )
        }
        renderItem={({ item }) => <PostCard post={item} onChange={() => void feed.refetch()} />}
      />
    </Screen>
  );
}
