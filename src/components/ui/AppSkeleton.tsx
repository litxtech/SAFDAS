import { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeProvider';

export function AppSkeleton({ style }: { style?: ViewStyle }) {
  const { colors, reduceMotion } = useTheme();
  const opacity = useSharedValue(0.45);
  useEffect(() => {
    if (reduceMotion) return;
    opacity.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
  }, [opacity, reduceMotion]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.base, { backgroundColor: colors.skeleton }, animated, style]} />;
}

const styles = StyleSheet.create({
  base: { borderRadius: 16, height: 16 },
});
