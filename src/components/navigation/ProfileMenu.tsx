import { createContext, useContext, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, type Href } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppUsageBadge } from '@/components/usage/AppUsageBadge';
import { useT, type I18nKey } from '@/i18n';
import { setPendingSignupEmail } from '@/lib/pendingSignup';
import { requireSupabase } from '@/lib/supabase';
import { shareProfile } from '@/services/share';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/theme/ThemeProvider';

type MenuApi = { open: () => void; close: () => void };

const ProfileMenuContext = createContext<MenuApi | null>(null);

export function useProfileMenu() {
  const value = useContext(ProfileMenuContext);
  if (!value) throw new Error('useProfileMenu must be used within ProfileMenuHost');
  return value;
}

const SPRING = {
  damping: 28,
  stiffness: 320,
  mass: 0.7,
  overshootClamping: true,
  restDisplacementThreshold: 0.01,
  restSpeedThreshold: 0.01,
};

const EDGE = 22;

type MenuItem = {
  title: I18nKey;
  icon: keyof typeof Ionicons.glyphMap;
  href?: Href;
  action?: 'share' | 'signOut';
  danger?: boolean;
  staffOnly?: boolean;
};

const ITEMS: MenuItem[] = [
  { title: 'editProfile', icon: 'create-outline', href: '/profile/edit' },
  { title: 'shareProfile', icon: 'share-outline', action: 'share' },
  { title: 'saved', icon: 'bookmark-outline', href: '/saved' },
  { title: 'settings', icon: 'settings-outline', href: '/settings' },
  { title: 'admin', icon: 'shield-outline', href: '/admin', staffOnly: true },
  { title: 'signOut', icon: 'log-out-outline', action: 'signOut', danger: true },
];

function clamp(value: number, min: number, max: number) {
  'worklet';
  return Math.min(max, Math.max(min, value));
}

/** Right-edge drawer: swipe left to open, swipe right to close. */
function useRightDrawerPan(
  progress: SharedValue<number>,
  widthSV: SharedValue<number>,
  dragging: SharedValue<number>,
  open: boolean,
) {
  const origin = useSharedValue(0);
  const grabbed = useSharedValue(0);
  const pan = Gesture.Pan()
    .maxPointers(1)
    .activeOffsetX(open ? [-16, 16] : -16)
    .failOffsetY([-16, 16])
    .onStart((event) => {
      cancelAnimation(progress);
      // Opening from the right: leftward drag increases progress.
      const signed = -event.translationX;
      origin.value = progress.value;
      grabbed.value = signed;
      dragging.value = 1;
    })
    .onUpdate((event) => {
      const signed = -event.translationX;
      progress.value = clamp(origin.value + (signed - grabbed.value) / Math.max(widthSV.value, 1), 0, 1);
    })
    .onEnd((event) => {
      const velocity = -event.velocityX;
      const next = velocity > 700 || (velocity > -700 && progress.value > 0.42);
      progress.value = withSpring(next ? 1 : 0, { ...SPRING, velocity: velocity / Math.max(widthSV.value, 1) });
    })
    .onFinalize(() => {
      dragging.value = 0;
    });
  if (!open) pan.hitSlop({ right: 0, width: EDGE });
  return pan;
}

