import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { isSupabaseConfigured } from '@/lib/supabase';
import { isProfileComplete, useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/theme/ThemeProvider';

export default function Index() {
  const { colors } = useTheme();
  const ready = useAuthStore((state) => state.ready);
  const session = useAuthStore((state) => state.session);
  const profile = useAuthStore((state) => state.profile);

  if (!isSupabaseConfigured) return <Redirect href="/setup" />;
  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (!session) return <Redirect href="/(auth)/welcome" />;
  if (!isProfileComplete(profile)) return <Redirect href="/(auth)/complete-profile" />;
  return <Redirect href="/(tabs)" />;
}
