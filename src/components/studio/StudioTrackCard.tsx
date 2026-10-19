import { Image } from 'expo-image';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Cover, PlayFab, ink } from '@/components/listen/chrome';
import type { StudioRecording } from '@/services/studio/types';

type Props = {
  recording: Pick<StudioRecording, 'id' | 'title' | 'cover_url' | 'content_type' | 'unique_listeners' | 'play_count' | 'duration_seconds'>;
  artist?: string | null;
  layout?: 'horizontal' | 'vertical';
  playing?: boolean;
  onPress?: () => void;
  onPlay?: () => void;
  style?: StyleProp<ViewStyle>;
  width?: number;
};

function formatListeners(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

export function StudioTrackCard({
  recording,
  artist,
  layout = 'vertical',
  playing = false,
  onPress,
  onPlay,
  style,
  width = 148,
}: Props) {
  const seed = recording.id;
  const label = recording.content_type === 'quran' ? 'Q' : 'D';
  const subtitle = artist?.trim() || (recording.content_type === 'quran' ? 'Kur’an' : 'Dua');

  if (layout === 'horizontal') {
    return (
      <Pressable
        onPress={onPress}
        style={[{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 6 }, style]}
      >
        <View>
          {recording.cover_url ? (
            <Image source={{ uri: recording.cover_url }} style={{ width: 56, height: 56, borderRadius: 4 }} contentFit="cover" />
          ) : (
            <Cover seed={seed} label={label} size={56} radius={4} />
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: ink.text, fontWeight: '700', fontSize: 15 }} numberOfLines={1}>
            {recording.title}
          </Text>
          <Text style={{ color: ink.muted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
            {subtitle} · {formatListeners(recording.unique_listeners)} dinleyici
          </Text>
        </View>
        {onPlay ? <PlayFab playing={playing} size={36} onPress={onPlay} /> : null}
      </Pressable>
    );
  }

  return (
    <View style={[{ width, gap: 8 }, style]}>
      <View>
        <Pressable onPress={onPress}>
          {recording.cover_url ? (
            <Image source={{ uri: recording.cover_url }} style={{ width, height: width, borderRadius: 6 }} contentFit="cover" />
          ) : (
            <Cover seed={seed} label={recording.title} size={width} />
          )}
        </Pressable>
        {onPlay ? (
          <PlayFab playing={playing} size={36} onPress={onPlay} style={{ position: 'absolute', right: 8, bottom: 8 }} />
        ) : null}
      </View>
      <Text style={{ color: ink.text, fontWeight: '700' }} numberOfLines={2}>
        {recording.title}
      </Text>
      <Text style={{ color: ink.muted, fontSize: 12 }} numberOfLines={1}>
        {subtitle}
      </Text>
    </View>
  );
}
