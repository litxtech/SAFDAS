import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { useUsageStore } from '@/stores/usageStore';

const CHECKPOINT_MS = 45_000;

/**
 * Tracks real foreground time (AppState === 'active') per signed-in user.
 * Mount once near the root so cold-start and login screens also count.
 */
export function UsageTracker() {
  const userId = useAuthStore((state) => state.session?.user.id ?? null);
  const resume = useUsageStore((state) => state.resume);
  const pause = useUsageStore((state) => state.pause);
  const checkpoint = useUsageStore((state) => state.checkpoint);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (AppState.currentState === 'active') {
      resume(userId);
    } else {
      pause();
    }
  }, [userId, resume, pause]);

  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      const prev = appState.current;
      appState.current = next;
      if (next === 'active' && prev !== 'active') {
        resume(useAuthStore.getState().session?.user.id ?? null);
        return;
      }
      if (next !== 'active' && prev === 'active') {
        pause();
      }
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => {
      sub.remove();
      // Bank time when the tracker unmounts (rare) so nothing is lost.
      useUsageStore.getState().pause();
    };
  }, [resume, pause]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') checkpoint();
    }, CHECKPOINT_MS);
    return () => clearInterval(timer);
  }, [checkpoint]);

  return null;
}
