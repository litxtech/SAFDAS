import { router } from 'expo-router';
import { Screen } from '@/components/layout/Screen';
import { AppHeader } from '@/components/ui/AppHeader';
import { LinkRow } from '@/components/ui/LinkRow';
import { useT, type I18nKey } from '@/i18n';

const DOCS: { slug: string; label: I18nKey }[] = [
  { slug: 'terms', label: 'termsOfUse' },
  { slug: 'privacy', label: 'privacyPolicy' },
  { slug: 'community', label: 'communityRules' },
  { slug: 'safety', label: 'childSafetyPolicy' },
  { slug: 'deletion', label: 'accountDeletion' },
];

export default function LegalIndex() {
  const t = useT();
  return (
    <Screen scroll>
      <AppHeader title={t('policies')} subtitle={`${t('legalCompany')} · support@litxtech.com`} />
      {DOCS.map((doc) => (
        <LinkRow key={doc.slug} icon="document-text-outline" label={t(doc.label)} onPress={() => router.push({ pathname: '/legal/[slug]', params: { slug: doc.slug } })} />
      ))}
    </Screen>
  );
}
