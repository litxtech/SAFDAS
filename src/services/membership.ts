import { useQuery } from '@tanstack/react-query';
import { requireSupabase } from '@/lib/supabase';
import { activeGrantsFor, type OptimisticPlan } from '@/services/store/optimistic';
import { useAuthStore } from '@/stores/authStore';
import type { Locale } from '@/i18n';

/**
 * Public membership *badge* data.
 *
 * The database keeps receipts and transaction identifiers private. A
 * SECURITY DEFINER RPC (`public.profile_memberships`) exposes only the package
 * name, lifecycle status and dates so any signed-in member can see which plan
 * another account is using.
 */
export type MembershipPlanKey = 'nasip_plus' | 'seeker_plus' | 'employer_pro';
export type MembershipStatus = 'active' | 'grace' | 'cancelled';

export type ProfileMembershipPlan = {
  key: MembershipPlanKey;
  /** Server-provided brand name (NASİP PLUS, İŞ PLUS, İŞVEREN PRO). */
  name: string;
  status: MembershipStatus;
  startedAt: string | null;
  expiresAt: string | null;
  autoRenew: boolean;
};

export type MembershipPlanMeta = {
  key: MembershipPlanKey;
  name: string;
  icon: 'heart' | 'briefcase' | 'business';
  accent: string;
  tint: string;
  tagline: { tr: string; en: string };
  priceHint: { tr: string; en: string };
  benefits: { tr: string[]; en: string[] };
  route: string;
  params?: Record<string, string>;
  weight: number;
};

/** Red badge used for every paying membership, regardless of package. */
export const MEMBERSHIP_RED = '#FF2D55';

export const MEMBERSHIP_PLANS: Record<MembershipPlanKey, MembershipPlanMeta> = {
  employer_pro: {
    key: 'employer_pro',
    name: 'İŞVEREN PRO',
    icon: 'business',
    accent: '#F0B456',
    tint: 'rgba(240,180,86,0.16)',
    tagline: {
      tr: 'Profesyonel işe alım ve aday havuzu',
      en: 'Professional hiring and talent pool',
    },
    priceHint: { tr: 'Aylık abonelik', en: 'Monthly subscription' },
    benefits: {
      tr: [
        '10 aktif iş ilanı',
        'CV havuzuna erişim',
        'Ayda 50 doğrudan aday daveti',
        'Gelişmiş aday filtreleme',
        'Çoklu personel yetkilendirme',
        'İşe alım analizleri',
      ],
      en: [
        '10 active job listings',
        'Access to the CV pool',
        '50 direct candidate invitations / month',
        'Advanced candidate filtering',
        'Multiple staff roles',
        'Hiring analytics',
      ],
    },
    route: '/jobs/subscription',
    params: { product: 'employer_pro' },
    weight: 3,
  },
  seeker_plus: {
    key: 'seeker_plus',
    name: 'İŞ PLUS',
    icon: 'briefcase',
    accent: '#8B7BFF',
    tint: 'rgba(139,123,255,0.16)',
    tagline: {
      tr: 'Daha güçlü görünürlük ve kariyer araçları',
      en: 'Stronger visibility and career tools',
    },
    priceHint: { tr: 'Aylık abonelik', en: 'Monthly subscription' },
    benefits: {
      tr: [
        'Gelişmiş iş filtreleri',
        'Gelişmiş eşleşme analizleri',
        'Profesyonel profil görünürlüğü',
        'Ayda 10 doğrudan işveren iletişimi',
        'Ayrıntılı profil görüntülenme istatistikleri',
        'Gelişmiş CV analiz araçları',
      ],
      en: [
        'Advanced job filters',
        'Advanced match analysis',
        'Professional profile visibility',
        '10 direct employer messages / month',
        'Detailed profile view analytics',
        'Advanced CV analysis tools',
      ],
    },
    route: '/jobs/subscription',
    params: { product: 'seeker_plus' },
    weight: 2,
  },
  nasip_plus: {
    key: 'nasip_plus',
    name: 'NASİP PLUS',
    icon: 'heart',
    accent: '#FF5C8A',
    tint: 'rgba(255,92,138,0.16)',
    tagline: {
      tr: 'Evlilik yolculuğunda daha fazla görünürlük',
      en: 'More visibility on your marriage journey',
    },
    priceHint: { tr: 'Aylık abonelik', en: 'Monthly subscription' },
    benefits: {
      tr: [
        'Günde 20 tanışma isteği',
        'Gelişmiş arama filtreleri',
        'İlgi gösterenleri daha kapsamlı görme',
        'Genişletilmiş şehir ve ülke keşfi',
        'Gizli gezinme modu',
        'Gelişmiş karşılıklı tercih eşleştirmesi',
      ],
      en: [
        '20 introduction requests per day',
        'Advanced search filters',
        'A fuller view of people interested in you',
        'Expanded city and country discovery',
        'Invisible browsing',
        'Advanced mutual-preference matching',
      ],
    },
    route: '/nasip/subscription',
    weight: 1,
  },
};

