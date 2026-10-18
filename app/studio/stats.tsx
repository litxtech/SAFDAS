import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ListenBack, ink } from '@/components/listen/chrome';
import { useT } from '@/i18n';
import { fetchDailyStats, fetchRecording } from '@/services/studio/api';

function oneParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value || undefined;
}

export default function StudioStatsScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const id = oneParam(useLocalSearchParams<{ id?: string }>().id);

  const recording = useQuery({
    queryKey: ['studio-recording', id],
    enabled: Boolean(id),
    queryFn: () => fetchRecording(id as string),
  });

  const stats = useQuery({
    queryKey: ['studio-stats', id],
    enabled: Boolean(id),
    queryFn: () => fetchDailyStats(id as string, 30),
  });

  const rows = stats.data ?? [];
  const totalPlays = rows.reduce((sum, row) => sum + row.plays, 0);
  const totalUniques = rows.reduce((sum, row) => sum + row.unique_listeners, 0);
  const totalLikes = rows.reduce((sum, row) => sum + row.likes, 0);
  const maxPlays = Math.max(1, ...rows.map((row) => row.plays));

  return (
    <View style={{ flex: 1, backgroundColor: ink.canvas, paddingTop: insets.top }}>
      <StatusBar style="light" />
      <View style={{ paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <ListenBack onPress={() => router.back()} />
        <Text style={{ color: ink.text, fontWeight: '800', fontSize: 16 }}>{t('studioStatsTitle')}</Text>
        <View style={{ width: 40 }} />
      </View>

      {recording.isLoading || stats.isLoading ? (
        <ActivityIndicator color={ink.green} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
          <Text style={{ color: ink.text, fontSize: 22, fontWeight: '800' }}>{recording.data?.title ?? ''}</Text>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Metric label={t('studioPlayCount')} value={String(recording.data?.play_count ?? totalPlays)} />
            <Metric label={t('studioUniqueListeners')} value={String(recording.data?.unique_listeners ?? totalUniques)} />
            <Metric label={t('studioLikeCount')} value={String(recording.data?.like_count ?? totalLikes)} />
          </View>

          <Text style={{ color: ink.muted, fontWeight: '700' }}>{t('studioLast30Days')}</Text>
          {rows.length === 0 ? (
            <Text style={{ color: ink.dim }}>{t('studioNoStatsYet')}</Text>
          ) : (
            <View style={{ gap: 8 }}>
              {rows.map((row) => (
                <View key={row.day} style={{ gap: 4 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: ink.muted, fontSize: 12 }}>{row.day}</Text>
                    <Text style={{ color: ink.text, fontSize: 12, fontWeight: '700' }}>
                      {row.plays} / {row.unique_listeners}
                    </Text>
                  </View>
                  <View style={{ height: 6, borderRadius: 3, backgroundColor: ink.raised, overflow: 'hidden' }}>
                    <View
                      style={{
                        width: `${(row.plays / maxPlays) * 100}%`,
                        height: 6,
                        backgroundColor: ink.green,
                      }}
                    />
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: ink.card, borderRadius: 12, padding: 12, gap: 6 }}>
      <Text style={{ color: ink.muted, fontSize: 11 }}>{label}</Text>
      <Text style={{ color: ink.text, fontSize: 20, fontWeight: '800' }}>{value}</Text>
    </View>
  );
}
