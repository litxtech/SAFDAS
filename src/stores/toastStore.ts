import { create } from 'zustand';

export type ToastTone = 'success' | 'error' | 'info';

type Toast = {
  id: number;
  message: string;
  tone: ToastTone;
};

type ToastState = {
  current: Toast | null;
  show: (message: string, tone?: ToastTone) => void;
  hide: () => void;
};

export const useToastStore = create<ToastState>((set) => ({
  current: null,
  show: (message, tone = 'info') => set({ current: { id: Date.now(), message, tone } }),
  hide: () => set({ current: null }),
}));
