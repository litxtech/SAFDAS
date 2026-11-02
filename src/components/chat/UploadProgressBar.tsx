import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

type Props = {
  /** 0–1 when known; omit / null for indeterminate pulse while starting. */
  progress?: number | null;
};

/** Animated bar overlay for in-flight chat media uploads. */
export function UploadProgressBar({ progress }: Props) {
  const width = useSharedValue(0.08);
  const pulse = useSharedValue(0.35);

  useEffect(() => {
    if (progress == null || Number.isNaN(progress)) {
      width.value = withTiming(0.18, { duration: 280 });
      pulse.value = withRepeat(withTiming(0.85, { duration: 700, easing: Easing.inOut(Easing.quad) }), -1, true);
      return;
    }
    pulse.value = withTiming(1, { duration: 120 });
    width.value = withTiming(Math.max(0.06, Math.min(1, progress)), {
      duration: 180,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, pulse, width]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${width.value * 100}%`,
    opacity: pulse.value,
  }));

  return (
    <View pointerEvents="none" style={styles.wrap}>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, fillStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  track: {
    height: 4,
    marginHorizontal: 10,
    marginBottom: 10,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.28)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
});
