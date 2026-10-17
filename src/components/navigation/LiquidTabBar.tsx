import { useContext, useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { BottomTabBarHeightCallbackContext, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppAvatar } from '@/components/ui/AppAvatar';
import { useT } from '@/i18n';
import { fetchInbox, unreadInboxTotal } from '@/services/social';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/theme/ThemeProvider';

/** Instagram benzeri içerik yüksekliği (home indicator hariç) */
const BAR_H = 50;

const OUTLINE: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: 'home-outline',
  create: 'add-circle-outline',
  messages: 'chatbubble-ellipses-outline',
  profile: 'person-outline',
};

const FILLED: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: 'home',
  create: 'add-circle',
  messages: 'chatbubble-ellipses',
  profile: 'person',
};

export function LiquidTabBar({ state, navigation }: BottomTabBarProps) {
  const { colors, name } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const onHeightChange = useContext(BottomTabBarHeightCallbackContext);
  const profile = useAuthStore((s) => s.profile);
  const userId = useAuthStore((s) => s.session?.user.id);
  const [keyboard, setKeyboard] = useState(false);
  // Share the inbox query with the messages tab so opening chats is instant after first warm.
  const unread = useQuery({
    queryKey: ['conversations', userId],
    enabled: Boolean(userId),
    queryFn: () => fetchInbox(userId as string),
    select: unreadInboxTotal,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboard(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Navigatör bottom:0 — gerçek home indicator burada
  const bottom = insets.bottom;
  const height = BAR_H + bottom;

  useEffect(() => {
    onHeightChange?.(keyboard ? 0 : height);
  }, [height, keyboard, onHeightChange]);

  const labels: Record<string, string> = {
    index: t('home'),
    create: t('share'),
    messages: t('messages'),
    profile: t('profile'),
  };

  const routes = state.routes.filter((r) => r.name !== 'admin');
  const dark = name === 'dark';

  // iOS UITabBar: buzlu cam — blur baskın, yıkama çok hafif
  const wash = dark ? 'rgba(22, 22, 24, 0.28)' : 'rgba(248, 249, 252, 0.22)';
  const line = dark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(60, 60, 67, 0.18)';
  const on = colors.primary;
  const off = dark ? '#A8A8A8' : '#8E8E8E';
  const blurTint = dark
    ? Platform.OS === 'ios'
      ? 'systemChromeMaterialDark'
      : 'dark'
    : Platform.OS === 'ios'
      ? 'systemChromeMaterialLight'
      : 'light';
  const blurIntensity = Platform.OS === 'ios' ? 80 : 70;

  if (keyboard) return null;

  return (
    <View
      style={[styles.root, { height, backgroundColor: dark ? '#161618' : '#F8F9FC' }]}
      onLayout={(e) => onHeightChange?.(e.nativeEvent.layout.height)}
    >
      {/* Tek katman buz — altta ayrı kart/şerit yok */}
      <BlurView
        intensity={blurIntensity}
        tint={blurTint}
        experimentalBlurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: wash }]} />
      <View pointerEvents="none" style={[styles.hairline, { backgroundColor: line }]} />

      <View style={[styles.tabs, { height: BAR_H, paddingBottom: 0 }]}>
        {routes.map((route) => {
          const focused = state.routes[state.index]?.key === route.key;
          const isCreate = route.name === 'create';
          const isProfile = route.name === 'profile';
          const color = focused ? on : off;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={labels[route.name] ?? route.name}
              hitSlop={6}
              onPress={() => {
                if (isCreate) {
                  router.push('/post/create');
                  return;
                }
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              }}
              style={({ pressed }) => [styles.tab, pressed && { opacity: 0.55 }]}
            >
              {isProfile ? (
                <View style={[styles.avatarRing, focused && { borderColor: on }]}>
                  <AppAvatar uri={profile?.avatar_url} name={profile?.display_name} size={26} />
                </View>
              ) : (
                <View>
                  <Ionicons
                    name={focused ? FILLED[route.name] ?? 'ellipse' : OUTLINE[route.name] ?? 'ellipse-outline'}
                    size={26}
                    color={color}
                  />
                  {route.name === 'messages' && (unread.data ?? 0) > 0 ? (
                    <View style={[styles.dot, { backgroundColor: colors.primary, borderColor: dark ? '#161618' : '#F8F9FC' }]}>
                      {(unread.data ?? 0) > 9 ? null : (
                        <Text style={styles.dotText}>{unread.data}</Text>
                      )}
                    </View>
                  ) : null}
                </View>
              )}
              <Text style={[styles.label, { color }]} numberOfLines={1}>
                {labels[route.name]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ height: bottom }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    zIndex: 40,
    elevation: 40,
    margin: 0,
    padding: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  hairline: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    zIndex: 2,
  },
  tabs: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tab: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minWidth: 44,
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  avatarRing: {
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: 'transparent',
    padding: 1,
  },
  dot: {
    position: 'absolute',
    top: -3,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    paddingHorizontal: 3,
  },
  dotText: { color: '#fff', fontSize: 9, fontWeight: '700' },
});
