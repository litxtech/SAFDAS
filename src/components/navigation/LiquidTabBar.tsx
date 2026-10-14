import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppBottomSheet } from '@/components/ui/AppBottomSheet';
import { useT, type I18nKey } from '@/i18n';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/theme/ThemeProvider';

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: 'home-outline',
  worship: 'moon-outline',
  create: 'add',
  messages: 'chatbubble-ellipses-outline',
  profile: 'person-outline',
  admin: 'shield-outline',
};

const CREATE_OPTIONS: { label: I18nKey; href: Href; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: 'createPostMenu', href: '/post/create', icon: 'create-outline' },
  { label: 'sharePhoto', href: { pathname: '/post/create', params: { type: 'photo' } }, icon: 'image-outline' },
  { label: 'shareVideo', href: { pathname: '/post/create', params: { type: 'video' } }, icon: 'videocam-outline' },
  { label: 'shareAyah', href: { pathname: '/post/create', params: { type: 'ayah' } }, icon: 'book-outline' },
  { label: 'shareDua', href: { pathname: '/post/create', params: { type: 'dua' } }, icon: 'heart-outline' },
];

export function LiquidTabBar({ state, navigation }: BottomTabBarProps) {
  const { colors, name } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const isStaff = useAuthStore((store) => store.isStaff);
  const [open, setOpen] = useState(false);
  const labels: Record<string, string> = {
    index: t('home'),
    worship: t('worship'),
    create: t('share'),
    messages: t('messages'),
    profile: t('profile'),
    admin: t('admin'),
  };
  const routes = state.routes.filter((route) => (isStaff ? route.name !== 'create' : route.name !== 'admin'));

  return (
    <>
      <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom, 10) }]}>
        <View style={[styles.bar, { borderColor: colors.tabBarBorder, backgroundColor: colors.tabBar }]}>
          <BlurView intensity={Platform.OS === 'ios' ? 48 : 18} tint={name === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          {routes.map((route) => {
            const focused = state.routes[state.index]?.key === route.key;
            const isCreate = route.name === 'create';
            const color = focused ? colors.primary : colors.iconMuted;
            const outline = ICONS[route.name] ?? 'ellipse-outline';
            const iconName = (focused ? outline.replace('-outline', '') : outline) as keyof typeof Ionicons.glyphMap;
            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityLabel={labels[route.name] ?? route.name}
                onPress={() => {
                  if (isCreate) {
                    setOpen(true);
                    return;
                  }
                  navigation.navigate(route.name);
                }}
                style={styles.item}
              >
                {isCreate ? (
                  <View style={[styles.share, { backgroundColor: colors.primary }]}>
                    <Ionicons name="add" size={28} color={colors.onPrimary} />
                  </View>
                ) : (
                  <>
                    <Ionicons name={iconName} size={22} color={color} />
                    <Text style={{ color, fontSize: 11, fontWeight: '600' }}>{labels[route.name]}</Text>
                  </>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
      <AppBottomSheet visible={open} title={t('share')} onClose={() => setOpen(false)}>
        {CREATE_OPTIONS.map((option) => (
          <Pressable
            key={option.label}
            style={styles.option}
            onPress={() => {
              setOpen(false);
              router.push(option.href);
            }}
          >
            <Ionicons name={option.icon} size={20} color={colors.primary} />
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>{t(option.label)}</Text>
          </Pressable>
        ))}
      </AppBottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16 },
  bar: {
    height: 68,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 48 },
  share: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginTop: -18 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
});
