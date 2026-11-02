import { Platform } from 'react-native';
import type { ProductSubscription, Purchase } from 'expo-iap';
import { NASIP_PRODUCT_IDS } from './constants';

export const NASIP_IAP_SUPPORTED = Platform.OS === 'ios' || Platform.OS === 'android';
const ANDROID_PACKAGE = 'com.litxtech.namazim';

type IapModule = typeof import('expo-iap');

let iapModule: IapModule | null = null;
let iapPromise: Promise<IapModule | null> | null = null;

/**
 * expo-iap is loaded lazily on purpose. NASIP route files are evaluated while
 * expo-router builds its route tree; a static native import that fails (store
 * module missing from the installed dev build) would throw there and turn every
 * screen into "Unmatched Route". With lazy loading the store simply reports
 * "unavailable" and the rest of NASIP keeps working.
 */
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
  if (!NASIP_IAP_SUPPORTED) throw new Error('iap_unsupported');
  if (connected) return;
  const iap = await requireIap();
  await iap.initConnection();
  connected = true;
}

export function nasipProductId(override?: string | null): string {
  const configured = override?.trim();
  if (configured) return configured;
  return Platform.OS === 'ios' ? NASIP_PRODUCT_IDS.ios : NASIP_PRODUCT_IDS.android;
}

/**
 * Loads the localized subscription product from Apple/Google. The UI must show
 * this price, never a hard-coded one.
 */
export async function fetchNasipStoreProduct(productId = nasipProductId()): Promise<ProductSubscription | null> {
  if (!NASIP_IAP_SUPPORTED) return null;
  await ensureConnection();
  const iap = await requireIap();
  const result = await iap.fetchProducts({ skus: [productId], type: 'subs' });
  const products = (Array.isArray(result) ? result : [result]).filter(
    (product): product is ProductSubscription => Boolean(product) && (product as ProductSubscription).type === 'subs',
  );
  return products[0] ?? null;
}

export function nasipOfferToken(product: ProductSubscription): string | null {
  const offers = product.platform === 'android' ? product.subscriptionOffers : null;
  const token = offers?.find((offer) => offer.offerTokenAndroid)?.offerTokenAndroid;
  return token ?? null;
}

/**
 * Starts the native store purchase flow. Resolves only after the store delivers
 * a purchase; the caller must queue the receipt server-side and then finish it.
 */
export async function purchaseNasipPlus(
  offerToken?: string | null,
  productId = nasipProductId(),
): Promise<Purchase> {
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
      if (settled || purchase.productId !== productId) return;
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

export async function finishNasipPurchase(purchase: Purchase) {
  const iap = await requireIap();
  await iap.finishTransaction({ purchase, isConsumable: false });
}

/**
 * The base64 App Store app receipt. App-Specific Shared Secret verification
 * (verifyReceipt) needs it, and it is refreshed by the store after every
 * renewal. Returns null on Android or when the receipt is unavailable.
 */
export async function getNasipAppReceipt(): Promise<string | null> {
  if (Platform.OS !== 'ios' || !NASIP_IAP_SUPPORTED) return null;
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

/**
 * Forces StoreKit to refresh the app receipt and returns the fresh base64 blob.
 * Used only when the first verification attempt could not see the purchase yet
 * (a just-completed sandbox purchase sometimes lags behind the receipt).
 */
export async function refreshNasipAppReceipt(): Promise<string | null> {
  if (Platform.OS !== 'ios' || !NASIP_IAP_SUPPORTED) return null;
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
  return getNasipAppReceipt();
}

export async function restoreNasipStorePurchases(productId = nasipProductId()): Promise<Purchase[]> {
  if (!NASIP_IAP_SUPPORTED) return [];
  await ensureConnection();
  const iap = await requireIap();
  const purchases = await iap.getAvailablePurchases();
  return purchases.filter((purchase) => purchase.productId === productId);
}

export async function openNasipStoreManagement() {
  try {
    const iap = await requireIap();
    await iap.deepLinkToSubscriptions({ packageNameAndroid: ANDROID_PACKAGE });
  } catch {
    // Store UI is unavailable (e.g. simulator); the caller keeps its state.
  }
}

export function isNasipPurchaseCancelled(error: unknown) {
  return iapModule?.isUserCancelledError(error) ?? false;
}
