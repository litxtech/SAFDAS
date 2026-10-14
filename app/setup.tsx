import { Text } from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { AppCard } from '@/components/ui/AppCard';
import { useT } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';

export default function SetupScreen() {
  const { colors } = useTheme();
  const t = useT();
  return (
    <Screen scroll>
      <Text style={{ color: colors.primary, fontWeight: '800', letterSpacing: 1 }}>{t('brand')}</Text>
      <Text style={{ color: colors.text, fontSize: 32, fontWeight: '700' }}>{t('setupRequired')}</Text>
      <AppCard>
        <Text style={{ color: colors.text, lineHeight: 22 }}>{t('setupBody')}</Text>
        <Text style={{ color: colors.textSecondary, marginTop: 12 }}>
          EXPO_PUBLIC_SUPABASE_URL{'\n'}EXPO_PUBLIC_SUPABASE_ANON_KEY
        </Text>
        <Text style={{ color: colors.textSecondary, marginTop: 12 }}>{t('setupSchema')}</Text>
      </AppCard>
    </Screen>
  );
}
