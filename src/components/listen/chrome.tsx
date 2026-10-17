import { useRef } from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { isRtlLocale, useI18nStore, useT } from '@/i18n';
import { formatClock, type RepeatMode } from '@/services/audio/engine';

export const ink = {
  canvas: '#121212',
  card: '#181818',
  raised: '#282828',
  line: '#4D4D4D',
  text: '#FFFFFF',
  muted: '#B3B3B3',
  dim: '#6A6A6A',
  green: '#1DB954',
  black: '#000000',
};

const covers: [string, string][] = [
  ['#1DB954', '#0B3D22'],
  ['#1E3264', '#0C1833'],
  ['#8D67AB', '#3A2450'],
  ['#E8115B', '#5C0824'],
  ['#148A08', '#063306'],
  ['#E13300', '#5A1400'],
  ['#509BF5', '#163A66'],
  ['#BA5D07', '#4A2503'],
  ['#477D95', '#16323D'],
  ['#B49BC8', '#4A3A56'],
  ['#D84000', '#4A1600'],
  ['#0D73EC', '#063066'],
];

export function coverFor(key: string | number): [string, string] {
  const text = String(key);
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) hash = (hash + text.charCodeAt(index) * (index + 3)) % covers.length;
  return covers[hash] ?? covers[0] ?? ['#1DB954', '#0B3D22'];
}

export function Cover({ seed, label, size = 148, radius = 6 }: { seed: string | number; label: string; size?: number; radius?: number }) {
  const pair = coverFor(seed);
  return (
    <LinearGradient colors={pair} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: size, height: size, borderRadius: radius, alignItems: 'center', justifyContent: 'center', padding: 10 }}>
      <Text style={{ color: ink.text, fontWeight: '800', fontSize: Math.max(13, size * 0.15), textAlign: 'center' }} numberOfLines={3}>
        {label}
      </Text>
    </LinearGradient>
  );
}

export function ListenBack({ down, onPress }: { down?: boolean; onPress?: () => void }) {
  const t = useT();
  const rtl = isRtlLocale(useI18nStore((state) => state.locale));
  const name = down ? 'chevron-down' : rtl ? 'chevron-forward' : 'chevron-back';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('back')}
      hitSlop={8}
      onPress={onPress ?? (() => router.back())}
      style={{ minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' }}
    >
      <Ionicons name={name} size={28} color={ink.text} />
    </Pressable>
  );
}

export function PlayFab({ playing, onPress, size = 56, style }: { playing: boolean; onPress: () => void; size?: number; style?: StyleProp<ViewStyle> }) {
  const t = useT();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={playing ? t('playbackPause') : t('playbackPlay')}
      onPress={onPress}
      style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: ink.text, alignItems: 'center', justifyContent: 'center' }, style]}
    >
      <Ionicons name={playing ? 'pause' : 'play'} size={size * 0.46} color={ink.black} style={playing ? undefined : { marginLeft: 2 }} />
    </Pressable>
  );
}

export function SeekBar({ current, duration, onSeek }: { current: number; duration: number; onSeek: (seconds: number) => void }) {
  const width = useRef(1);
  const progress = duration > 0 ? Math.min(1, current / duration) : 0;
  return (
    <View>
      <Pressable
        onLayout={(event) => {
          width.current = Math.max(1, event.nativeEvent.layout.width);
        }}
        onPress={(event) => {
          if (!duration) return;
          onSeek((event.nativeEvent.locationX / width.current) * duration);
        }}
        style={{ height: 22, justifyContent: 'center' }}
      >
        <View style={{ height: 4, borderRadius: 2, backgroundColor: ink.line, overflow: 'hidden' }}>
          <View style={{ width: `${progress * 100}%`, height: 4, backgroundColor: ink.text }} />
        </View>
      </Pressable>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: ink.muted, fontSize: 11 }}>{formatClock(current)}</Text>
        <Text style={{ color: ink.muted, fontSize: 11 }}>{formatClock(duration)}</Text>
      </View>
    </View>
  );
}

export function Transport({
  playing,
  loading,
  shuffled,
  repeatMode,
  onToggle,
  onPrevious,
  onNext,
  onShuffle,
  onRepeat,
}: {
  playing: boolean;
  loading: boolean;
  shuffled: boolean;
  repeatMode: RepeatMode;
  onToggle: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onShuffle: () => void;
  onRepeat: () => void;
}) {
  const t = useT();
  const repeatOn = repeatMode !== 'off';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 }}>
      <Pressable accessibilityLabel={t('shuffle')} onPress={onShuffle} hitSlop={8}>
        <Ionicons name="shuffle" size={24} color={shuffled ? ink.green : ink.muted} />
      </Pressable>
      <Pressable accessibilityLabel={t('previousTrack')} onPress={onPrevious} hitSlop={8}>
        <Ionicons name="play-skip-back" size={30} color={ink.text} />
      </Pressable>
      <PlayFab playing={playing || loading} onPress={onToggle} size={64} />
      <Pressable accessibilityLabel={t('nextTrack')} onPress={onNext} hitSlop={8}>
        <Ionicons name="play-skip-forward" size={30} color={ink.text} />
      </Pressable>
      <Pressable accessibilityLabel={repeatMode === 'one' ? t('repeatOne') : repeatMode === 'all' ? t('repeatAll') : t('repeatOff')} onPress={onRepeat} hitSlop={8} style={{ width: 32, alignItems: 'center' }}>
        <Ionicons name="repeat" size={24} color={repeatOn ? ink.green : ink.muted} />
        {repeatMode === 'one' ? <Text style={{ color: ink.green, fontSize: 10, fontWeight: '800', marginTop: -4 }}>1</Text> : null}
      </Pressable>
    </View>
  );
}

export function Bars() {
  return (
    <View style={{ width: 14, height: 14, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
      <View style={{ width: 3, height: 7, backgroundColor: ink.green, borderRadius: 1 }} />
      <View style={{ width: 3, height: 14, backgroundColor: ink.green, borderRadius: 1 }} />
      <View style={{ width: 3, height: 5, backgroundColor: ink.green, borderRadius: 1 }} />
    </View>
  );
}

export function TrackRow({
  index,
  title,
  subtitle,
  active,
  playing,
  onPress,
  trailing,
}: {
  index?: number;
  title: string;
  subtitle?: string;
  active?: boolean;
  playing?: boolean;
  onPress: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <Pressable onPress={onPress} style={{ minHeight: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <View style={{ width: 22, alignItems: 'center' }}>
        {active && playing ? <Bars /> : <Text style={{ color: active ? ink.green : ink.muted, fontSize: 15 }}>{index ?? ''}</Text>}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: active ? ink.green : ink.text, fontSize: 16, fontWeight: '600' }} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={{ color: ink.muted, fontSize: 13 }} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {trailing}
    </Pressable>
  );
}

export function RoundIcon({ name, label, onPress, color = ink.muted }: { name: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; color?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={name} size={22} color={color} />
    </Pressable>
  );
}
