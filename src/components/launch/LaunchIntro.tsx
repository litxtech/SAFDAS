import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Image } from 'expo-image';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeProvider';

const logo = require('../../../assets/logo-mark.png');

export function LaunchIntro() {
  const { reduceMotion } = useTheme();
  const [done, setDone] = useState(false);
  const scale = useSharedValue(reduceMotion ? 1 : 0.78);
  const opacity = useSharedValue(1);
  const markOpacity = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    markOpacity.value = withTiming(1, { duration: reduceMotion ? 80 : 420 });
    scale.value = withTiming(1, { duration: reduceMotion ? 80 : 900 });
    const timer = setTimeout(() => {
      opacity.value = withTiming(0, { duration: reduceMotion ? 80 : 220 }, (finished) => {
        if (finished) runOnJS(setDone)(true);
      });
    }, reduceMotion ? 280 : 1000);
    return () => clearTimeout(timer);
  }, [markOpacity, opacity, reduceMotion, scale]);

  const screenStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const markStyle = useAnimatedStyle(() => ({
    opacity: markOpacity.value,
    transform: [{ scale: scale.value }],
  }));

  if (done) return null;

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.screen, screenStyle]}>
      <Animated.View style={markStyle}>
        <Image source={logo} style={styles.logo} contentFit="contain" />
      </Animated.View>
      <Text style={styles.brand}>SAFDAŞ</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    zIndex: 80,
    backgroundColor: '#191B24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: 280, height: 280 },
  brand: { color: '#F7F7FA', fontSize: 22, fontWeight: '800', letterSpacing: 3, marginTop: 8 },
});
