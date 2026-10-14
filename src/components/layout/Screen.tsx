import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isRtlLocale, useI18nStore, useT } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  tabBar?: boolean;
  style?: ViewStyle;
};

export function Screen({ children, scroll, padded = true, tabBar, style }: Props) {
  const { colors } = useTheme();
  const t = useT();
  const rtl = isRtlLocale(useI18nStore((state) => state.locale));
  const insets = useSafeAreaInsets();
  const paddingBottom = (tabBar ? 108 : 24) + insets.bottom;
  const contentStyle = [padded && styles.pad, { paddingBottom }, style];
  const showBack = !tabBar && router.canGoBack();
  const body = scroll ? (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={contentStyle} showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, contentStyle]}>{children}</View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {showBack ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t('back')} onPress={() => router.back()} style={styles.back}>
          <Ionicons name={rtl ? 'chevron-forward' : 'chevron-back'} size={22} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: '700' }}>{t('back')}</Text>
        </Pressable>
      ) : null}
      {body}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 12, minHeight: 40 },
  pad: { paddingHorizontal: 16, paddingTop: 8, gap: 14 },
});
