import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { InteractionManager } from 'react-native';
import { useAuthStore } from '@/stores/authStore';

type HostMod = { default?: ComponentType } & Record<string, ComponentType | undefined>;

const HOSTS: { path: () => Promise<HostMod>; exportName: string }[] = [
  { path: () => import('@/components/chat/ChatLive'), exportName: 'ChatLive' },
  { path: () => import('@/components/offline/OfflineBanner'), exportName: 'OfflineBanner' },
  { path: () => import('@/components/audio/MiniPlayer'), exportName: 'MiniPlayer' },
  { path: () => import('@/components/prayer/PrayerAlertSync'), exportName: 'PrayerAlertSync' },
  { path: () => import('@/components/daily/DailyMessageSync'), exportName: 'DailyMessageSync' },
  { path: () => import('@/components/share/ShareLinkSync'), exportName: 'ShareLinkSync' },
  { path: () => import('@/components/studio/StudioListenTracker'), exportName: 'StudioListenTracker' },
  { path: () => import('@/components/safety/ReportSheet'), exportName: 'ReportSheetHost' },
  { path: () => import('@/components/calls/CallHost'), exportName: 'CallHost' },
];

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * Mounts heavy realtime / media hosts one-by-one after first paint so Metro
 * (especially tunnel) does not OOM from 9 concurrent deferred bundles.
 */
export function DeferredHosts() {
  const ready = useAuthStore((state) => state.ready);
  const [nodes, setNodes] = useState<ReactNode[]>([]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    const task = InteractionManager.runAfterInteractions(() => {
      void (async () => {
        for (const host of HOSTS) {
          if (cancelled) return;
          try {
            const mod = await host.path();
            const Comp = mod[host.exportName] ?? mod.default;
            if (!Comp || cancelled) continue;
            setNodes((prev) => [...prev, <Comp key={host.exportName} />]);
          } catch {
            /* host optional at boot */
          }
          await sleep(350);
        }
      })();
    });

    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [ready]);

  if (!nodes.length) return null;
  return <>{nodes}</>;
}
