import { AppState, Platform } from 'react-native';
import { onlineManager } from '@tanstack/react-query';
import { create } from 'zustand';

type NetworkState = {
  online: boolean;
  checkedAt: number;
  setOnline: (online: boolean) => void;
};

const PROBE_URLS = [
  'https://clients3.google.com/generate_204',
  'https://connectivitycheck.gstatic.com/generate_204',
];

export const useNetworkStore = create<NetworkState>((set) => ({
  online: true,
  checkedAt: 0,
  setOnline: (online) => {
    set({ online, checkedAt: Date.now() });
    onlineManager.setOnline(online);
  },
}));

async function probeOnce(timeoutMs = 2200): Promise<boolean> {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.onLine === false) {
    return false;
  }
  for (const url of PROBE_URLS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timer);
      return true;
    } catch {
      clearTimeout(timer);
    }
  }
  return false;
}

let probing = false;
let started = false;

export async function refreshNetworkStatus() {
  if (probing) return useNetworkStore.getState().online;
  probing = true;
  try {
    const online = await probeOnce();
    useNetworkStore.getState().setOnline(online);
    return online;
  } finally {
    probing = false;
  }
}

/** Call once from app root — keeps React Query + UI in sync with connectivity. */
export function startNetworkMonitoring() {
  if (started) return () => {};
  started = true;
  void refreshNetworkStatus();

  const appSub = AppState.addEventListener('change', (status) => {
    if (status === 'active') void refreshNetworkStatus();
  });

  const interval = setInterval(() => {
    if (AppState.currentState === 'active') void refreshNetworkStatus();
  }, 45_000);

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const onOnline = () => useNetworkStore.getState().setOnline(true);
    const onOffline = () => useNetworkStore.getState().setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      started = false;
      appSub.remove();
      clearInterval(interval);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }

  return () => {
    started = false;
    appSub.remove();
    clearInterval(interval);
  };
}

export function isOnline() {
  return useNetworkStore.getState().online;
}
