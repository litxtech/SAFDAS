import { Platform } from 'react-native';
import type { ProductSubscription, Purchase } from 'expo-iap';

export const JOB_IAP_SUPPORTED = Platform.OS === 'ios' || Platform.OS === 'android';
const ANDROID_PACKAGE = 'com.litxtech.namazim';

/**
 * Canonical store product ids. The database may override them, but a purchase
 * must never be blocked because the product row is missing: these are the ids
 * created in App Store Connect / Google Play Console.
 */
export const JOB_STORE_PRODUCT_IDS = {
  seeker_plus: {
    ios: 'com.litxtech.namazim.jobs.seeker.plus.monthly',
    android: 'jobs_seeker_plus_monthly',
  },
  employer_pro: {
    ios: 'com.litxtech.namazim.jobs.employer.pro.monthly',
    android: 'jobs_employer_pro_monthly',
  },
} as const;

export function jobStoreProductId(key: 'seeker_plus' | 'employer_pro'): string {
  const ids = JOB_STORE_PRODUCT_IDS[key];
  return Platform.OS === 'ios' ? ids.ios : ids.android;
}

type IapModule = typeof import('expo-iap');

let iapModule: IapModule | null = null;
let iapPromise: Promise<IapModule | null> | null = null;

// Loaded lazily so a store module missing from the installed native build
// cannot break the expo-router tree at import time ("Unmatched Route").
function loadIap(): Promise<IapModule | null> {
  if (!iapPromise) {
    iapPromise = import('expo-iap')
      .then((mod) => {
        iapModule = mod;
        return mod;
      })
      .catch(() => null);
  }
  return iapPromise;
}

async function requireIap(): Promise<IapModule> {
  const mod = await loadIap();
  if (!mod) throw new Error('iap_unavailable');
  return mod;
}

let connected = false;

async function ensureConnection() {
  if (!JOB_IAP_SUPPORTED) throw new Error('iap_unsupported');
  if (connected) return;
  const iap = await requireIap();
  await iap.initConnection();
  connected = true;
}

/**
 * Loads localized subscription products from Apple/Google. Prices shown in the
 * UI must come from this response — never from hard-coded labels.
 */
export async function fetchJobStoreProducts(productIds: string[]): Promise<ProductSubscription[]> {
  if (!JOB_IAP_SUPPORTED || productIds.length === 0) return [];
  await ensureConnection();
  const iap = await requireIap();
  const result = await iap.fetchProducts({ skus: productIds, type: 'subs' });
  return (Array.isArray(result) ? result : [result]).filter(
    (product): product is ProductSubscription => Boolean(product) && (product as ProductSubscription).type === 'subs',
  );
}

export function productOfferToken(product: ProductSubscription): string | null {
  const offers = product.platform === 'android' ? product.subscriptionOffers : null;
  const token = offers?.find((offer) => offer.offerTokenAndroid)?.offerTokenAndroid;
  return token ?? null;
}

/**
 * Starts the native store purchase flow. Resolves only after the store delivers
 * a purchase; the caller must submit its token to the server and then call
 * `finishJobPurchase`.
 */
export async function purchaseJobSubscription(productId: string, offerToken?: string | null): Promise<Purchase> {
  await ensureConnection();
  const iap = await requireIap();
  return new Promise<Purchase>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      clearTimeout(timer);
      updated.remove();
      failed.remove();
    };
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('purchase_timeout'));
    }, 120_000);
    const updated = iap.purchaseUpdatedListener((purchase) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(purchase);
    });
    const failed = iap.purchaseErrorListener((error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    });
    iap
      .requestPurchase({
        type: 'subs',
        request: {
          apple: { sku: productId },
          google: {
            skus: [productId],
            subscriptionOffers: offerToken ? [{ sku: productId, offerToken }] : undefined,
          },
        },
      })
      .catch((error: unknown) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      });
  });
}

export async function finishJobPurchase(purchase: Purchase) {
  const iap = await requireIap();
  await iap.finishTransaction({ purchase, isConsumable: false });
}

/**
 * The base64 App Store app receipt used by App-Specific Shared Secret
 * verification. Null on Android or when the receipt is not available.
 */
export async function getJobAppReceipt(): Promise<string | null> {
  if (Platform.OS !== 'ios' || !JOB_IAP_SUPPORTED) return null;
  try {
    const iap = await requireIap();
    const read = (iap as unknown as { getReceiptDataIOS?: () => Promise<string | null> })
      .getReceiptDataIOS;
    if (typeof read !== 'function') return null;
    const receipt = await read();
    return typeof receipt === 'string' && receipt.length > 32 ? receipt : null;
  } catch {
    return null;
  }
}

/** Forces a fresh StoreKit receipt after a purchase the server could not see yet. */
export async function refreshJobAppReceipt(): Promise<string | null> {
  if (Platform.OS !== 'ios' || !JOB_IAP_SUPPORTED) return null;
  try {
    const iap = await requireIap();
    const refresh = (iap as unknown as { requestReceiptRefreshIOS?: () => Promise<string> })
      .requestReceiptRefreshIOS;
    if (typeof refresh === 'function') {
      const refreshed = await refresh();
      if (typeof refreshed === 'string' && refreshed.length > 32) return refreshed;
    }
  } catch {
    // Fall through to a plain read.
  }
  return getJobAppReceipt();
}

export async function restoreJobPurchases(): Promise<Purchase[]> {
  if (!JOB_IAP_SUPPORTED) return [];
  await ensureConnection();
  const iap = await requireIap();
  return iap.getAvailablePurchases();
}

export async function openStoreSubscriptionManagement() {
  try {
    const iap = await requireIap();
    await iap.deepLinkToSubscriptions({ packageNameAndroid: ANDROID_PACKAGE });
  } catch {
    // Store UI unavailable (e.g. simulator) — caller keeps the local state.
  }
}

export function isPurchaseCancelled(error: unknown) {
  return iapModule?.isUserCancelledError(error) ?? false;
}
