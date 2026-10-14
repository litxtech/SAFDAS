import { Text } from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { AppCard } from '@/components/ui/AppCard';
import { AppHeader } from '@/components/ui/AppHeader';
import { dateLocale, useI18nStore, useT } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';

export default function CalendarScreen() {
  const { colors } = useTheme();
  const t = useT();
  const locale = useI18nStore((state) => state.locale);
  const now = new Date();
  const tag = dateLocale(locale);
  let hijri = t('hijriFailed');
  try {
    hijri = new Intl.DateTimeFormat(`${tag}-u-ca-islamic`, { day: 'numeric', month: 'long', year: 'numeric' }).format(now);
  } catch {
    hijri = t('hijriFailed');
  }
  return (
    <Screen scroll>
      <AppHeader title={t('calendar')} />
      <AppCard>
        <Text style={{ color: colors.textSecondary }}>{t('gregorian')}</Text>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700' }}>{now.toLocaleDateString(tag, { dateStyle: 'full' })}</Text>
        <Text style={{ color: colors.textSecondary, marginTop: 12 }}>{t('hijri')}</Text>
        <Text style={{ color: colors.primary, fontSize: 22, fontWeight: '700' }}>{hijri}</Text>
      </AppCard>
      <Text style={{ color: colors.textSecondary, lineHeight: 20 }}>{t('hijriHint')}</Text>
    </Screen>
  );
}
