import { Text } from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { AppCard } from '@/components/ui/AppCard';
import { AppHeader } from '@/components/ui/AppHeader';
import { useT, type I18nKey } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';

const DUAS: { category: I18nKey; arabic: string; text: I18nKey; source: I18nKey }[] = [
  {
    category: 'duaMorning',
    arabic: 'أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ',
    text: 'duaMorningText',
    source: 'duaMorningSource',
  },
  {
    category: 'duaFood',
    arabic: 'بِسْمِ اللَّهِ',
    text: 'duaFoodText',
    source: 'duaFoodSource',
  },
  {
    category: 'duaProtect',
    arabic: 'أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ',
    text: 'duaProtectText',
    source: 'duaProtectSource',
  },
];

export default function DuasScreen() {
  const { colors } = useTheme();
  const t = useT();
  return (
    <Screen scroll>
      <AppHeader title={t('duas')} subtitle={t('duasSubtitle')} />
      <Text style={{ color: colors.textSecondary, lineHeight: 20 }}>{t('duasHint')}</Text>
      {DUAS.map((dua) => (
        <AppCard key={dua.arabic}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>{t(dua.category)}</Text>
          <Text style={{ color: colors.text, fontSize: 22, textAlign: 'right', writingDirection: 'rtl', marginVertical: 8 }}>{dua.arabic}</Text>
          <Text style={{ color: colors.text }}>{t(dua.text)}</Text>
          <Text style={{ color: colors.textSecondary, marginTop: 8 }}>{t(dua.source)}</Text>
        </AppCard>
      ))}
    </Screen>
  );
}
