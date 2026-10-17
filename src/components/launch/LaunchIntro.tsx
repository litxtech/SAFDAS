import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { isProfileComplete, useAuthStore } from '@/stores/authStore';
import { queryClient } from '@/lib/queryClient';
import { useTheme } from '@/theme/ThemeProvider';

const scene = require('../../../assets/ayasofya-rise.jpg');

const RISE_MS = 720;
const FADE_MS = 220;

/** Non-blocking home warm — never delays dismissing the intro. */
function warmHomeInBackground(userId: string) {
  void import('@/services/feed')
    .then(({ fetchFeedPage }) =>
      queryClient.prefetchInfiniteQuery({
        queryKey: ['feed', 'discover', userId],
        initialPageParam: 0,
        queryFn: ({ pageParam }) => fetchFeedPage('discover', userId, pageParam),
      }),
    )
    .catch(() => undefined);
  void import('@/services/social')
    .then(({ fetchInbox }) =>
      queryClient.prefetchQuery({
        queryKey: ['conversations', userId],
        queryFn: () => fetchInbox(userId),
      }),
    )
    .catch(() => undefined);
}

export function LaunchIntro() {
  const { reduceMotion } = useTheme();
  const { width, height } = useWindowDimensions();
  const ready = useAuthStore((state) => state.ready);
  const accountReady = useAuthStore((state) => state.accountReady);
  const session = useAuthStore((state) => state.session);
  const profile = useAuthStore((state) => state.profile);
  const [riseDone, setRiseDone] = useState(reduceMotion);
  const [done, setDone] = useState(false);
  const fading = useRef(false);
  const rise = useSharedValue(reduceMotion ? 1 : 0);
  const opacity = useSharedValue(1);
  const brand = useSharedValue(reduceMotion ? 1 : 0);
  const imageHeight = height * 1.9;
  // Cover the blank index gate until account is routable (or no session).
  const canDismiss = ready && (!session || accountReady);

  useEffect(() => {
    if (reduceMotion) {
      setRiseDone(true);
      return;
    }
    rise.value = withTiming(1, {
      duration: RISE_MS,
      easing: Easing.out(Easing.cubic),
    });
    brand.value = withDelay(380, withTiming(1, { duration: 280 }));
    const timer = setTimeout(() => setRiseDone(true), RISE_MS);
    return () => clearTimeout(timer);
  }, [brand, reduceMotion, rise]);

  useEffect(() => {
    if (!riseDone || !canDismiss || fading.current || done) return;
    fading.current = true;

    const userId = session?.user.id;
    if (userId && isProfileComplete(profile)) {
      warmHomeInBackground(userId);
    }

    opacity.value = withTiming(0, { duration: reduceMotion ? 60 : FADE_MS }, (finished) => {
      if (finished) runOnJS(setDone)(true);
    });
  }, [canDismiss, done, opacity, profile, reduceMotion, riseDone, session]);

  const screenStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const cameraStyle = useAnimatedStyle(() => {
    const start = -(imageHeight - height);
    return { transform: [{ translateY: start * (1 - rise.value) }] };
  });
  const brandStyle = useAnimatedStyle(() => ({
    opacity: brand.value,
    transform: [{ translateY: (1 - brand.value) * 10 }],
  }));

  if (done || height < 1) return null;

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.screen, screenStyle]}>
      {reduceMotion ? (
        <Image source={scene} style={StyleSheet.absoluteFill} contentFit="cover" recyclingKey="launch" />
      ) : (
        <View style={styles.clip}>
          <Animated.View style={[{ width, height: imageHeight }, cameraStyle]}>
            <Image source={scene} style={{ width, height: imageHeight }} contentFit="cover" recyclingKey="launch" />
          </Animated.View>
        </View>
      )}
      <LinearGradient colors={['rgba(12,14,20,0)', 'rgba(12,14,20,0.72)']} style={styles.shade} />
      <Animated.View style={[styles.brandWrap, brandStyle]}>
        <Text style={styles.brand}>SAFDAŞ</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { zIndex: 80, backgroundColor: '#141820', overflow: 'hidden' },
  clip: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  shade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 180 },
  brandWrap: { position: 'absolute', left: 0, right: 0, bottom: 54, alignItems: 'center' },
  brand: {
    color: '#F7F7FA',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 4,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
});