export const MEMBERSHIP_PLAN_ORDER: MembershipPlanKey[] = ['nasip_plus', 'seeker_plus', 'employer_pro'];

type MembershipRpcRow = {
  member_id: string;
  plan_key: string;
  plan_name: string;
  member_status: string;
  started_at: string | null;
  expires_at: string | null;
  auto_renew: boolean;
};

function isPlanKey(value: string): value is MembershipPlanKey {
  return value === 'nasip_plus' || value === 'seeker_plus' || value === 'employer_pro';
}

function isStatus(value: string): value is MembershipStatus {
  return value === 'active' || value === 'grace' || value === 'cancelled';
}

export function membershipQueryKey(userIds: string[]) {
  return ['profile-memberships', [...userIds].sort()] as const;
}

/**
 * Returns active packages keyed by user id. Errors degrade quietly: an older
 * backend without the RPC should never break a profile screen or a feed.
 */
export async function fetchProfileMemberships(
  userIds: string[],
): Promise<Record<string, ProfileMembershipPlan[]>> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return {};

  const { data, error } = await requireSupabase().rpc('profile_memberships', { p_users: ids });
  if (error) {
    if (/profile_memberships|schema cache|does not exist|function/i.test(error.message)) return {};
    throw error;
  }

  const result: Record<string, ProfileMembershipPlan[]> = {};
  for (const row of (data ?? []) as MembershipRpcRow[]) {
    if (!row?.member_id || !row.plan_key || !isPlanKey(row.plan_key)) continue;
    if (!isStatus(row.member_status)) continue;
    const plan: ProfileMembershipPlan = {
      key: row.plan_key,
      name: row.plan_name,
      status: row.member_status,
      startedAt: row.started_at,
      expiresAt: row.expires_at,
      autoRenew: Boolean(row.auto_renew),
    };
    (result[row.member_id] ??= []).push(plan);
  }

  for (const plans of Object.values(result)) {
    plans.sort(
      (a, b) =>
        MEMBERSHIP_PLANS[b.key].weight - MEMBERSHIP_PLANS[a.key].weight ||
        String(b.expiresAt ?? '').localeCompare(String(a.expiresAt ?? '')),
    );
  }

  // A purchase completed on this device is credited immediately, before the
  // store verification reaches the server. The server row replaces it later.
  const selfId = useAuthStore.getState().session?.user.id;
  const selfPlans = selfId ? (result[selfId] ?? []) : [];
  if (selfId) {
    const known = new Set(selfPlans.map((plan) => plan.key));
    const optimistic = activeGrantsFor(selfId)
      .filter((grant) => !known.has(grant.plan as MembershipPlanKey))
      .map<ProfileMembershipPlan>((grant) => ({
        key: grant.plan as MembershipPlanKey,
        name: OPTIMISTIC_PLAN_NAMES[grant.plan as OptimisticPlan],
        status: 'active',
        startedAt: grant.grantedAt,
        expiresAt: grant.expiresAt,
        autoRenew: true,
      }))
      .sort((a, b) => MEMBERSHIP_PLANS[b.key].weight - MEMBERSHIP_PLANS[a.key].weight);
    if (optimistic.length > 0) {
      result[selfId] = [...selfPlans, ...optimistic];
    }
  }

  return result;
}

const OPTIMISTIC_PLAN_NAMES: Record<OptimisticPlan, string> = {
  nasip_plus: 'NASİP PLUS',
  seeker_plus: 'İŞ PLUS',
  employer_pro: 'İŞVEREN PRO',
};

export function useProfileMembership(userId: string | null | undefined, enabled = true) {
  const ids = userId ? [userId] : [];
  const query = useQuery({
    queryKey: membershipQueryKey(ids),
    enabled: Boolean(userId) && enabled,
    staleTime: 5 * 60_000,
    queryFn: () => fetchProfileMemberships(ids),
  });
  const plans = userId ? query.data?.[userId] ?? [] : [];
  return {
    plans,
    primary: plans[0] ?? null,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

export function membershipStatusKey(status: MembershipStatus) {
  if (status === 'grace') return 'membershipGrace';
  if (status === 'cancelled') return 'membershipCancelled';
  return 'membershipActive';
}

export function planBenefits(
  plan: { key: MembershipPlanKey } | MembershipPlanMeta | null | undefined,
  locale: Locale,
) {
  if (!plan) return [] as string[];
  const meta = MEMBERSHIP_PLANS[plan.key as MembershipPlanKey];
  if (!meta) return [] as string[];
  return locale === 'tr' ? meta.benefits.tr : meta.benefits.en;
}

export function planTagline(plan: { key: MembershipPlanKey } | MembershipPlanMeta, locale: Locale) {
  const meta = MEMBERSHIP_PLANS[plan.key];
  if (!meta) return '';
  return locale === 'tr' ? meta.tagline.tr : meta.tagline.en;
}

export function formatMembershipEnd(value: string | null | undefined, locale: Locale) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : locale === 'ar' ? 'ar-SA' : locale === 'es' ? 'es-ES' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}
