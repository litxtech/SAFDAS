import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSegments } from 'expo-router';
import { Gesture, GestureDetector, Pressable } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Cover, ink } from '@/components/listen/chrome';
import { useT } from '@/i18n';
import { currentTrack, retryPlayback, stopPlayback, togglePlayback, useAudioEngine } from '@/services/audio/engine';
import { openPlayer } from '@/services/quran/nav';
import { useTheme } from '@/theme/ThemeProvider';

const BAR_HEIGHT = 58;
const EDGE_WIDTH = 48;
const SPRING = { damping: 26, stiffness: 340, mass: 0.72, overshootClamping: true };

type Edge = 'left' | 'right' | null;

function travelLimit(width: number) {
  'worklet';
  return Math.max(width - 16, 1);
}

export function MiniPlayer() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const { width } = useWindowDimensions();
  const { reduceMotion } = useTheme();
  const engine = useAudioEngine();
  const track = currentTrack();
  const [edge, setEdge] = useState<Edge>(null);
  const translateX = useSharedValue(0);
  const origin = useSharedValue(0);
  const widthSV = useSharedValue(width);
  const motion = useSharedValue(reduceMotion ? 0 : 1);

  const dockedWidth = useRef(width);

  useEffect(() => {
    widthSV.value = width;
    motion.value = reduceMotion ? 0 : 1;
    if (!edge || dockedWidth.current === width) {
      dockedWidth.current = width;
      return;
    }
    dockedWidth.current = width;
    const limit = Math.max(width - 16, 1);
    translateX.value = edge === 'left' ? -limit : limit;
  }, [edge, motion, reduceMotion, translateX, width, widthSV]);

  useEffect(() => {
    if (track || engine.error) return;
    cancelAnimation(translateX);
    translateX.value = 0;
    setEdge(null);
  }, [engine.error, track, translateX]);

  function commitEdge(next: Edge) {
    setEdge((current) => {
      if (current === next) return current;
      if (next && !reduceMotion) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return next;
    });
  }

  function expand() {
    cancelAnimation(translateX);
    translateX.value = reduceMotion ? 0 : withSpring(0, SPRING);
    setEdge(null);
    if (!reduceMotion) void Haptics.selectionAsync();
  }

  const pan = Gesture.Pan()
    .maxPointers(1)
    .activeOffsetX([-16, 16])
    .failOffsetY([-14, 14])
    .onStart(() => {
      cancelAnimation(translateX);
      origin.value = translateX.value;
    })
    .onUpdate((event) => {
      const limit = travelLimit(widthSV.value);
      const next = origin.value + event.translationX;
      translateX.value = Math.min(limit, Math.max(-limit, next));
    })
    .onEnd((event) => {
      const limit = travelLimit(widthSV.value);
      const velocity = event.velocityX;
      let target = 0;
      let next: Edge = null;
      if (velocity > 750 || (velocity > -750 && translateX.value > limit * 0.32)) {
        target = limit;
        next = 'right';
      } else if (velocity < -750 || (velocity < 750 && translateX.value < -limit * 0.32)) {
        target = -limit;
        next = 'left';
      }
      translateX.value = motion.value === 0 ? target : withSpring(target, { ...SPRING, velocity });
      runOnJS(commitEdge)(next);
    });

  const barStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));
  const leftTabStyle = useAnimatedStyle(() => {
    const progress = Math.min(1, Math.max(0, -translateX.value) / travelLimit(widthSV.value));
    const shown = progress > 0.62 ? (progress - 0.62) / 0.38 : 0;
    return { opacity: shown, transform: [{ translateX: (1 - shown) * -16 }] };
  });
  const rightTabStyle = useAnimatedStyle(() => {
    const progress = Math.min(1, Math.max(0, translateX.value) / travelLimit(widthSV.value));
    const shown = progress > 0.62 ? (progress - 0.62) / 0.38 : 0;
    return { opacity: shown, transform: [{ translateX: (1 - shown) * 16 }] };
  });

  if ((!track && !engine.error) || segments[0] === 'player') return null;

  const onTabs = segments[0] === '(tabs)';
  const bottom = (onTabs ? 78 : 8) + insets.bottom;
  const progress = engine.duration > 0 ? Math.min(1, engine.currentTime / engine.duration) : 0;
  const seed = track?.id ?? 'audio';
  const mark = track?.title?.slice(0, 1) ?? '•';

  return (
    <>
      <GestureDetector gesture={pan}>
        <Animated.View pointerEvents={edge ? 'none' : 'auto'} style={[styles.bar, { bottom }, barStyle]}>
          <View style={styles.track}>
            <View style={{ width: `${progress * 100}%`, height: 2, backgroundColor: ink.green }} />
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={t('nowPlaying')} onPress={openPlayer} style={styles.open}>
            <Cover seed={seed} label={mark} size={BAR_HEIGHT} radius={0} />
            <View style={styles.copy}>
              <Text style={styles.title} numberOfLines={1}>{track?.title ?? t('audioError')}</Text>
              <Text style={{ color: engine.error ? ink.green : ink.muted, fontSize: 12 }} numberOfLines={1}>{engine.error ? t('audioError') : track?.artist}</Text>
            </View>
          </Pressable>
          {engine.error ? (
            <Pressable accessibilityRole="button" accessibilityLabel={t('retryAudio')} onPress={() => void retryPlayback()} hitSlop={8}>
              <Ionicons name="refresh" size={22} color={ink.text} />
            </Pressable>
          ) : (
            <Pressable accessibilityRole="button" accessibilityLabel={engine.playing ? t('playbackPause') : t('playbackPlay')} onPress={togglePlayback} hitSlop={8}>
              <Ionicons name={engine.loading ? 'hourglass' : engine.playing ? 'pause' : 'play'} size={26} color={ink.text} />
            </Pressable>
          )}
          <Pressable accessibilityRole="button" accessibilityLabel={t('closePlayer')} onPress={stopPlayback} hitSlop={8}>
            <Ionicons name="close" size={20} color={ink.muted} />
          </Pressable>
        </Animated.View>
      </GestureDetector>
      <EdgeTab side="left" bottom={bottom} seed={seed} mark={mark} label={t('showPlayer')} enabled={edge === 'left'} style={leftTabStyle} onPress={expand} />
      <EdgeTab side="right" bottom={bottom} seed={seed} mark={mark} label={t('showPlayer')} enabled={edge === 'right'} style={rightTabStyle} onPress={expand} />
    </>
  );
}

