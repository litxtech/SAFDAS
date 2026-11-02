import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { NASIP_PRODUCT_IDS } from '@/services/nasip/constants';
import { JOB_STORE_PRODUCT_IDS } from '@/services/jobs/iap';

/**
 * The store (App Store / Google Play) owns the real price, but asking it takes
 * a network round-trip. The last confirmed price is cached so the membership
 * screens can render a price on the very first frame instead of a spinner.
 */

export type StorePlanKey = 'nasip_plus' | 'seeker_plus' | 'employer_pro';

type PriceEntry = { price: string; at: number };

type PriceState = {
  prices: Record<string, PriceEntry>;
  remember: (productId: string, price: string) => void;
};

export const useStorePriceStore = create<PriceState>()(
  persist(
    (set) => ({
      prices: {},
      remember: (productId, price) => {
        const id = productId?.trim();
        const label = price?.trim();
        if (!id || !label) return;
        set((state) => {
          if (state.prices[id]?.price === label) return state;
          return { prices: { ...state.prices, [id]: { price: label, at: Date.now() } } };
        });
      },
    }),
    {
      name: 'safdas-store-prices',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ prices: state.prices }),
    },
  ),
);

/** Target prices from the catalog. Only a first-paint fallback — the store price wins. */
export const STORE_PLAN_PRICES: Record<StorePlanKey, string> = {
  nasip_plus: '299,99 TL',
  seeker_plus: '149,99 TL',
  employer_pro: '499,99 TL',
};

export function storeProductIdFor(plan: StorePlanKey): string | null {
  if (plan === 'nasip_plus') {
    return Platform.OS === 'ios' ? NASIP_PRODUCT_IDS.ios : NASIP_PRODUCT_IDS.android;
  }
  const ids = JOB_STORE_PRODUCT_IDS[plan];
  return Platform.OS === 'ios' ? ids.ios : ids.android;
}

export function rememberStorePrice(productId: string | null | undefined, price: string | null | undefined) {
  if (!productId || !price) return;
  useStorePriceStore.getState().remember(productId, price);
}

/** Cached display price for a product id, if the store already answered once. */
export function cachedStorePrice(productId: string | null | undefined): string | null {
  if (!productId) return null;
  return useStorePriceStore.getState().prices[productId]?.price ?? null;
}

/** Instant price for a membership plan: cached store price, else the target label. */
export function storePlanPrice(plan: StorePlanKey): string {
  const id = storeProductIdFor(plan);
  return cachedStorePrice(id) ?? STORE_PLAN_PRICES[plan];
}

/** Reactive variant used by the membership screens. */
export function useStorePlanPrice(plan: StorePlanKey): string {
  const productId = storeProductIdFor(plan);
  const cached = useStorePriceStore((state) => (productId ? state.prices[productId]?.price : undefined));
  return cached ?? STORE_PLAN_PRICES[plan];
}

let warming: Promise<void> | null = null;

/**
 * Warms the price cache in the background. Safe to call from every screen: the
 * store connection and product fetch happen at most once per launch.
 */
export function warmStorePrices(): Promise<void> {
  if (warming) return warming;
  warming = (async () => {
    try {
      const { fetchNasipStoreProduct } = await import('@/services/nasip/iap');
      const product = await fetchNasipStoreProduct();
      rememberStorePrice(product?.id, product?.displayPrice);
    } catch {
      /* store unavailable — fallback labels stay visible */
    }
    try {
      const { fetchJobStoreProducts } = await import('@/services/jobs/iap');
      const ids = Object.values(JOB_STORE_PRODUCT_IDS).map((entry) =>
        Platform.OS === 'ios' ? entry.ios : entry.android,
      );
      const products = await fetchJobStoreProducts(ids);
      for (const product of products) rememberStorePrice(product.id, product.displayPrice);
    } catch {
      /* store unavailable — fallback labels stay visible */
    }
  })();
  return warming;
}
