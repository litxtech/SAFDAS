import { Text } from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { AppButton } from '@/components/ui/AppButton';
import { AppHeader } from '@/components/ui/AppHeader';
import { useT } from '@/i18n';
import { requireSupabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import type { ThemePreference } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

const OPTIONS: ThemePreference[] = ['light', 'dark', 'system'];

export default function ThemeSettings() {
  const t = useT();
  const { colors, preference } = useTheme();
  const setPreference = useThemeStore((state) => state.setPreference);
  const userId = useAuthStore((state) => state.session?.user.id);
  const labels: Record<ThemePreference, string> = { light: t('themeLight'), dark: t('themeDark'), system: t('themeSystem') };

  async function choose(value: ThemePreference) {
    setPreference(value);
    if (!userId) return;
    await requireSupabase().from('user_settings').upsert({ user_id: userId, theme: value });
  }

  return (
    <Screen scroll>
      <AppHeader title={t('theme')} subtitle={t('themeNoRestart')} />
      {OPTIONS.map((option) => (
        <AppButton key={option} label={labels[option]} variant={preference === option ? 'primary' : 'secondary'} onPress={() => void choose(option)} />
      ))}
      <Text style={{ color: colors.textSecondary }}>{t('themeStored')}</Text>
    </Screen>
  );
}
