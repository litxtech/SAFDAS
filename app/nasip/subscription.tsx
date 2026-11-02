import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  NasipButton,
  NasipCard,
  NasipScreen,
  NasipTag,
  nasipColors,
} from '@/components/nasip/NasipKit';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import {
  fetchNasipClientConfig,
  fetchNasipEntitlements,
  restoreNasipPurchases,
  submitNasipReceipt,
  syncNasipEntitlements,
  verifyNasipReceiptWithServer,
} from '@/services/nasip/api';
import {
  NASIP_FREE_BENEFITS,
  NASIP_PLUS_BENEFITS,
} from '@/services/nasip/constants';
import {
  NASIP_IAP_SUPPORTED,
  fetchNasipStoreProduct,
  finishNasipPurchase,
  getNasipAppReceipt,
  isNasipPurchaseCancelled,
  nasipOfferToken,
  nasipProductId,
  openNasipStoreManagement,
  purchaseNasipPlus,
  refreshNasipAppReceipt,
  restoreNasipStorePurchases,
} from '@/services/nasip/iap';
import { cleanNasipCopy, mapNasipError, useNasipT } from '@/services/nasip/nasipText';
import { formatRemaining, formatSubscriptionEnd, sandboxNote } from '@/services/subscription/period';
import { clearMembershipGrant, grantMembership } from '@/services/store/optimistic';
import { rememberStorePrice, useStorePlanPrice, warmStorePrices } from '@/services/store/priceCache';
import { useI18nStore } from '@/i18n';

