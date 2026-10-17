import { createContext, useContext, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, type Href } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, runOnJS, useAnimatedReaction, useAnimatedStyle, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppAvatar } from '@/components/ui/AppAvatar';
import { isRtlLocale, useI18nStore, useT, type I18nKey } from '@/i18n';
import { setPendingSignupEmail } from '@/lib/pendingSignup';
import { requireSupabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/theme/ThemeProvider';

type DrawerApi = { open: () => void; close: () => void };

const DrawerContext = createContext<DrawerApi | null>(null);

export function useDrawer() {
  const value = useContext(DrawerContext);
  if (!value) throw new Error('useDrawer must be used within DrawerHost');
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

const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;

const GROUPS: { title: I18nKey; items: { title: I18nKey; icon: keyof typeof Ionicons.glyphMap; href: Href }[] }[] = [
  {
    title: 'drawerPrayer',
    items: [
      { title: 'prayerTimes', icon: 'time-outline', href: '/prayer' },
      { title: 'prayerTrack', icon: 'checkmark-circle-outline', href: '/prayer/track' },
      { title: 'qibla', icon: 'compass-outline', href: '/qibla' },
    ],
  },
  {
    title: 'drawerRead',
    items: [
      { title: 'quran', icon: 'book-outline', href: '/quran' },
      { title: 'duas', icon: 'heart-outline', href: '/duas' },
      { title: 'dhikr', icon: 'ellipse-outline', href: '/dhikr' },
      { title: 'dailyMsgOfDay', icon: 'sunny-outline', href: '/daily' },
      { title: 'dailyMsgHistory', icon: 'time-outline', href: '/daily/history' },
    ],
  },
  {
    title: 'drawerCalendar',
    items: [
      { title: 'ramadan', icon: 'moon-outline', href: '/ramadan' },
      { title: 'calendar', icon: 'calendar-outline', href: '/calendar' },
    ],
  },
  {
    title: 'drawerCommunity',
    items: [{ title: 'liveDiscoverTitle', icon: 'radio-outline', href: '/rooms' }],
  },
  {
    title: 'drawerSafety',
    items: [
      { title: 'safetyHubTitle', icon: 'shield-checkmark-outline', href: '/safety' },
      { title: 'myCases', icon: 'list-outline', href: '/safety/cases' },
      { title: 'childSafetyTitle', icon: 'shield-outline', href: '/safety/child' },
      { title: 'blockedAccounts', icon: 'ban-outline', href: '/settings/blocked' },
      { title: 'callSettings', icon: 'call-outline', href: '/settings/calls' },
      { title: 'settings', icon: 'settings-outline', href: '/settings' },
    ],
  },
];

function clamp(value: number, min: number, max: number) {
  'worklet';
  return Math.min(max, Math.max(min, value));
}

const EDGE = 22;

function useDrawerPan(
  progress: SharedValue<number>,
  widthSV: SharedValue<number>,
  rtlSV: SharedValue<number>,
  dragging: SharedValue<number>,
  rtl: boolean,
  open: boolean,
) {
  const origin = useSharedValue(0);
  const grabbed = useSharedValue(0);
  const pan = Gesture.Pan()
    .maxPointers(1)
    .activeOffsetX(open ? [-16, 16] : rtl ? -16 : 16)
    .failOffsetY([-16, 16])
    .onStart((event) => {
      cancelAnimation(progress);
      const signed = rtlSV.value ? -event.translationX : event.translationX;
      origin.value = progress.value;
      grabbed.value = signed;
      dragging.value = 1;
    })
    .onUpdate((event) => {
      const signed = rtlSV.value ? -event.translationX : event.translationX;
      progress.value = clamp(origin.value + (signed - grabbed.value) / Math.max(widthSV.value, 1), 0, 1);
    })
    .onEnd((event) => {
      const velocity = rtlSV.value ? -event.velocityX : event.velocityX;
      const next = velocity > 700 || (velocity > -700 && progress.value > 0.42);
      progress.value = withSpring(next ? 1 : 0, { ...SPRING, velocity: velocity / Math.max(widthSV.value, 1) });
    })
    .onFinalize(() => {
      dragging.value = 0;
    });
  if (!open) pan.hitSlop(rtl ? { right: 0, width: EDGE } : { left: 0, width: EDGE });
  return pan;
}

export function DrawerHost({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const rtl = isRtlLocale(useI18nStore((state) => state.locale));
  const reveal = Math.min(Math.round(width * 0.62), 420);
  const progress = useSharedValue(0);
  const widthSV = useSharedValue(reveal);
  const rtlSV = useSharedValue(rtl ? 1 : 0);
  const dragging = useSharedValue(0);
  const [chrome, setChrome] = useState({ open: false, touchable: false });
  const applyChrome = (open: boolean) => {
    setChrome((current) => (current.open === open ? current : { open, touchable: open }));
  };

  useEffect(() => {
    widthSV.value = reveal;
    rtlSV.value = rtl ? 1 : 0;
  }, [reveal, rtl, rtlSV, widthSV]);

  useAnimatedReaction(
    () => (dragging.value === 1 ? -1 : progress.value >= 0.99 ? 1 : progress.value <= 0.01 ? 0 : -1),
    (next, previous) => {
      if (next === -1 || next === previous) return;
      runOnJS(applyChrome)(next === 1);
    },
  );

  const pan = useDrawerPan(progress, widthSV, rtlSV, dragging, rtl, chrome.open);
  const scrimTap = Gesture.Tap().maxDistance(18).onEnd(() => {
    progress.value = withSpring(0, SPRING);
  });

  const api: DrawerApi = {
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
      transform: [
        { scale: 1 - p * 0.04 },
        { translateX: (rtlSV.value ? -1 : 1) * p * widthSV.value },
      ],
    };
  });
  const clipStyle = useAnimatedStyle(() => ({ borderRadius: progress.value * 32 }));

  return (
    <DrawerContext.Provider value={api}>
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View
          pointerEvents={chrome.touchable ? 'auto' : 'none'}
          style={[styles.drawer, rtl ? { right: 0 } : { left: 0 }, { width: reveal }]}
        >
          <DrawerPanel onNavigate={api.close} />
        </View>
        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.sheet, sheetStyle]}>
            <Animated.View style={[styles.clip, { backgroundColor: colors.background }, clipStyle]}>
              {children}
              <GestureDetector gesture={scrimTap}>
                <Animated.View pointerEvents={chrome.touchable ? 'auto' : 'none'} style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]} />
              </GestureDetector>
            </Animated.View>
          </Animated.View>
        </GestureDetector>
      </View>
    </DrawerContext.Provider>
  );
}

