import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { playbackClock } from '@/components/quran/playbackClock';
import { GlassSurface } from '@/components/ui/GlassSurface';
import { useT } from '@/i18n';
import { openPlayer } from '@/services/quran/nav';
import { stopQuranPlayback } from '@/services/quran/playback';
import { useReadingStore } from '@/stores/readingStore';
import { useTheme } from '@/theme/ThemeProvider';

type Playback = {
  playing: boolean;
  currentTime: number;
  duration: number;
  title: string;
  onToggle: () => void;
  onPrevious: () => void;
  onNext: () => void;
};

type Props = {
  children: React.ReactNode;
  playback: Playback | null;
};

export function ReaderDock({ children, playback }: Props) {
  const { colors, reduceMotion } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const fontSize = useReadingStore((state) => state.fontSize);
  const setFontSize = useReadingStore((state) => state.setFontSize);
  const [menu, setMenu] = useState(false);
  const clock = playback ? playbackClock(playback.currentTime, playback.duration) : null;

  function bump(delta: number) {
    if (!reduceMotion) void Haptics.selectionAsync();
    setFontSize(fontSize + delta);
  }

  return (
    <View style={styles.root}>
      {children}
      {menu ? <Pressable accessibilityRole="button" style={styles.backdrop} onPress={() => setMenu(false)} /> : null}
      <View style={styles.pin}>
        <GlassSurface style={styles.pinShell} contentStyle={styles.pinContent}>
          {menu ? (
            <>
              <IconButton label={t('zoomOut')} name="remove" disabled={fontSize <= 18} onPress={() => bump(-2)} />
              <IconButton label={t('zoomIn')} name="add" disabled={fontSize >= 40} onPress={() => bump(2)} />
            </>
          ) : null}
          <IconButton
            label={t('moreActions')}
            name="ellipsis-vertical"
            filled={menu}
            onPress={() => {
              if (!reduceMotion) void Haptics.selectionAsync();
              setMenu((open) => !open);
            }}
          />
        </GlassSurface>
      </View>
      {playback && clock ? (
        <View style={[styles.playerDock, { bottom: Math.max(12, insets.bottom) }]}>
          <GlassSurface contentStyle={styles.playerContent}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Pressable accessibilityRole="button" onPress={openPlayer} style={{ flex: 1, gap: 8 }}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>{playback.title}</Text>
                <View style={[styles.track, { backgroundColor: colors.primaryMuted }]}>
                  <View style={[styles.fill, { width: `${Math.round(clock.progress * 100)}%`, backgroundColor: colors.primary }]} />
                </View>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={t('closePlayer')} onPress={stopQuranPlayback} hitSlop={8}>
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
            <View style={styles.times}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>
                {clock.known ? t('playbackAtSecond', { second: clock.second }) : t('playbackLoading')}
              </Text>
              <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>
                {clock.known ? t('playbackRemaining', { seconds: clock.remaining }) : ''}
              </Text>
            </View>
            <View style={styles.transport}>
              <IconButton label={t('playbackPrevious')} name="play-skip-back" onPress={playback.onPrevious} />
              <IconButton
                label={playback.playing ? t('playbackPause') : t('playbackPlay')}
                name={playback.playing ? 'pause' : 'play'}
                onPress={playback.onToggle}
                filled
              />
              <IconButton label={t('playbackNext')} name="play-skip-forward" onPress={playback.onNext} />
            </View>
          </GlassSurface>
        </View>
      ) : null}
    </View>
  );
}

function IconButton({
  name,
  label,
  onPress,
  disabled,
  filled,
}: {
  name: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  filled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.icon,
        {
          backgroundColor: filled ? colors.primary : colors.primaryMuted,
          opacity: disabled ? 0.35 : pressed ? 0.8 : 1,
        },
      ]}
    >
      <Ionicons name={name} size={16} color={filled ? colors.onPrimary : colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFillObject, zIndex: 2 },
  pin: { position: 'absolute', top: -28, right: 10, zIndex: 3 },
  pinShell: { borderRadius: 18 },
  pinContent: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 3 },
  playerDock: { position: 'absolute', left: 12, right: 12, zIndex: 2 },
  playerContent: { padding: 12, gap: 8 },
  track: { height: 4, borderRadius: 99, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 99 },
  times: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  transport: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  icon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});
