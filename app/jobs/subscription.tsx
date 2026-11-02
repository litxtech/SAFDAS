import { useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { AppButton } from '@/components/ui/AppButton';
import { Tag } from '@/components/jobs/JobKit';
import { useI18nStore } from '@/i18n';
import {
  cancelSubscription,
  fetchEntitlements,
  fetchMyOrganizations,
  fetchMySubscriptions,
  fetchStoreStatus,
  submitPurchaseReceipt,
  verifyPurchase,
} from '@/services/jobs/api';
import { formatSubscriptionEnd, formatRemaining } from '@/services/subscription/period';
import { useJobT } from '@/services/jobs/jobText';
import {
  JOB_IAP_SUPPORTED,
  JOB_STORE_PRODUCT_IDS,
  fetchJobStoreProducts,
  finishJobPurchase,
  getJobAppReceipt,
  isPurchaseCancelled,
  jobStoreProductId,
  openStoreSubscriptionManagement,
  productOfferToken,
  purchaseJobSubscription,
  refreshJobAppReceipt,
  restoreJobPurchases,
} from '@/services/jobs/iap';
import { clearMembershipGrant, grantMembership } from '@/services/store/optimistic';
import { rememberStorePrice, storePlanPrice, useStorePlanPrice, warmStorePrices } from '@/services/store/priceCache';
import type { JobProduct } from '@/services/jobs/types';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';

const FALLBACK_PRODUCTS: JobProduct[] = [
  {
    key: 'seeker_plus',
    title: 'İŞ PLUS',
    price: storePlanPrice('seeker_plus'),
    period: 'ay',
    enabled: true,
    ios_product_id: JOB_STORE_PRODUCT_IDS.seeker_plus.ios,
    android_product_id: JOB_STORE_PRODUCT_IDS.seeker_plus.android,
  },
  {
    key: 'employer_pro',
    title: 'İŞVEREN PRO',
    price: storePlanPrice('employer_pro'),
    period: 'ay',
    enabled: true,
    ios_product_id: JOB_STORE_PRODUCT_IDS.employer_pro.ios,
    android_product_id: JOB_STORE_PRODUCT_IDS.employer_pro.android,
  },
];

const CONTENT = {
  tr: {    title: 'SAFDAŞ İŞ üyelikleri',
    subtitle: 'Kariyer ve işe alım araçlarını güçlendir.',
    seeker: 'İş arayanlar için',
    employer: 'İşverenler için',
    target: 'Hedef fiyat',
    month: 'ay',
    currentPlan: 'Mevcut plan',
    freePlan: 'Ücretsiz kullanım',
    freeBody: 'Satışa açılana kadar tüm temel ve gelişmiş özellikler ücretsiz sunuluyor.',
    active: 'Aktif',
    pending: 'Doğrulama bekleniyor',
    expired: 'Süresi doldu',
    cancelled: 'İptal edildi',
    free: 'Ücretsiz',
    buy: 'Mağazada satın al',
    manage: 'Aboneliği yönet',
    restore: 'Satın alımları geri yükle',
    restoreEmpty: 'Geri yüklenecek bir satın alım bulunamadı.',
    restoreDone: 'Satın alımlar doğrulama sırasına alındı.',
    storeUnavailable: 'Satın alımlar yalnızca iOS ve Android uygulamasında kullanılabilir.',
    purchaseQueued: 'Satın alımın doğrulama sırasına alındı. Doğrulama tamamlanınca üyelik etkinleşecek.',
    purchaseVerified: 'Satın alımın mağaza tarafından doğrulandı; üyeliğin etkin.',
    purchaseCancelled: 'Satın alım iptal edildi.',
    purchaseFailed: 'Satın alım tamamlanamadı. Lütfen tekrar dene.',
    cancelConfirm: 'Sunucudaki abonelik erişimini iptal etmek istiyor musun? Mağaza faturalandırması ayrıca yönetilmelidir.',
    cancel: 'Aboneliği iptal et',
    cancelDone: 'Abonelik iptal edildi.',
    paymentNote: 'Fiyatlar mağazadan alınır. Doğrulama ve iade süreçleri mağaza kurallarına göre yürütülür.',
    guarantee: 'Üyelik işe alınma garantisi vermez; temel kullanım her zaman ücretsizdir.',
    plus: 'İŞ PLUS',
    pro: 'İŞVEREN PRO',
    plusDesc: 'Daha güçlü görünürlük ve kariyer araçları.',
    proDesc: 'Profesyonel işe alım ve aday havuzu.',
    activeUntil: 'Bitiş',
    orgRequired: 'İŞVEREN PRO için önce bir işletme oluşturmalısın.',
    createOrg: 'İşletme oluştur',
    plusBenefits: [
      'Gelişmiş iş filtreleri',
      'Gelişmiş eşleşme analizleri',
      'Profesyonel profil görünürlüğü',
      'Ayda 10 doğrudan işveren iletişimi',
      'Ayrıntılı profil görüntülenme istatistikleri',
      'Gelişmiş CV analiz araçları',
    ],
    proBenefits: [
      '10 aktif iş ilanı',
      'CV havuzuna erişim',
      'Ayda 50 doğrudan aday daveti',
      'Gelişmiş aday filtreleme',
      'Çoklu personel yetkilendirme',
      'İşe alım analizleri',
      'Profesyonel işletme vitrini',
    ],
  },
  en: {
    title: 'SAFDAŞ JOBS memberships',
    subtitle: 'Strengthen your career and hiring tools.',
    seeker: 'For job seekers',
    employer: 'For employers',
    target: 'Target price',
    month: 'mo',
    currentPlan: 'Current plan',
    freePlan: 'Free access',
    freeBody: 'Every basic and advanced feature stays free until sales are opened.',
    active: 'Active',
    pending: 'Pending verification',
    expired: 'Expired',
    cancelled: 'Cancelled',
    free: 'Free',
    buy: 'Buy in store',
    manage: 'Manage subscription',
    restore: 'Restore purchases',
    restoreEmpty: 'No purchase to restore was found.',
    restoreDone: 'Purchases were queued for verification.',
    storeUnavailable: 'Purchases are available only in the iOS and Android app.',
    purchaseQueued: 'Your purchase is queued for verification. Membership activates once verified.',
    purchaseVerified: 'Your purchase was verified by the store and your membership is active.',
    purchaseCancelled: 'Purchase cancelled.',
    purchaseFailed: 'The purchase could not be completed. Please try again.',
    cancelConfirm: 'Cancel server-side access? Store billing must be managed separately.',
    cancel: 'Cancel subscription',
    cancelDone: 'Subscription cancelled.',
    paymentNote: 'Prices come from the store. Verification and refunds follow store rules.',
    guarantee: 'Membership does not guarantee employment; basic access is always free.',
    plus: 'JOB PLUS',
    pro: 'EMPLOYER PRO',
    plusDesc: 'Stronger visibility and career tools.',
    proDesc: 'Professional hiring and talent pool.',
    activeUntil: 'Ends',
    orgRequired: 'Create a company before purchasing EMPLOYER PRO.',
    createOrg: 'Create company',
    plusBenefits: [
      'Advanced job filters',
      'Advanced match analysis',
      'Professional profile visibility',
      '10 direct employer messages / month',
      'Detailed profile view analytics',
      'Advanced CV analysis tools',
    ],
    proBenefits: [
      '10 active job listings',
      'Candidate pool access',
      '50 direct candidate invitations / month',
      'Advanced candidate filtering',
      'Multiple staff roles',
      'Hiring analytics',
      'Professional company showcase',
    ],
  },
} as const;

export default function JobsSubscriptionScreen() {
  const { product } = useLocalSearchParams<{ product?: 'seeker_plus' | 'employer_pro'; org?: string }>();
  const { colors } = useTheme();
  const t = useJobT();
  const locale = useI18nStore((state) => state.locale);
  const copy = CONTENT[locale === 'tr' ? 'tr' : 'en'];
  const toast = useToastStore((state) => state.show);
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.session?.user.id);
  const [busy, setBusy] = useState<string | null>(null);

  const orgs = useQuery({ queryKey: ['job-orgs', userId], queryFn: () => fetchMyOrganizations(userId!), enabled: Boolean(userId) });
  const org = orgs.data?.[0];
  const entitlements = useQuery({
    queryKey: ['job-entitlements', org?.id],
    queryFn: () => fetchEntitlements(org?.id),
    enabled: Boolean(userId),
  });
  const store = useQuery({ queryKey: ['job-store-status'], queryFn: fetchStoreStatus });
  const subscriptions = useQuery({ queryKey: ['job-subscriptions'], queryFn: fetchMySubscriptions, enabled: Boolean(userId) });

  const freeMode = Boolean(store.data?.free_mode || entitlements.data?.free_mode);
  const products = useMemo(() => {
    const source = store.data?.products?.length ? store.data.products : entitlements.data?.products ?? [];
    const merged = new Map<string, JobProduct>();
    for (const row of FALLBACK_PRODUCTS) merged.set(row.key, row);
    for (const row of source) {
      const fallback = merged.get(row.key);
      merged.set(row.key, {
        ...(fallback ?? row),
        ...row,
        ios_product_id: row.ios_product_id ?? fallback?.ios_product_id ?? null,
        android_product_id: row.android_product_id ?? fallback?.android_product_id ?? null,
      });
    }
    return [...merged.values()];
  }, [entitlements.data?.products, store.data?.products]);
  const productIds = useMemo(
    () =>
      Array.from(
        new Set(
          products
            .map((item) => (Platform.OS === 'ios' ? item.ios_product_id : item.android_product_id))
            .filter((id): id is string => Boolean(id)),
        ),
      ),
    [products],
  );
  const iap = useQuery({
    queryKey: ['job-iap-products', productIds],
    queryFn: () => fetchJobStoreProducts(productIds),
    enabled: JOB_IAP_SUPPORTED && productIds.length > 0,
    retry: false,
    staleTime: 5 * 60_000,
  });
  const iapById = useMemo(() => new Map((iap.data ?? []).map((item) => [item.id, item])), [iap.data]);

  // Live store price for a plan, read from the product the store already returned.
  const livePriceFor = (key: 'seeker_plus' | 'employer_pro') => {
    const item = products.find((row) => row.key === key);
    const storeId =
      (Platform.OS === 'ios' ? item?.ios_product_id : item?.android_product_id) ?? jobStoreProductId(key);
    return iapById.get(storeId)?.displayPrice ?? null;
  };

  // Show the last known store price instantly; refresh it in the background.
  useEffect(() => {
    void warmStorePrices();
  }, []);
  useEffect(() => {
    for (const item of iap.data ?? []) rememberStorePrice(item.id, item.displayPrice);
  }, [iap.data]);

  const syncedRef = useRef(false);
  // A receipt can be queued while the store is slow or the device is offline.
  // Re-verify pending rows once per visit so a paid user is never stuck locked.
  useEffect(() => {
    if (!userId || syncedRef.current) return;
    const pending = (subscriptions.data ?? []).filter(
      (row) => row.status === 'pending_verification' && row.platform !== 'manual',
    );
    if (pending.length === 0) return;
    syncedRef.current = true;
    void (async () => {
      let changed = false;
      for (const row of pending.slice(0, 5)) {
        const result = await verifyPurchase(row.id).catch(() => null);
        if (result && result.status !== 'pending_verification') changed = true;
      }
      if (changed) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['job-subscriptions'] }),
          queryClient.invalidateQueries({ queryKey: ['job-entitlements'] }),
        ]);
      }
    })();
  }, [queryClient, subscriptions.data, userId]);

  const activePlus = (subscriptions.data ?? []).find((row) => row.product === 'seeker_plus' && row.status === 'active');
  const activePro = (subscriptions.data ?? []).find((row) => row.product === 'employer_pro' && row.org_id === org?.id && row.status === 'active');
  const pendingPlus = (subscriptions.data ?? []).find((row) => row.product === 'seeker_plus' && row.status === 'pending_verification');
  const pendingPro = (subscriptions.data ?? []).find((row) => row.product === 'employer_pro' && row.org_id === org?.id && row.status === 'pending_verification');

  function invalidatePurchases() {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: ['job-subscriptions'] }),
      queryClient.invalidateQueries({ queryKey: ['job-entitlements'] }),
      queryClient.invalidateQueries({ queryKey: ['profile-memberships'] }),
    ]);
  }

  async function submitReceiptWithRetry(input: Parameters<typeof submitPurchaseReceipt>[0]) {
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await submitPurchaseReceipt(input);
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }
    throw lastError ?? new Error('receipt_submit_failed');
  }

  /**
   * Sends the receipt to the server and asks for store verification.
   * The product is already credited locally, so any failure here only delays
   * the server copy — it never blocks or errors the purchase screen.
   */
  async function queuePurchase(
    purchaseResult: Awaited<ReturnType<typeof purchaseJobSubscription>>,
    item: JobProduct,
    storeProductId: string,
  ) {
    const transactionId = purchaseResult.transactionId ?? purchaseResult.id;
    const originalId =
      (purchaseResult as unknown as { originalTransactionIdentifierIOS?: string | null }).originalTransactionIdentifierIOS ??
      transactionId;
    try {
      const subscriptionId = await submitReceiptWithRetry({
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        product: item.key,
        productId: storeProductId,
        transactionId,
        originalTransactionId: originalId,
        receipt: {
          token: purchaseResult.purchaseToken ?? null,
          receiptData: await getJobAppReceipt(),
          productId: purchaseResult.productId,
          store: purchaseResult.store,
          transactionDate: purchaseResult.transactionDate ?? null,
          transactionId,
        },
        orgId: item.key === 'employer_pro' ? org?.id : null,
      });
      let verification = await verifyPurchase(subscriptionId).catch(() => null);
      if (verification?.status !== 'active' && verification?.status !== 'grace') {
        const fresh = await refreshJobAppReceipt();
        if (fresh) {
          verification = (await verifyPurchase(subscriptionId, fresh).catch(() => null)) ?? verification;
        }
      }
      if (verification?.status === 'active' || verification?.status === 'grace') {
        clearMembershipGrant(item.key, item.key === 'employer_pro' ? org?.id : null);
      } else if (verification?.status === 'expired' || verification?.status === 'refunded') {
        clearMembershipGrant(item.key, item.key === 'employer_pro' ? org?.id : null);
      }
      await invalidatePurchases();
      return verification;
    } finally {
      // Acknowledge the store transaction even when the server is unreachable;
      // the local grant covers the paid period and the server catches up later.
      await finishJobPurchase(purchaseResult).catch(() => undefined);
    }
  }

  async function purchase(item: JobProduct) {
    const storeProductId =
      (Platform.OS === 'ios' ? item.ios_product_id : item.android_product_id) ?? jobStoreProductId(item.key);
    if (item.key === 'employer_pro' && !org) {
      toast(copy.orgRequired, 'error');
      return;
    }
    if (!JOB_IAP_SUPPORTED) {
      toast(copy.storeUnavailable, 'error');
      return;
    }
    setBusy(item.key);
    let purchaseResult: Awaited<ReturnType<typeof purchaseJobSubscription>>;
    try {
      const storeProduct = iapById.get(storeProductId);
      purchaseResult = await purchaseJobSubscription(
        storeProductId,
        storeProduct ? productOfferToken(storeProduct) : null,
      );
    } catch (error) {
      if (isPurchaseCancelled(error)) toast(copy.purchaseCancelled, 'info');
      else toast(copy.purchaseFailed, 'error');
      setBusy(null);
      return;
    }

    // The store has charged the account — credit the plan immediately.
    grantMembership(item.key, item.key === 'employer_pro' ? org?.id : null);
    await invalidatePurchases();
    toast(copy.purchaseVerified, 'success');

    try {
      await queuePurchase(purchaseResult, item, storeProductId);
    } catch {
      // Keep the local grant; the next visit re-verifies the queued receipt.
    } finally {
      setBusy(null);
    }
  }

  async function restore() {
    setBusy('restore');
    try {
      const purchases = await restoreJobPurchases();
      if (purchases.length === 0) {
        toast(copy.restoreEmpty, 'info');
        return;
      }
      let queued = 0;
      let verified = 0;
      for (const purchaseResult of purchases) {
        const item =
          products.find(
            (row) => (Platform.OS === 'ios' ? row.ios_product_id : row.android_product_id) === purchaseResult.productId,
          ) ?? FALLBACK_PRODUCTS.find((row) => jobStoreProductId(row.key) === purchaseResult.productId);
        if (!item) continue;
        if (item.key === 'employer_pro' && !org) continue;
        grantMembership(item.key, item.key === 'employer_pro' ? org?.id : null);
        await invalidatePurchases();
        try {
          const verification = await queuePurchase(purchaseResult, item, purchaseResult.productId);
          if (verification?.status === 'active' || verification?.status === 'grace') verified += 1;
          queued += 1;
        } catch {
          // One failed restore must not block the rest; the local grant stays.
          queued += 1;
        }
      }
      await invalidatePurchases();
      toast(
        queued > 0 ? (verified > 0 ? copy.purchaseVerified : copy.restoreDone) : copy.purchaseFailed,
        queued > 0 ? 'success' : 'error',
      );
    } catch {
      toast(copy.purchaseFailed, 'error');
    } finally {
      setBusy(null);
    }
  }

  async function cancel(rowId: string) {
    setBusy(`cancel-${rowId}`);
    try {
      await cancelSubscription(rowId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['job-subscriptions'] }),
        queryClient.invalidateQueries({ queryKey: ['job-entitlements'] }),
      ]);
      toast(copy.cancelDone, 'success');
    } catch {
      toast(copy.purchaseFailed, 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen scroll style={{ paddingBottom: 30 }}>
      <View style={{ gap: 3 }}>
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.6 }}>{copy.title}</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 12.5 }}>{copy.subtitle}</Text>
      </View>

      {freeMode ? (
        <View style={[styles.banner, { backgroundColor: colors.primaryMuted, borderColor: colors.primary }]}>
          <Ionicons name="gift-outline" size={18} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: '800' }}>{copy.freePlan}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 11.5, lineHeight: 17 }}>{copy.freeBody}</Text>
          </View>
        </View>
      ) : null}

      <PlanCard
        highlight={product === 'seeker_plus'}
        title={copy.plus}
        description={copy.plusDesc}
        product={products.find((item) => item.key === 'seeker_plus')}
        benefits={copy.plusBenefits}
        active={Boolean(entitlements.data?.seeker_plus)}
        activeUntil={activePlus?.expires_at ?? null}
        sandboxExtended={Boolean(activePlus?.sandbox_extended)}
        pending={Boolean(pendingPlus)}
        freeMode={freeMode}
        storeUnavailable={!JOB_IAP_SUPPORTED}
        livePrice={livePriceFor('seeker_plus')}
        busy={busy === 'seeker_plus'}
        onBuy={() => {
          const item = products.find((row) => row.key === 'seeker_plus');
          if (item) void purchase(item);
        }}
        onManage={() => void openStoreSubscriptionManagement()}
        onCancel={activePlus ? () => void cancel(activePlus.id) : undefined}
        copy={copy}
      />

      <PlanCard
        highlight={product === 'employer_pro'}
        title={copy.pro}
        description={copy.proDesc}
        product={products.find((item) => item.key === 'employer_pro')}
        benefits={copy.proBenefits}
        active={Boolean(entitlements.data?.employer_pro)}
        activeUntil={activePro?.expires_at ?? null}
        sandboxExtended={Boolean(activePro?.sandbox_extended)}
        pending={Boolean(pendingPro)}
        freeMode={freeMode}
        storeUnavailable={!JOB_IAP_SUPPORTED}
        livePrice={livePriceFor('employer_pro')}
        busy={busy === 'employer_pro'}
        orgMissing={!org}
        onCreateOrg={() => router.replace('/jobs/employer/onboarding')}
        onBuy={() => {
          const item = products.find((row) => row.key === 'employer_pro');
          if (item) void purchase(item);
        }}
        onManage={() => void openStoreSubscriptionManagement()}
        onCancel={activePro ? () => void cancel(activePro.id) : undefined}
        copy={copy}
      />

      <AppButton label={copy.restore} variant="secondary" onPress={() => void restore()} loading={busy === 'restore'} disabled={!JOB_IAP_SUPPORTED || freeMode} />
      <Text style={{ color: colors.textSecondary, fontSize: 10.5, lineHeight: 15, textAlign: 'center' }}>{copy.guarantee}</Text>
      <Text style={{ color: colors.textSecondary, fontSize: 10, lineHeight: 14, textAlign: 'center' }}>{copy.paymentNote}</Text>
    </Screen>
  );
}