export default function NasipSubscriptionScreen() {
  const t = useNasipT();
  const locale = useI18nStore((state) => state.locale);
  const params = useLocalSearchParams<{ reason?: string }>();
  const queryClient = useQueryClient();
  const toast = useToastStore((state) => state.show);
  const userId = useAuthStore((state) => state.session?.user.id);
  const [busy, setBusy] = useState<string | null>(null);
  const syncedRef = useRef(false);

  // Renewals and refunds arrive through App Store / Play notifications, but a
  // notification can be missed. Re-confirm the latest receipt once per visit so
  // an expired or refunded PLUS never lingers on the device.
  useEffect(() => {
    if (!userId || syncedRef.current) return;
    syncedRef.current = true;
    void (async () => {
      // Sending the app receipt lets the server confirm a purchase that was
      // queued but never verified (offline purchase, missing store credentials).
      const receipt = await getNasipAppReceipt();
      return syncNasipEntitlements(receipt);
    })()
      .then((result) => {
        if (result?.status && result.status !== 'pending_verification') {
          void queryClient.invalidateQueries({ queryKey: ['nasip-entitlements'] });
        }
      })
      .catch(() => {
        // Offline: keep the last verified state and retry on the next visit.
      });
  }, [queryClient, userId]);

  const entitlements = useQuery({
    queryKey: ['nasip-entitlements', userId],
    queryFn: fetchNasipEntitlements,
    enabled: Boolean(userId),
    staleTime: 20_000,
  });

  const config = useQuery({
    queryKey: ['nasip-client-config'],
    queryFn: fetchNasipClientConfig,
    enabled: Boolean(userId),
    staleTime: 5 * 60_000,
  });

  const configuredProductId =
    Platform.OS === 'ios'
      ? config.data?.product.ios_product_id
      : config.data?.product.android_product_id;
  const productId = configuredProductId?.trim() || null;

  const product = useQuery({
    queryKey: ['nasip-store-product', productId],
    queryFn: () => fetchNasipStoreProduct(productId ?? undefined),
    enabled: NASIP_IAP_SUPPORTED,
    retry: false,
    staleTime: 10 * 60_000,
  });

  const isPlus = Boolean(entitlements.data?.is_plus);
  const subscription = entitlements.data?.subscription;
  const cachedPrice = useStorePlanPrice('nasip_plus');
  const priceLabel = (product.data as unknown as { displayPrice?: string | null } | null)?.displayPrice ?? cachedPrice;
  const offerToken = product.data ? nasipOfferToken(product.data) : null;

  // Warm the store cache and show the last known price immediately.
  useEffect(() => {
    void warmStorePrices();
  }, []);

  useEffect(() => {
    const item = product.data as unknown as { id?: string; displayPrice?: string | null } | null;
    if (item?.id) rememberStorePrice(item.id, item.displayPrice);
  }, [product.data]);

  const reasonCopy = reasonMessage(params.reason);
  const offerTitle = cleanNasipCopy(config.data?.premium_offer.title) ?? t('plusTitle');
  const offerBody = cleanNasipCopy(config.data?.premium_offer.body) ?? t('plusSubtitle');

  async function invalidate() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['nasip-entitlements'] }),
      queryClient.invalidateQueries({ queryKey: ['nasip-my-profile'] }),
      queryClient.invalidateQueries({ queryKey: ['nasip-profile-stats'] }),
      queryClient.invalidateQueries({ queryKey: ['nasip-candidates'] }),
      queryClient.invalidateQueries({ queryKey: ['profile-memberships'] }),
    ]);
  }

  async function submitReceiptWithRetry(input: Parameters<typeof submitNasipReceipt>[0]) {
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await submitNasipReceipt(input);
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }
    throw lastError ?? new Error('receipt_submit_failed');
  }

  async function queuePurchase(purchase: Awaited<ReturnType<typeof purchaseNasipPlus>>) {
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    const transactionId = purchase.transactionId ?? purchase.id;
    const originalTransactionId =
      (purchase as unknown as { originalTransactionIdentifierIOS?: string | null }).originalTransactionIdentifierIOS ??
      transactionId;
    try {
      // The App Store app receipt lets the server confirm the purchase with the
      // App-Specific Shared Secret even before the Server API key is installed.
      const receipt = await getNasipAppReceipt();
      const queued = await submitReceiptWithRetry({
        platform,
        productId: purchase.productId,
        transactionId,
        originalTransactionId,
        purchaseToken: purchase.purchaseToken ?? null,
        jws: platform === 'ios' ? purchase.purchaseToken ?? null : null,
        receipt,
      });
      // First attempt is normally enough. If the store receipt did not include the
      // new transaction yet, refresh it and retry so the user is not left looking
      // at a locked paywall they already paid for.
      let verification = await verifyNasipReceiptWithServer(queued.event_id).catch(() => null);
      if (verification?.status !== 'active' && verification?.status !== 'grace') {
        const fresh = await refreshNasipAppReceipt();
        if (fresh) {
          const retried = await verifyNasipReceiptWithServer(queued.event_id, fresh).catch(() => null);
          verification = retried ?? verification;
        }
      }
      // The store is now authoritative. Drop the local grant only when it
      // confirms the paid period (or explicitly rejects the receipt).
      if (verification?.status === 'active' || verification?.status === 'grace') {
        clearMembershipGrant('nasip_plus');
      } else if (verification?.status === 'expired' || verification?.status === 'refunded') {
        clearMembershipGrant('nasip_plus');
      }
      await invalidate();
      return verification;
    } finally {
      // Always acknowledge the transaction: an unfinished purchase would be
      // replayed by the store on the next launch.
      await finishNasipPurchase(purchase).catch(() => undefined);
    }
  }

  async function buy() {
    if (!NASIP_IAP_SUPPORTED) {
      toast(t('storeUnavailable'), 'error');
      return;
    }
    setBusy('buy');
    let purchase: Awaited<ReturnType<typeof purchaseNasipPlus>>;
    try {
      purchase = await purchaseNasipPlus(offerToken, productId ?? nasipProductId());
    } catch (error) {
      if (isNasipPurchaseCancelled(error)) toast(t('purchaseCancelled'), 'info');
      else toast(t('purchaseFailed'), 'error');
      setBusy(null);
      return;
    }

    // Payment has already been taken by the store: credit the account right
    // away so the paywall never reappears while the receipt is being verified.
    grantMembership('nasip_plus');
    await invalidate();
    toast(t('purchaseSuccess'), 'success');
    try {
      await queuePurchase(purchase);
    } catch {
      // The local grant keeps the paid period; the receipt is retried on the
      // next visit through the entitlement sync.
    } finally {
      setBusy(null);
    }
  }

  async function restore() {
    setBusy('restore');
    try {
      const purchases = await restoreNasipStorePurchases(productId ?? undefined);
      if (!purchases.length) {
        await restoreNasipPurchases(Platform.OS === 'ios' ? 'ios' : 'android');
        await invalidate();
        toast(t('restoreEmpty'), 'info');
        return;
      }
      let verifiedActive = false;
      grantMembership('nasip_plus');
      await invalidate();
      for (const purchase of purchases) {
        const verification = await queuePurchase(purchase).catch(() => null);
        if (verification?.status === 'active' || verification?.status === 'grace') verifiedActive = true;
      }
      await restoreNasipPurchases(Platform.OS === 'ios' ? 'ios' : 'android');
      await invalidate();
      toast(verifiedActive ? t('purchaseSuccess') : t('restoreDone'), verifiedActive ? 'success' : 'info');
    } catch (error) {
      toast(mapNasipError(error, locale), 'error');
    } finally {
      setBusy(null);
    }
  }

  const freeBenefits = locale === 'tr' ? NASIP_FREE_BENEFITS.tr : NASIP_FREE_BENEFITS.en;
  const plusBenefits = locale === 'tr' ? NASIP_PLUS_BENEFITS.tr : NASIP_PLUS_BENEFITS.en;

  return (
    <NasipScreen back>
      <View style={styles.hero}>
        <View style={styles.heroGlow} />
        <View style={styles.heroIcon}>
          <Ionicons name="sparkles" size={24} color={nasipColors.primary} />
        </View>
        <Text style={styles.kicker}>PREMIUM ÜYELİK</Text>
        <Text style={styles.heroTitle} numberOfLines={2}>
          {offerTitle}
        </Text>
        <Text style={styles.heroBody}>{offerBody}</Text>
        {isPlus ? (
          <NasipTag
            label={
              subscription?.expires_at
                ? `${t('activeUntil')} ${formatSubscriptionEnd(subscription.expires_at, locale)}`
                : 'PLUS aktif'
            }
            tone="primary"
            icon="checkmark-circle"
          />
        ) : null}
      </View>

      {reasonCopy ? (
        <View style={styles.reasonCard}>
          <Ionicons name="information-circle-outline" size={16} color={nasipColors.primaryDark} />
          <Text style={styles.reasonText}>{reasonCopy}</Text>
        </View>
      ) : null}

      {!isPlus ? (
        <NasipCard style={styles.priceCard}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.planTitle}>{t('plusPlan')}</Text>
            <Text style={styles.planBody}>Aylık abonelik · Otomatik yenilenir</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.price}>{priceLabel}</Text>
            <Text style={styles.pricePeriod}>/ {t('plusMonthly')}</Text>
          </View>
        </NasipCard>
      ) : (
        <NasipCard style={styles.activeCard}>
          <View style={styles.activeIcon}>
            <Ionicons name="checkmark" size={18} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.activeTitle}>{t('purchaseSuccess')}</Text>
            <Text style={styles.activeBody}>
              {subscription?.auto_renew ? 'Otomatik yenileme açık.' : 'Otomatik yenileme kapalı veya mağazadan yönetiliyor.'}
              {subscription?.expires_at ? ` Bitiş: ${formatSubscriptionEnd(subscription.expires_at, locale)}` : ''}
              {formatRemaining(subscription?.expires_at, locale) ? ` · ${formatRemaining(subscription?.expires_at, locale)}` : ''}
            </Text>
            {sandboxNote(subscription?.environment === 'sandbox', locale) ? (
              <Text style={styles.sandboxNote}>{sandboxNote(subscription?.environment === 'sandbox', locale)}</Text>
            ) : null}
          </View>
        </NasipCard>
      )}

      <NasipCard style={{ gap: 12 }}>
        <Text style={styles.sectionTitle}>{t('plusBenefitsTitle')}</Text>
        {plusBenefits.map((benefit) => (
          <BenefitRow key={benefit} label={benefit} included />
        ))}
        <View style={styles.divider} />
        <Text style={styles.sectionTitleSmall}>{t('freePlan')}</Text>
        {freeBenefits.map((benefit) => (
          <BenefitRow key={benefit} label={benefit} included />
        ))}
        <View style={styles.freeSafety}>
          <Ionicons name="shield-checkmark-outline" size={14} color={nasipColors.primaryDark} />
          <Text style={styles.freeSafetyText}>
            Güvenlik, engelleme, şikâyet ve temel gizlilik özellikleri hiçbir zaman ücretli değildir.
          </Text>
        </View>
      </NasipCard>

      <NasipCard style={{ gap: 9 }}>
        <Text style={styles.noteTitle}>Şeffaf abonelik bilgisi</Text>
        <Text style={styles.noteBody}>{t('autoRenewNote')}</Text>
        <Text style={styles.noteBody}>{t('guaranteeNote')}</Text>
        <Text style={styles.noteBody}>{t('paymentNote')}</Text>
        <Text style={styles.noteBody}>{t('storePriceNote')}</Text>
      </NasipCard>

      {isPlus ? (
        <>
          <NasipButton
            label={t('manageSubscription')}
            icon="settings-outline"
            variant="secondary"
            onPress={() => void openNasipStoreManagement()}
          />
          <NasipButton label={t('continueFree')} variant="ghost" onPress={() => router.back()} />
        </>
      ) : (
        <>
          <NasipButton
            label={t('purchase')}
            icon="sparkles"
            loading={busy === 'buy'}
            disabled={!NASIP_IAP_SUPPORTED}
            onPress={() => void buy()}
          />
          <NasipButton
            label={t('restore')}
            variant="secondary"
            icon="refresh-outline"
            loading={busy === 'restore'}
            disabled={!NASIP_IAP_SUPPORTED}
            onPress={() => void restore()}
          />
          <NasipButton label={t('continueFree')} variant="ghost" onPress={() => router.back()} />
        </>
      )}

      <View style={styles.legalRow}>
        <LegalLink label={t('terms')} onPress={() => router.push('/legal/terms')} />
        <View style={styles.legalDot} />
        <LegalLink label={t('privacyPolicy')} onPress={() => router.push('/legal/privacy')} />
        <View style={styles.legalDot} />
        <LegalLink label={t('rules')} onPress={() => router.push('/legal/community')} />
      </View>
      {!NASIP_IAP_SUPPORTED ? <Text style={styles.platformNote}>{t('storeUnavailable')}</Text> : null}
      <Text style={styles.footer}>
        Abonelik bir eşleşme, iletişim veya evlilik garantisi vermez. Teklif ekranı kapatılabilir; ücretsiz devam
        ettiğinde tekrar tekrar ödeme penceresi açılmaz.
      </Text>
    </NasipScreen>
  );
}

