import { useEffect, useState, type ReactNode } from 'react';
import { InteractionManager } from 'react-native';
import { useAuthStore } from '@/stores/authStore';

/**
 * Mounts heavy realtime / media hosts after first interactions so cold start
 * is not blocked on CallHost, ChatLive, prayer sync, etc.
 */
export function DeferredHosts() {
  const ready = useAuthStore((state) => state.ready);
  const [mount, setMount] = useState(false);
  const [Hosts, setHosts] = useState<null | (() => ReactNode)>(null);

  useEffect(() => {
    if (!ready || mount) return;
    const task = InteractionManager.runAfterInteractions(() => {
      void Promise.all([
        import('@/components/chat/ChatLive'),
        import('@/components/calls/CallHost'),
        import('@/components/prayer/PrayerAlertSync'),
        import('@/components/audio/MiniPlayer'),
        import('@/components/safety/ReportSheet'),
        import('@/components/daily/DailyMessageSync'),
        import('@/components/share/ShareLinkSync'),
      ]).then(([chat, calls, prayer, audio, safety, daily, share]) => {
        setHosts(() => () => (
          <>
            <chat.ChatLive />
            <calls.CallHost />
            <prayer.PrayerAlertSync />
            <audio.MiniPlayer />
            <safety.ReportSheetHost />
            <daily.DailyMessageSync />
            <share.ShareLinkSync />
          </>
        ));
        setMount(true);
      });
    });
    return () => task.cancel();
  }, [ready, mount]);

  if (!Hosts) return null;
  return <Hosts />;
}
