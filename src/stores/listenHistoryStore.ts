import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type RecentListen = {
  surahNumber: number;
  ayahInSurah: number;
  listenedAt: number;
};

const LIMIT = 20;

type ListenState = {
  items: RecentListen[];
  remember: (entry: { surahNumber: number; ayahInSurah: number }) => void;
};

function newerFirst(items: RecentListen[]) {
  const bySurah = new Map<number, RecentListen>();
  for (const item of items) {
    if (!Number.isFinite(item.surahNumber) || !Number.isFinite(item.ayahInSurah)) continue;
    const existing = bySurah.get(item.surahNumber);
    if (!existing || item.listenedAt > existing.listenedAt) bySurah.set(item.surahNumber, item);
  }
  return [...bySurah.values()].sort((a, b) => b.listenedAt - a.listenedAt).slice(0, LIMIT);
}

export const useListenHistory = create<ListenState>()(
  persist(
    (set) => ({
      items: [],
      remember: (entry) =>
        set((state) => {
          const head = state.items[0];
          if (head?.surahNumber === entry.surahNumber && head.ayahInSurah === entry.ayahInSurah) return state;
          return {
            items: newerFirst([
              { surahNumber: entry.surahNumber, ayahInSurah: entry.ayahInSurah, listenedAt: Date.now() },
              ...state.items,
            ]),
          };
        }),
    }),
    {
      name: 'safdas-listens',
      storage: createJSONStorage(() => AsyncStorage),
      merge: (persisted, current) => {
        const saved = (persisted as Partial<ListenState> | undefined)?.items ?? [];
        return { ...current, items: newerFirst([...saved, ...current.items]) };
      },
    },
  ),
);

export function rememberQuranListen(entry: { surahNumber: number; ayahInSurah: number }) {
  useListenHistory.getState().remember(entry);
}
