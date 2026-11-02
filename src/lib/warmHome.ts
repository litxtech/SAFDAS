import { queryClient } from '@/lib/queryClient';

/** Prefetch feed + inbox without blocking UI. Safe to call multiple times. */
export function warmHomeInBackground(userId: string) {
  if (!userId) return;
  void import('@/services/feed')
    .then(({ fetchFeedPage }) =>
      queryClient.prefetchInfiniteQuery({
        queryKey: ['feed', 'discover', userId],
        initialPageParam: 0,
        queryFn: ({ pageParam }) => fetchFeedPage('discover', userId, pageParam),
      }),
    )
    .catch(() => undefined);
  void import('@/services/social')
    .then(({ fetchInbox }) =>
      queryClient.prefetchQuery({
        queryKey: ['conversations', userId],
        queryFn: () => fetchInbox(userId),
      }),
    )
    .catch(() => undefined);
  // Membership prices should be ready before the user opens a paywall.
  void import('@/services/store/priceCache')
    .then(({ warmStorePrices }) => warmStorePrices())
    .catch(() => undefined);
}
