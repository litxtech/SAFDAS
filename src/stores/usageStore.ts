import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export const USAGE_GUEST_KEY = 'guest';

type UsageState = {
  /** Accumulated foreground milliseconds per account (or guest). */
  totals: Record<string, number>;
  /** When the current foreground session began (epoch ms), or null if paused. */
  activeStartedAt: number | null;
  /** Which account the open session belongs to. */
  activeKey: string;
  /** Start or switch the live session for this account. */
  resume: (userKey?: string | null) => void;
  /** Flush open time into totals and pause. */
  pause: () => void;
  /** Commit open time into totals without pausing (periodic save). */
  checkpoint: () => void;
  /** Stored + live session ms for a user. */
  getTotalMs: (userKey?: string | null) => number;
};

function keyOf(userKey?: string | null) {
  return userKey && userKey.length > 0 ? userKey : USAGE_GUEST_KEY;
}

function flushOpen(state: Pick<UsageState, 'totals' | 'activeStartedAt' | 'activeKey'>, now = Date.now()) {
  if (state.activeStartedAt == null) {
    return { totals: state.totals, activeStartedAt: null as number | null };
  }
  const elapsed = Math.max(0, now - state.activeStartedAt);
  if (elapsed < 1) {
    return { totals: state.totals, activeStartedAt: state.activeStartedAt };
  }
  const key = state.activeKey;
  return {
    totals: { ...state.totals, [key]: (state.totals[key] ?? 0) + elapsed },
    activeStartedAt: now as number | null,
  };
}

export const useUsageStore = create<UsageState>()(
  persist(
    (set, get) => ({
      totals: {},
      activeStartedAt: null,
      activeKey: USAGE_GUEST_KEY,

      resume: (userKey) => {
        const nextKey = keyOf(userKey);
        const state = get();
        const now = Date.now();
        // Switching accounts: bank previous session first.
        if (state.activeStartedAt != null && state.activeKey !== nextKey) {
          const banked = flushOpen(state, now);
          set({
            totals: banked.totals,
            activeKey: nextKey,
            activeStartedAt: now,
          });
          return;
        }
        if (state.activeStartedAt != null && state.activeKey === nextKey) return;
        set({ activeKey: nextKey, activeStartedAt: now });
      },

      pause: () => {
        const state = get();
        if (state.activeStartedAt == null) return;
        const now = Date.now();
        const elapsed = Math.max(0, now - state.activeStartedAt);
        const key = state.activeKey;
        set({
          totals: { ...state.totals, [key]: (state.totals[key] ?? 0) + elapsed },
          activeStartedAt: null,
        });
      },

      checkpoint: () => {
        const state = get();
        if (state.activeStartedAt == null) return;
        const next = flushOpen(state);
        set({ totals: next.totals, activeStartedAt: next.activeStartedAt });
      },

      getTotalMs: (userKey) => {
        const state = get();
        const key = keyOf(userKey);
        const stored = state.totals[key] ?? 0;
        if (state.activeStartedAt != null && state.activeKey === key) {
          return stored + Math.max(0, Date.now() - state.activeStartedAt);
        }
        return stored;
      },
    }),
    {
      name: 'safdas-app-usage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        totals: state.totals,
        // Never persist an open session clock — resume fresh on next launch.
        activeKey: state.activeKey,
      }),
    },
  ),
);

/** Whole hours + remaining minutes from milliseconds. */
export function splitUsage(ms: number) {
  const safe = Math.max(0, Math.floor(ms));
  const totalMinutes = Math.floor(safe / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return { hours, minutes, totalMinutes };
}

/** Compact label like `3 sa 12 dk` — caller supplies translated unit words. */
export function formatUsageParts(
  ms: number,
  labels: { hours: string; minutes: string },
) {
  const { hours, minutes } = splitUsage(ms);
  if (hours <= 0 && minutes <= 0) return `0 ${labels.minutes}`;
  if (hours <= 0) return `${minutes} ${labels.minutes}`;
  if (minutes <= 0) return `${hours} ${labels.hours}`;
  return `${hours} ${labels.hours} ${minutes} ${labels.minutes}`;
}