export function ProfileMenuHost({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const reveal = Math.min(Math.round(width * 0.72), 360);
  const progress = useSharedValue(0);
  const widthSV = useSharedValue(reveal);
  const dragging = useSharedValue(0);
  const [chrome, setChrome] = useState({ open: false, touchable: false });
  const applyChrome = (open: boolean) => {
    setChrome((current) => (current.open === open ? current : { open, touchable: open }));
  };

  useEffect(() => {
    widthSV.value = reveal;
  }, [reveal, widthSV]);

  useAnimatedReaction(
    () => (dragging.value === 1 ? -1 : progress.value >= 0.99 ? 1 : progress.value <= 0.01 ? 0 : -1),
    (next, previous) => {
      if (next === -1 || next === previous) return;
      runOnJS(applyChrome)(next === 1);
    },
  );

  const pan = useRightDrawerPan(progress, widthSV, dragging, chrome.open);
  const scrimTap = Gesture.Tap()
    .maxDistance(18)
    .onEnd(() => {
      progress.value = withSpring(0, SPRING);
    });

  const api: MenuApi = {
    open: () => {
      progress.value = withSpring(1, SPRING);
    },
    close: () => {
      progress.value = withSpring(0, SPRING);
    },
  };

  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.value * 0.18 }));
  const sheetStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      shadowOpacity: p * 0.22,
      elevation: p * 12,
      transform: [{ scale: 1 - p * 0.04 }, { translateX: -p * widthSV.value }],
    };
  });
  const clipStyle = useAnimatedStyle(() => ({ borderRadius: progress.value * 32 }));

  return (
    <ProfileMenuContext.Provider value={api}>
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View pointerEvents={chrome.touchable ? 'auto' : 'none'} style={[styles.drawer, { width: reveal }]}>
          <ProfileMenuPanel onNavigate={api.close} />
        </View>
        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.sheet, sheetStyle]}>
            <Animated.View style={[styles.clip, { backgroundColor: colors.background }, clipStyle]}>
              {children}
              <GestureDetector gesture={scrimTap}>
                <Animated.View
                  pointerEvents={chrome.touchable ? 'auto' : 'none'}
                  style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]}
                />
              </GestureDetector>
            </Animated.View>
          </Animated.View>
        </GestureDetector>
      </View>
    </ProfileMenuContext.Provider>
  );
}

function ProfileMenuPanel({ onNavigate }: { onNavigate: () => void }) {
  const { colors, reduceMotion } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const profile = useAuthStore((state) => state.profile);
  const isStaff = useAuthStore((state) => state.isStaff);

  function go(href: Href) {
    onNavigate();
    router.navigate(href);
  }

  async function share() {
    onNavigate();
    if (!profile?.id) return;
    await shareProfile({
      id: profile.id,
      displayName: profile.display_name,
      username: profile.username,
      bio: profile.bio,
    });
  }

  async function signOut() {
    onNavigate();
    if (!reduceMotion) void Haptics.selectionAsync();
    setPendingSignupEmail(null);
    await requireSupabase().auth.signOut();
    router.replace('/(auth)/welcome');
  }

  function onItem(item: MenuItem) {
    if (item.action === 'share') {
      void share();
      return;
    }
    if (item.action === 'signOut') {
      void signOut();
      return;
    }
    if (item.href) go(item.href);
  }

  const visible = ITEMS.filter((item) => !item.staffOnly || isStaff);

  return (
    <View
      style={[
        styles.panel,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 16,
        },
      ]}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={[styles.heading, { color: colors.text }]}>{t('profile')}</Text>
        <AppUsageBadge variant="card" />
        <View style={styles.block}>
          {visible.map((item, index) => (
            <Pressable
              key={item.title}
              accessibilityRole="button"
              accessibilityLabel={t(item.title)}
              onPress={() => onItem(item)}
              style={[
                styles.row,
                index < visible.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: colors.divider,
                },
              ]}
            >
              <Ionicons name={item.icon} size={22} color={item.danger ? colors.error : colors.text} />
              <Text style={[styles.rowLabel, { color: item.danger ? colors.error : colors.text }]}>{t(item.title)}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  sheet: {
    flex: 1,
    zIndex: 2,
    shadowColor: '#000',
    shadowRadius: 24,
    shadowOffset: { width: 12, height: 0 },
  },
  clip: { flex: 1, overflow: 'hidden' },
  scrim: { backgroundColor: '#000000' },
  drawer: { position: 'absolute', top: 0, bottom: 0, right: 0, zIndex: 1 },
  panel: { flex: 1 },
  scroll: { paddingHorizontal: 18, paddingBottom: 24, gap: 18 },
  heading: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  block: { gap: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 52 },
  rowLabel: { fontSize: 17, fontWeight: '600', flex: 1 },
});