function reasonMessage(reason?: string): string | null {
  switch (reason) {
    case 'quota':
      return 'Günlük tanışma isteği hakkın doldu. Yarın yeniden ücretsiz hakların olacak; PLUS ile günde 20 istek kullanabilirsin.';
    case 'advanced_filters':
      return 'Gelişmiş filtreler NASİP PLUS ile açılır. Temel filtreler ücretsiz kullanılmaya devam eder.';
    case 'visitors':
      return 'Kimlerin profilini gördüğünü görmek NASİP PLUS ile mümkün.';
    case 'invisible':
      return 'Gizli gezinme NASİP PLUS üyeliğinin bir parçasıdır.';
    default:
      return null;
  }
}

function BenefitRow({ label, included }: { label: string; included: boolean }) {
  return (
    <View style={styles.benefitRow}>
      <View style={[styles.benefitIcon, !included && { backgroundColor: '#F1EEF7' }]}>
        <Ionicons name={included ? 'checkmark' : 'remove'} size={12} color={included ? nasipColors.primary : '#9A94A8'} />
      </View>
      <Text style={styles.benefitText}>{label}</Text>
    </View>
  );
}

function LegalLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link">
      <Text style={styles.legalLink}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 9 },
  centerText: { color: nasipColors.textSecondary, fontSize: 11 },
  hero: {
    borderRadius: 26,
    backgroundColor: nasipColors.backgroundSecondary,
    borderWidth: 1,
    borderColor: '#E4D7FA',
    padding: 18,
    gap: 6,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(124,58,237,0.07)',
    right: -50,
    top: -60,
  },
  heroIcon: {
    width: 50,
    height: 50,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  kicker: { color: nasipColors.primary, fontSize: 8.5, fontWeight: '800', letterSpacing: 1.1 },
  heroTitle: { color: nasipColors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.8 },
  heroBody: { color: '#5E586E', fontSize: 12, lineHeight: 17.5 },
  reasonCard: {
    flexDirection: 'row',
    gap: 7,
    backgroundColor: '#FBFAFF',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#E7DDF8',
    padding: 10,
  },
  reasonText: { flex: 1, color: nasipColors.textSecondary, fontSize: 10.5, lineHeight: 15 },
  priceCard: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  planTitle: { color: nasipColors.text, fontSize: 14, fontWeight: '800' },
  planBody: { color: nasipColors.textSecondary, fontSize: 9.5, lineHeight: 13 },
  price: { color: nasipColors.primaryDark, fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  pricePeriod: { color: nasipColors.textSecondary, fontSize: 9, fontWeight: '600' },
  priceUnavailable: { color: nasipColors.warning, fontSize: 9, fontWeight: '700', maxWidth: 150, textAlign: 'right' },
  activeCard: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#F7FCFA', borderColor: '#D9F0E4' },
  activeIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: nasipColors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTitle: { color: '#177D54', fontSize: 12.5, fontWeight: '800' },
  activeBody: { color: '#4C7C69', fontSize: 9.5, lineHeight: 14 },
  sandboxNote: { color: '#4C7C69', fontSize: 9, lineHeight: 13, opacity: 0.85 },
  sectionTitle: { color: nasipColors.text, fontSize: 14, fontWeight: '800' },
  sectionTitleSmall: { color: nasipColors.textSecondary, fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  benefitIcon: {
    width: 21,
    height: 21,
    borderRadius: 7,
    backgroundColor: nasipColors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: { flex: 1, color: nasipColors.text, fontSize: 11, lineHeight: 16 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: nasipColors.divider, marginVertical: 2 },
  freeSafety: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: '#FBFAFF',
    borderRadius: 11,
    padding: 8,
  },
  freeSafetyText: { flex: 1, color: nasipColors.textSecondary, fontSize: 9.5, lineHeight: 14 },
  noteTitle: { color: nasipColors.text, fontSize: 11.5, fontWeight: '800' },
  noteBody: { color: nasipColors.textSecondary, fontSize: 9.5, lineHeight: 14.5 },
  legalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 6 },
  legalLink: { color: nasipColors.primary, fontSize: 9.5, fontWeight: '700', textDecorationLine: 'underline' },
  legalDot: { width: 3, height: 3, borderRadius: 99, backgroundColor: '#C6BFD5' },
  platformNote: { color: nasipColors.warning, fontSize: 9.5, textAlign: 'center' },
  footer: { color: nasipColors.textSecondary, fontSize: 9, lineHeight: 13, textAlign: 'center', paddingBottom: 4 },
});
