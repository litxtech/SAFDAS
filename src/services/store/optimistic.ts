import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { NasipEntitlements } from '@/services/nasip/types';
import type { JobEntitlements } from '@/services/jobs/types';
import { useAuthStore } from '@/stores/authStore';

/**
 * Optimistic membership grants.
 *
 * A store purchase is completed on the device before the server can verify the
 * receipt (verification may lag behind, or the backend may be temporarily
 * unreachable). The purchase has already been paid for at this point, so the
 * account is credited locally at once and the server confirmation simply
 * replaces the optimistic grant when it arrives.
 *
 * Grants are stored per account and always expire: a grant that is never
 * confirmed by the store disappears on its own.
 */

export type OptimisticPlan = 'nasip_plus' | 'seeker_plus' | 'employer_pro';

export type OptimisticGrant = {
  plan: OptimisticPlan;
  userId: string;
  orgId: string | null;
  grantedAt: string;
  expiresAt: string;
};

type GrantInput = {
  plan: OptimisticPlan;
  userId: string;
  orgId?: string | null;
  /** Paid period in months. Monthly plans use 1. */
  months?: number;
};

type OptimisticState = {
  grants: Record<string, OptimisticGrant>;
  grant: (input: GrantInput) => OptimisticGrant | null;
  clear: (userId: string, plan: OptimisticPlan, orgId?: string | null) => void;
  prune: () => void;
};

function grantKey(userId: string, plan: OptimisticPlan, orgId?: string | null) {
  return `${userId}:${plan}:${orgId ?? ''}`;
}

function periodEnd(months = 1) {
  const end = new Date();
  end.setMonth(end.getMonth() + Math.max(1, months));
  return end.toISOString();
}

export const useOptimisticMembershipStore = create<OptimisticState>()(
  persist(
    (set, get) => ({
      grants: {},
      grant: ({ plan, userId, orgId, months }) => {
        if (!userId) return null;
        const now = new Date();
        const next: OptimisticGrant = {
          plan,
          userId,
          orgId: orgId ?? null,
          grantedAt: now.toISOString(),
          expiresAt: periodEnd(months),
        };
        set((state) => ({ grants: { ...state.grants, [grantKey(userId, plan, orgId)]: next } }));
        return next;
      },
      clear: (userId, plan, orgId) => {
        if (!userId) return;
        const key = grantKey(userId, plan, orgId);
        set((state) => {
          if (!state.grants[key]) return state;
          const next = { ...state.grants };
          delete next[key];
          return { grants: next };
        });
      },
      prune: () => {
        const now = Date.now();
        const current = get().grants;
        const next: Record<string, OptimisticGrant> = {};
        let changed = false;
        for (const [key, grant] of Object.entries(current)) {
          const end = new Date(grant.expiresAt).getTime();
          if (Number.isFinite(end) && end > now) {
            next[key] = grant;
          } else {
            changed = true;
          }
        }
        if (changed) set({ grants: next });
      },
    }),
    {
      name: 'safdas-optimistic-memberships',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ grants: state.grants }),
      onRehydrateStorage: () => (state) => {
        state?.prune();
      },
    },
  ),
);

export function currentUserId(): string | null {
  return useAuthStore.getState().session?.user.id ?? null;
}

/** Active, unexpired grant for the given account/plan (optionally scoped to an org). */
export function activeGrant(
  userId: string | null | undefined,
  plan: OptimisticPlan,
  orgId?: string | null,
): OptimisticGrant | null {
  if (!userId) return null;
  const grant = useOptimisticMembershipStore.getState().grants[grantKey(userId, plan, orgId)];
  if (!grant) return null;
  const end = new Date(grant.expiresAt).getTime();
  if (!Number.isFinite(end) || end <= Date.now()) return null;
  return grant;
}

/** Credit a purchase to the account immediately. */
export function grantMembership(plan: OptimisticPlan, orgId?: string | null, months = 1) {
  const userId = currentUserId();
  if (!userId) return null;
  return useOptimisticMembershipStore.getState().grant({ plan, userId, orgId, months });
}

/** Drop the optimistic grant once the store verification is authoritative. */
export function clearMembershipGrant(plan: OptimisticPlan, orgId?: string | null, userId?: string | null) {
  const id = userId ?? currentUserId();
  if (!id) return;
  useOptimisticMembershipStore.getState().clear(id, plan, orgId);
}

export function activeGrantsFor(userId: string | null | undefined): OptimisticGrant[] {
  if (!userId) return [];
  const now = Date.now();
  return Object.values(useOptimisticMembershipStore.getState().grants).filter(
    (grant) => grant.userId === userId && new Date(grant.expiresAt).getTime() > now,
  );
}

const NASIP_PLUS_DAILY_REQUESTS = 20;
const JOB_PLUS_DIRECT_MESSAGES = 10;
const JOB_PRO_ACTIVE_LISTINGS = 10;
const JOB_PRO_DIRECT_INVITES = 50;

/** Blend a local, paid-for purchase into the server entitlements. */
export function mergeNasipEntitlements(
  data: NasipEntitlements,
  userId?: string | null,
): NasipEntitlements {
  const grant = activeGrant(userId ?? currentUserId(), 'nasip_plus');
  if (!grant || data.is_plus) return data;
  const limit = Math.max(Number(data.daily_request_limit) || 0, NASIP_PLUS_DAILY_REQUESTS);
  const used = Math.max(0, Number(data.requests_used_today) || 0);
  return {
    ...data,
    is_plus: true,
    daily_request_limit: limit,
    requests_remaining: Math.max(0, limit - used),
    subscription:
      data.subscription ??
      ({
        id: `optimistic-${grant.grantedAt}`,
        platform: 'manual',
        product: 'plus',
        product_id: null,
        status: 'active',
        environment: 'production',
        started_at: grant.grantedAt,
        expires_at: grant.expiresAt,
        auto_renew: true,
        price_amount: null,
        currency: null,
      } as NasipEntitlements['subscription']),
  };
}

/** Blend a local, paid-for purchase into the job entitlements. */
export function mergeJobEntitlements(
  data: JobEntitlements,
  orgId?: string | null,
  userId?: string | null,
): JobEntitlements {
  const id = userId ?? currentUserId();
  const seeker = activeGrant(id, 'seeker_plus');
  const pro = activeGrant(id, 'employer_pro', orgId);
  if (!seeker && !pro) return data;
  const limits = { ...data.limits };
  if (seeker) {
    limits.direct_messages = Math.max(Number(limits.direct_messages) || 0, JOB_PLUS_DIRECT_MESSAGES);
  }
  if (pro) {
    limits.active_listings = Math.max(Number(limits.active_listings) || 0, JOB_PRO_ACTIVE_LISTINGS);
    limits.direct_invites = Math.max(Number(limits.direct_invites) || 0, JOB_PRO_DIRECT_INVITES);
  }
  return {
    ...data,
    seeker_plus: data.seeker_plus || Boolean(seeker),
    employer_pro: data.employer_pro || Boolean(pro),
    free_mode: false,
    limits,
  };
}

/** Store product id is platform specific; kept here to avoid a circular import. */
export function platformProductId(ios: string | null | undefined, android: string | null | undefined) {
  return (Platform.OS === 'ios' ? ios : android) ?? null;
}
