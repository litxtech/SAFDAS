import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { FadeInUp, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToastStore } from '@/stores/toastStore';
import { useTheme } from '@/theme/ThemeProvider';

export function AppToast() {
  const toast = useToastStore((state) => state.current);
  const hide = useToastStore((state) => state.hide);
  const { colors, reduceMotion } = useTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(hide, 2800);
    return () => clearTimeout(timer);
  }, [toast, hide]);

  if (!toast) return null;
  const background = toast.tone === 'success' ? colors.success : toast.tone === 'error' ? colors.error : colors.surfaceElevated;
  const color = toast.tone === 'info' ? colors.text : '#102018';
  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInUp}
      exiting={reduceMotion ? undefined : FadeOut}
      style={[styles.toast, { top: insets.top + 8, backgroundColor: background }]}
    >
      <Text style={{ color, fontWeight: '700' }}>{toast.message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 50,
    borderRadius: 16,
    padding: 14,
  },
});
