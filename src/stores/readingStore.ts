import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ReaderView = 'both' | 'arabic' | 'meal';
export type ContinueSpan = '30m' | '1h' | '2h' | '3h' | 'forever';

type ReadingState = {
  fontSize: number;
  mealSize: number;
  lineHeight: number;
  view: ReaderView;
  dockX: number;
  dockY: number;
  continueSpan: ContinueSpan;
  autoNextSurah: boolean;
  setFontSize: (size: number) => void;
  setMealSize: (size: number) => void;
  setLineHeight: (size: number) => void;
  setView: (view: ReaderView) => void;
  setDock: (x: number, y: number) => void;
  setContinueSpan: (span: ContinueSpan) => void;
  setAutoNextSurah: (enabled: boolean) => void;
};

function clampSize(size: number) {
  return Math.min(40, Math.max(18, size));
}

function clampUnit(value: number) {
  return Math.min(1, Math.max(0, value));
}

export const useReadingStore = create<ReadingState>()(
  persist(
    (set) => ({
      fontSize: 26,
      mealSize: 15,
      lineHeight: 1.85,
      view: 'both',
      dockX: 0.5,
      dockY: 0.82,
      continueSpan: 'forever',
      autoNextSurah: true,
      setFontSize: (size) => set({ fontSize: clampSize(size) }),
      setMealSize: (size) => set({ mealSize: Math.min(24, Math.max(13, size)) }),
      setLineHeight: (size) => set({ lineHeight: Math.min(2.4, Math.max(1.4, size)) }),
      setView: (view) => set({ view }),
      setDock: (dockX, dockY) => set({ dockX: clampUnit(dockX), dockY: clampUnit(dockY) }),
      setContinueSpan: (continueSpan) => set({ continueSpan }),
      setAutoNextSurah: (autoNextSurah) => set({ autoNextSurah }),
    }),
    {
      name: 'safdas-reading',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        fontSize: state.fontSize,
        mealSize: state.mealSize,
        lineHeight: state.lineHeight,
        view: state.view,
        dockX: state.dockX,
        dockY: state.dockY,
        continueSpan: state.continueSpan,
        autoNextSurah: state.autoNextSurah,
      }),
      merge: (persisted, current) => {
        const incoming = (persisted ?? {}) as Partial<ReadingState>;
        return {
          ...current,
          ...incoming,
          autoNextSurah: incoming.autoNextSurah ?? true,
          continueSpan: incoming.continueSpan ?? current.continueSpan,
        };
      },
    },
  ),
);
