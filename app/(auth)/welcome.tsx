import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { openPolicy } from '@/components/legal/PolicyLinks';
import {
  SpotBackdrop,
  SpotButton,
  SpotGlass,
  spot,
  spotEnter,
  spotFade,
} from '@/components/auth/SpotAuth';
import { useT } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';

const LOBBY = {
  title: 'İbadetin, Huzurun ve Paylaşımın Buluştuğu Yer',
  body: 'Namaz, Kur’an ve dua — aynı safta, aynı gönülde.',
  createAccount: 'Hesap Oluştur',
  privacy: 'Gizlilik',
  terms: 'Koşullar',
  brand: 'SAFDAŞ',
} as const;

export default function WelcomeScreen() {
  const { reduceMotion: themeReduce } = useTheme();
  const systemReduce = useReducedMotion();
  const reduceMotion = themeReduce || Boolean(systemReduce);
  const t = useT();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const compact = windowHeight < 720;

  function press(action: () => void) {
    if (!reduceMotion) void Haptics.selectionAsync();
    action();
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <SpotBackdrop />
      <View
        style={[
          styles.stage,
          {
            paddingTop: insets.top + (compact ? 16 : 28),
            paddingBottom: Math.max(insets.bottom, 16) + 10,
          },
        ]}
      >
        <Animated.View
          entering={spotFade(60, reduceMotion)}
          style={[styles.brandRow, { top: insets.top + (compact ? 16 : 28) }]}
        >
          <Text style={styles.brand} accessibilityRole="header">
            {LOBBY.brand}
          </Text>
        </Animated.View>

        <View style={styles.spacer} />

        <Animated.View entering={spotEnter(160, reduceMotion)} style={styles.copy}>
          <Text style={[styles.title, compact && { fontSize: 34, lineHeight: 40 }]}>{LOBBY.title}</Text>
          <Text style={styles.body}>{LOBBY.body}</Text>
        </Animated.View>

        <Animated.View entering={spotEnter(280, reduceMotion)}>
          <SpotGlass strong style={styles.panel}>
            <SpotButton label={t('login')} onPress={() => press(() => router.push('/(auth)/login'))} />
            <SpotButton
              label={LOBBY.createAccount}
              variant="glass"
              onPress={() => press(() => router.push('/(auth)/register'))}
            />
            <View style={styles.legalRow}>
              <Pressable accessibilityRole="link" onPress={() => openPolicy('privacy')} hitSlop={8} style={styles.legalHit}>
                <Text style={styles.legal}>{LOBBY.privacy}</Text>
              </Pressable>
              <Text style={styles.legalDot}>·</Text>
              <Pressable accessibilityRole="link" onPress={() => openPolicy('terms')} hitSlop={8} style={styles.legalHit}>
                <Text style={styles.legal}>{LOBBY.terms}</Text>
              </Pressable>
            </View>
          </SpotGlass>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050505' },
  stage: {
    flex: 1,
    paddingHorizontal: 22,
    justifyContent: 'flex-end',
  },
  brandRow: {
    position: 'absolute',
    top: 0,
    left: 22,
    right: 22,
    alignItems: 'center',
  },
  brand: {
    color: spot.ink,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 1.2,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  spacer: { flex: 1, minHeight: 120 },
  copy: {
    marginBottom: 18,
    gap: 10,
    paddingHorizontal: 2,
  },
  title: {
    color: spot.ink,
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1.1,
    lineHeight: 46,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 14,
  },
  body: {
    color: spot.muted,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    maxWidth: 340,
  },
  panel: {
    marginBottom: 4,
  },
  legalRow: {
    marginTop: 2,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  legalHit: { minHeight: 32, justifyContent: 'center' },
  legal: { color: spot.dim, fontSize: 12, fontWeight: '600' },
  legalDot: { color: spot.dim, fontSize: 12 },
});