function PlanCard({
  title,
  description,
  product,
  benefits,
  active,
  activeUntil,
  sandboxExtended,
  pending,
  freeMode,
  storeUnavailable,
  livePrice,
  busy,
  orgMissing,
  onCreateOrg,
  onBuy,
  onManage,
  onCancel,
  copy,
  highlight,
}: {
  title: string;
  description: string;
  product?: JobProduct;
  benefits: readonly string[];
  active: boolean;
  activeUntil: string | null;
  sandboxExtended?: boolean;
  pending: boolean;
  freeMode: boolean;
  storeUnavailable: boolean;
  livePrice?: string | null;
  busy: boolean;
  orgMissing?: boolean;
  onCreateOrg?: () => void;
  onBuy: () => void;
  onManage: () => void;
  onCancel?: () => void;
  copy: (typeof CONTENT)[keyof typeof CONTENT];
  highlight?: boolean;
}) {
  const { colors } = useTheme();
  const locale = useI18nStore((state) => state.locale);
  const storeId = product
    ? (Platform.OS === 'ios' ? product.ios_product_id : product.android_product_id) ?? jobStoreProductId(product.key)
    : null;
  // Live store price first, then the last cached price, then the catalog label.
  // All three are synchronous, so the card never waits on the store.
  const cachedPrice = useStorePlanPrice(product?.key ?? 'seeker_plus');
  const price = livePrice ?? cachedPrice ?? product?.price ?? '';
  const purchasable = Boolean(product && storeId && !freeMode && !active && !pending);

  return (
    <View
      style={[
        styles.plan,
        {
          backgroundColor: colors.surface,
          borderColor: highlight ? colors.primary : colors.border,
          borderWidth: highlight ? 1.4 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800', letterSpacing: -0.3 }}>{title}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 11.5 }}>{description}</Text>
        </View>
        {active ? (
          <Tag label={copy.active} tone="success" />
        ) : pending ? (
          <Tag label={copy.pending} tone="warning" />
        ) : freeMode ? (
          <Tag label={copy.free} tone="primary" />
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5 }}>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.4 }}>{price}</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 11 }}>/ {copy.month}</Text>
      </View>

      {active && activeUntil ? (
        <View style={{ gap: 2 }}>
          <Text style={{ color: colors.success, fontSize: 10.5 }}>
            {copy.activeUntil}: {formatSubscriptionEnd(activeUntil, locale)}
          </Text>
          {formatRemaining(activeUntil, locale) ? (
            <Text style={{ color: colors.textSecondary, fontSize: 9.5 }}>
              {formatRemaining(activeUntil, locale)}
            </Text>
          ) : null}
          {sandboxExtended ? (
            <Text style={{ color: colors.textSecondary, fontSize: 9, lineHeight: 13 }}>
              {locale === 'tr'
                ? 'Test aboneliği: tam ücretli dönem gösteriliyor.'
                : 'Test subscription: the full paid period is shown.'}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={{ gap: 6 }}>
        {benefits.map((benefit) => (
          <View key={benefit} style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
            <Text style={{ color: colors.textSecondary, fontSize: 11.5, flex: 1, lineHeight: 16 }}>{benefit}</Text>
          </View>
        ))}
      </View>

      {active ? (
        <View style={{ gap: 7 }}>
          <AppButton label={copy.manage} variant="secondary" onPress={onManage} />
          {onCancel ? <Pressable onPress={onCancel}><Text style={{ color: colors.error, fontSize: 10.5, textAlign: 'center', fontWeight: '700' }}>{copy.cancel}</Text></Pressable> : null}
        </View>
      ) : pending ? (
        <View style={[styles.note, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
          <Ionicons name="time-outline" size={14} color={colors.warning} />
          <Text style={{ color: colors.textSecondary, fontSize: 10.5, flex: 1, lineHeight: 15 }}>{copy.pending}</Text>
        </View>
      ) : freeMode ? (
        <View style={[styles.note, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
          <Ionicons name="gift-outline" size={14} color={colors.primary} />
          <Text style={{ color: colors.textSecondary, fontSize: 10.5, flex: 1, lineHeight: 15 }}>{copy.freeBody}</Text>
        </View>
      ) : orgMissing ? (
        <View style={{ gap: 7 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{copy.orgRequired}</Text>
          <AppButton label={copy.createOrg} onPress={onCreateOrg ?? (() => undefined)} />
        </View>
      ) : storeUnavailable ? (
        <View style={[styles.note, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
          <Ionicons name="phone-portrait-outline" size={14} color={colors.textSecondary} />
          <Text style={{ color: colors.textSecondary, fontSize: 10.5, flex: 1, lineHeight: 15 }}>{copy.storeUnavailable}</Text>
        </View>
      ) : (
        <AppButton label={copy.buy} onPress={onBuy} loading={busy} disabled={!purchasable} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', gap: 9, alignItems: 'center', borderRadius: radius.lg, borderWidth: 1, padding: 12 },
  plan: { borderRadius: radius.xl, padding: 16, gap: 11 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 10 },
});
