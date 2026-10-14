import { Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/layout/Screen';
import { AppHeader } from '@/components/ui/AppHeader';
import { FULL_POLICIES } from '@/content/policies';
import { useT, type I18nKey } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';

const FULL_TITLES: Record<string, I18nKey> = {
  safety: 'childSafetyPolicy',
  terms: 'termsOfUse',
  privacy: 'privacyPolicy',
};

const DOCS: Record<string, { title: I18nKey; body: I18nKey }> = {
  privacy: { title: 'privacyDocTitle', body: 'privacyDocBody' },
  terms: { title: 'termsDocTitle', body: 'termsDocBody' },
  community: { title: 'communityDocTitle', body: 'communityDocBody' },
  safety: { title: 'safetyDocTitle', body: 'safetyDocBody' },
  deletion: { title: 'deletionDocTitle', body: 'deletionDocBody' },
};

export default function LegalScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const key = typeof slug === 'string' ? slug : 'privacy';
  const { colors } = useTheme();
  const t = useT();
  const full = FULL_POLICIES[key];
  if (full) {
    return (
      <Screen scroll>
        <AppHeader title={t(FULL_TITLES[key] ?? 'policies')} subtitle={`${t('policyUpdated')} · ${t('legalCompany')}`} />
        <Text selectable style={{ color: colors.text, fontSize: 15, lineHeight: 24 }}>{full}</Text>
      </Screen>
    );
  }
  const doc = DOCS[key];
  return (
    <Screen scroll>
      <AppHeader title={doc ? t(doc.title) : t('documentFallback')} subtitle={t('legalCompany')} />
      <Text selectable style={{ color: colors.text, fontSize: 16, lineHeight: 24 }}>{doc ? t(doc.body) : ''}</Text>
    </Screen>
  );
}
