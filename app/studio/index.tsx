import { useCallback } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ListenBack, ink } from '@/components/listen/chrome';
import { StudioTrackCard } from '@/components/studio/StudioTrackCard';
import { useT } from '@/i18n';
import { currentTrack, useAudioEngine } from '@/services/audio/engine';
import {
  listDiscover,
  listFollowingFeed,
  listSaved,
} from '@/services/studio/api';
import { openStudioDetail, openStudioLibrary, openStudioRecord } from '@/services/studio/nav';
import { playStudioRecording, recordingToTrack } from '@/services/studio/playback';
import type { StudioRecordingWithOwner } from '@/services/studio/types';
import { useAuthStore } from '@/stores/authStore';

const STUDIO_PURPLE = '#8957F5';

function Section({
  title,
  children,
  seeAllLabel,
  onSeeAll,
}: {
  title: string;
  children: React.ReactNode;
  seeAllLabel?: string;
  onSeeAll?: () => void;
}) {
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 }}>
        <Text style={{ color: ink.text, fontSize: 22, fontWeight: '800' }}>{title}</Text>
        {onSeeAll && seeAllLabel ? (
          <Pressable onPress={onSeeAll}>
            <Text style={{ color: ink.muted, fontWeight: '700' }}>{seeAllLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export default function StudioIndexScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.session?.user.id);
  const playing = useAudioEngine((s) => s.playing);
  const activeId = currentTrack()?.studioRecordingId;

  const forYou = useQuery({
    queryKey: ['studio-discover', 'for-you'],
    queryFn: () => listDiscover({ sort: 'popular', limit: 12 }),
  });
  const weekly = useQuery({
    queryKey: ['studio-discover', 'week'],
    queryFn: () => listDiscover({ sort: 'week', limit: 12 }),
  });
  const duas = useQuery({
    queryKey: ['studio-discover', 'dua'],
    queryFn: () => listDiscover({ contentType: 'dua', sort: 'new', limit: 12 }),
  });
  const surahs = useQuery({
    queryKey: ['studio-discover', 'quran'],
    queryFn: () => listDiscover({ contentType: 'quran', sort: 'new', limit: 12 }),
  });
  const newest = useQuery({
    queryKey: ['studio-discover', 'new'],
    queryFn: () => listDiscover({ sort: 'new', limit: 12 }),
  });
  const following = useQuery({
    queryKey: ['studio-discover', 'following', userId],
    enabled: Boolean(userId),
    queryFn: () => listFollowingFeed(),
  });
  const favorites = useQuery({
    queryKey: ['studio-discover', 'saved', userId],
    enabled: Boolean(userId),
    queryFn: () => listSaved(),
  });

  const playOne = useCallback(async (item: StudioRecordingWithOwner, list: StudioRecordingWithOwner[]) => {
    const artist = item.profiles?.display_name || item.profiles?.username || null;
    const queue = list
      .map((row) => recordingToTrack(row, row.profiles?.display_name || row.profiles?.username || null))
      .filter((track): track is NonNullable<typeof track> => Boolean(track));
    await playStudioRecording(item, artist, queue);
  }, []);

  function horizontalList(items: StudioRecordingWithOwner[] | undefined, loading: boolean) {
    if (loading) return <ActivityIndicator color={ink.green} style={{ marginVertical: 16 }} />;
    if (!items?.length) {
      return (
        <Text style={{ color: ink.muted, paddingHorizontal: 16, paddingVertical: 8 }}>{t('studioEmptySection')}</Text>
      );
    }
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}>
        {items.map((item) => (
          <StudioTrackCard
            key={item.id}
            recording={item}
            artist={item.profiles?.display_name || item.profiles?.username}
            playing={playing && activeId === item.id}
            onPress={() => openStudioDetail(item.id)}
            onPlay={() => void playOne(item, items)}
          />
        ))}
      </ScrollView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: ink.canvas, paddingTop: insets.top }}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ paddingBottom: 120, gap: 22 }}>
        <View style={{ paddingHorizontal: 8, paddingTop: 4 }}>
          <ListenBack
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.navigate('/(tabs)');
            }}
          />
        </View>

        <View style={{ paddingHorizontal: 16, gap: 6 }}>
          <Text style={{ color: ink.text, fontSize: 32, fontWeight: '800' }}>{t('studioTitle')}</Text>
          <Text style={{ color: ink.muted, fontSize: 14 }}>{t('studioSubtitle')}</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16 }}>
          <Pressable
            onPress={() => openStudioRecord({ contentType: 'quran', title: t('studioRecordQuranDefault') })}
            style={{
              flex: 1,
              minHeight: 48,
              borderRadius: 999,
              backgroundColor: ink.green,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 8,
            }}
          >
            <Ionicons name="book-outline" size={18} color="#000" />
            <Text style={{ color: '#000', fontWeight: '800' }}>{t('studioCtaQuran')}</Text>
          </Pressable>
          <Pressable
            onPress={() => openStudioRecord({ contentType: 'dua', title: t('studioRecordDuaDefault') })}
            style={{
              flex: 1,
              minHeight: 48,
              borderRadius: 999,
              backgroundColor: STUDIO_PURPLE,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 8,
            }}
          >
            <Ionicons name="mic-outline" size={18} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '800' }}>{t('studioCtaDua')}</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={openStudioLibrary}
          style={{
            marginHorizontal: 16,
            minHeight: 44,
            borderRadius: 8,
            backgroundColor: ink.raised,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 14,
          }}
        >
          <Text style={{ color: ink.text, fontWeight: '700' }}>{t('studioLibrary')}</Text>
          <Ionicons name="chevron-forward" size={18} color={ink.muted} />
        </Pressable>

        <Section title={t('studioForYou')}>{horizontalList(forYou.data, forYou.isLoading)}</Section>
        <Section title={t('studioWeeklyTop')}>{horizontalList(weekly.data, weekly.isLoading)}</Section>
        <Section title={t('studioDuas')}>{horizontalList(duas.data, duas.isLoading)}</Section>
        <Section title={t('studioSurahs')}>{horizontalList(surahs.data, surahs.isLoading)}</Section>
        <Section title={t('studioNew')}>{horizontalList(newest.data, newest.isLoading)}</Section>
        {userId ? <Section title={t('studioFollowing')}>{horizontalList(following.data, following.isLoading)}</Section> : null}
        {userId ? <Section title={t('studioFavorites')}>{horizontalList(favorites.data, favorites.isLoading)}</Section> : null}
      </ScrollView>
    </View>
  );
}