function DrawerPanel({ onNavigate }: { onNavigate: () => void }) {
  const { colors, name, reduceMotion } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const profile = useAuthStore((state) => state.profile);
  const userId = useAuthStore((state) => state.session?.user.id);
  const client = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const stats = useQuery({
    queryKey: ['profile-stats', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const db = requireSupabase();
      const [followers, following] = await Promise.all([
        db.from('follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', userId).eq('status', 'accepted'),
        db.from('follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', userId).eq('status', 'accepted'),
      ]);
      return { followers: followers.count ?? 0, following: following.count ?? 0 };
    },
  });
  const tracking = useQuery({
    queryKey: ['prayer-tracking', userId, today],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('prayer_tracking').select('prayer_name, status').eq('user_id', userId).eq('prayer_date', today);
      if (error) throw error;
      return data ?? [];
    },
  });

  function go(href: Href) {
    onNavigate();
    // Prefer navigate so drawer re-entry does not deepen the stack (e.g. Quran).
    router.navigate(href);
  }

  async function signOut() {
    onNavigate();
    if (!reduceMotion) void Haptics.selectionAsync();
    setPendingSignupEmail(null);
    await requireSupabase().auth.signOut();
    router.replace('/(auth)/welcome');
  }

  async function mark(prayer: string) {
    if (!userId) return;
    if (!reduceMotion) void Haptics.selectionAsync();
    const current = tracking.data?.find((row) => row.prayer_name === prayer)?.status;
    const status = current === 'prayed' ? 'unmarked' : 'prayed';
    const { error } = await requireSupabase().from('prayer_tracking').upsert(
      { user_id: userId, prayer_date: today, prayer_name: prayer, status },
      { onConflict: 'user_id,prayer_date,prayer_name' },
    );
    if (!error) void client.invalidateQueries({ queryKey: ['prayer-tracking', userId, today] });
  }

  const done = PRAYERS.filter((prayer) => tracking.data?.some((row) => row.prayer_name === prayer && row.status === 'prayed')).length;

  return (
    <View style={[styles.panel, { backgroundColor: colors.background, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => go('/profile')} style={styles.profile}>
          <AppAvatar uri={profile?.avatar_url} name={profile?.display_name} size={52} />
          <Text style={[styles.display, { color: colors.text }]} numberOfLines={1}>
            {profile?.display_name}
            {profile?.verified ? ' ✓' : ''}
          </Text>
          <Text style={{ color: colors.textSecondary }} numberOfLines={1}>@{profile?.username}</Text>
          <View style={styles.counts}>
            <Text style={{ color: colors.text }} onPress={() => go({ pathname: '/profile/follows', params: { mode: 'following' } })}>
              <Text style={styles.strong}>{stats.data?.following ?? 0}</Text> {t('followingCount')}
            </Text>
            <Text style={{ color: colors.text }} onPress={() => go({ pathname: '/profile/follows', params: { mode: 'followers' } })}>
              <Text style={styles.strong}>{stats.data?.followers ?? 0}</Text> {t('followers')}
            </Text>
          </View>
        </Pressable>
        <View style={styles.block}>
          <View style={styles.blockHead}>
            <Text style={[styles.section, { color: colors.textSecondary }]}>{t('dailyPrayer')}</Text>
            <Text style={{ color: colors.primary, fontWeight: '800' }}>{done}/5</Text>
          </View>
          <View style={styles.prayers}>
            {PRAYERS.map((prayer) => {
              const active = tracking.data?.some((row) => row.prayer_name === prayer && row.status === 'prayed');
              return (
                <Pressable
                  key={prayer}
                  accessibilityRole="button"
                  accessibilityLabel={t(prayer)}
                  onPress={() => void mark(prayer)}
                  style={[styles.prayer, { backgroundColor: active ? colors.primary : name === 'dark' ? 'rgba(255,255,255,0.06)' : colors.backgroundSecondary }]}
                >
                  <Text style={{ color: active ? colors.onPrimary : colors.text, fontSize: 11, fontWeight: '700' }} numberOfLines={1}>{t(prayer)}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        {GROUPS.map((group) => (
          <View key={group.title} style={styles.block}>
            <Text style={[styles.section, { color: colors.textSecondary }]}>{t(group.title)}</Text>
            {group.items.map((item) => (
              <Pressable key={item.title} accessibilityRole="button" onPress={() => go(item.href)} style={styles.row}>
                <Ionicons name={item.icon} size={22} color={colors.text} />
                <Text style={[styles.rowLabel, { color: colors.text }]}>{t(item.title)}</Text>
              </Pressable>
            ))}
          </View>
        ))}
        <View style={styles.block}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('signOut')}
            onPress={() => void signOut()}
            style={styles.row}
          >
            <Ionicons name="log-out-outline" size={22} color={colors.error} />
            <Text style={[styles.rowLabel, { color: colors.error }]}>{t('signOut')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  sheet: { flex: 1, zIndex: 2, shadowColor: '#000', shadowRadius: 24, shadowOffset: { width: -12, height: 0 } },
  clip: { flex: 1, overflow: 'hidden' },
  scrim: { backgroundColor: '#000000' },
  drawer: { position: 'absolute', top: 0, bottom: 0, zIndex: 1 },
  panel: { flex: 1 },
  scroll: { paddingHorizontal: 18, paddingBottom: 24, gap: 18 },
  profile: { gap: 4 },
  display: { fontSize: 20, fontWeight: '800', marginTop: 10 },
  counts: { flexDirection: 'row', gap: 16, marginTop: 8 },
  strong: { fontWeight: '800' },
  block: { gap: 2 },
  blockHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  section: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  prayers: { flexDirection: 'row', gap: 6 },
  prayer: { flex: 1, minHeight: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 48 },
  rowLabel: { fontSize: 17, fontWeight: '600' },
});
