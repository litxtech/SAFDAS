import type { I18nKey } from '@/i18n';
import { childSafetyPolicy } from './childSafety';
import { privacyPolicy } from './privacy';
import { termsPolicy } from './terms';

export const POLICY_VERSION = '2026-10-14';

export const REQUIRED_POLICIES: { slug: 'safety' | 'terms' | 'privacy'; label: I18nKey; accept: I18nKey }[] = [
  { slug: 'safety', label: 'childSafetyPolicy', accept: 'acceptChildSafety' },
  { slug: 'terms', label: 'termsOfUse', accept: 'acceptTerms' },
  { slug: 'privacy', label: 'privacyPolicy', accept: 'acceptPrivacy' },
];

export const FULL_POLICIES: Record<string, string> = {
  safety: childSafetyPolicy,
  terms: termsPolicy,
  privacy: privacyPolicy,
};