function EdgeTab({
  side,
  bottom,
  seed,
  mark,
  label,
  enabled,
  style,
  onPress,
}: {
  side: 'left' | 'right';
  bottom: number;
  seed: string;
  mark: string;
  label: string;
  enabled: boolean;
  style: object;
  onPress: () => void;
}) {
  const chevron = side === 'left' ? 'chevron-forward' : 'chevron-back';
  return (
    <Animated.View
      pointerEvents={enabled ? 'auto' : 'none'}
      style={[styles.tab, side === 'left' ? styles.tabLeft : styles.tabRight, { bottom }, style]}
    >
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.tabPress}>
        <Cover seed={seed} label={mark} size={BAR_HEIGHT} radius={0} />
        <View style={styles.chevron}>
          <Ionicons name={chevron} size={16} color={ink.text} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 8,
    right: 8,
    height: BAR_HEIGHT,
    borderRadius: 8,
    backgroundColor: ink.raised,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
    gap: 10,
    zIndex: 30,
    elevation: 8,
  },
  track: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, backgroundColor: ink.line },
  open: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, height: BAR_HEIGHT },
  copy: { flex: 1 },
  title: { color: ink.text, fontWeight: '700' },
  tab: {
    position: 'absolute',
    width: EDGE_WIDTH,
    height: BAR_HEIGHT,
    backgroundColor: ink.raised,
    overflow: 'hidden',
    zIndex: 31,
    elevation: 10,
  },
  tabLeft: { left: 0, borderTopRightRadius: 14, borderBottomRightRadius: 14 },
  tabRight: { right: 0, borderTopLeftRadius: 14, borderBottomLeftRadius: 14 },
  tabPress: { flex: 1 },
  chevron: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
});
