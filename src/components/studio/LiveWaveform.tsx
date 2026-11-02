import { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { ink } from '@/components/listen/chrome';

const BAR_COUNT = 28;

type Props = {
  /** Normalized metering level 0–1 (or raw dB; values ≤ 0 are treated as dB). */
  level: number;
  active?: boolean;
  color?: string;
  style?: StyleProp<ViewStyle>;
  height?: number;
};

function normalizeLevel(level: number) {
  if (!Number.isFinite(level)) return 0;
  if (level >= 0 && level <= 1) return level;
  // expo-audio metering is typically dB (−160…0)
  const db = Math.max(-60, Math.min(0, level));
  return Math.min(1, Math.max(0, (db + 60) / 60));
}

export function LiveWaveform({ level, active = true, color = ink.green, style, height = 56 }: Props) {
  const anims = useRef(Array.from({ length: BAR_COUNT }, () => new Animated.Value(0.12))).current;
  const target = useMemo(() => normalizeLevel(level), [level]);

  useEffect(() => {
    const mid = (BAR_COUNT - 1) / 2;
    anims.forEach((anim, index) => {
      const distance = Math.abs(index - mid) / mid;
      const shape = 1 - distance * 0.55;
      const jitter = active ? 0.08 + Math.random() * 0.2 : 0;
      const next = active ? Math.max(0.1, Math.min(1, target * shape + jitter * target)) : 0.12;
      Animated.timing(anim, {
        toValue: next,
        duration: active ? 90 : 220,
        useNativeDriver: false,
      }).start();
    });
  }, [active, anims, target]);

  return (
    <View style={[styles.row, { height }, style]}>
      {anims.map((anim, index) => (
        <Animated.View
          key={index}
          style={{
            width: 3,
            borderRadius: 2,
            backgroundColor: color,
            opacity: active ? 0.95 : 0.35,
            height: anim.interpolate({ inputRange: [0, 1], outputRange: [4, height] }),
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 2,
    paddingHorizontal: 4,
  },
});
