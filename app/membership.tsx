import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import Animated from 'react-native-reanimated';
import {
  SpotButton,
  SpotGlass,
  SpotSettingsHeader,
  SpotSettingsSection,
  SpotShell,
  spot,
} from '@/components/settings/SpotSettings';
import { spotEnter } from '@/components/auth/SpotAuth';
import { MembershipTick } from '@/components/membership/MembershipTick';
import { MembershipCheckMark } from '@/components/membership/MembershipCheckMark';
import { useI18nStore, useT } from '@/i18n';
import { useStorePlanPrice, warmStorePrices } from '@/services/store/priceCache';
import {
  MEMBERSHIP_PLANS,
  MEMBERSHIP_PLAN_ORDER,
  MEMBERSHIP_RED,
  formatMembershipEnd,
  membershipStatusKey,
  planBenefits,
  planTagline,
  useProfileMembership,
  type MembershipPlanKey,
} from '@/services/membership';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/theme/ThemeProvider';

export default function MembershipScreen() {
  const t = useT();
  const locale = useI18nStore((state) => state.locale);
  const { reduceMotion } = useTheme();
  const userId = useAuthStore((state) => state.session?.user.id);
  const { plans, primary } = useProfileMembership(userId);

  // Prices are cached from the last store response and fall back to the
  // catalog label, so a package card never waits on the store.
  const nasipPrice = useStorePlanPrice('nasip_plus');
  const seekerPrice = useStorePlanPrice('seeker_plus');
  const employerPrice = useStorePlanPrice('employer_pro');
  const planPrice = {
    nasip_plus: nasipPrice,
    seeker_plus: seekerPrice,
    employer_pro: employerPrice,
  } satisfies Record<MembershipPlanKey, string>;

  useEffect(() => {
    void warmStorePrices();
  }, []);

  function openPlan(key: MembershipPlanKey) {
    if (key === 'nasip_plus') {
      router.push('/nasip/subscription');
      return;
    }
    router.push({ pathname: '/jobs/subscription', params: { product: key } });
  }

  const activeKeys = new Set(plans.map((plan) => plan.key));
  const end = primary ? formatMembershipEnd(primary.expiresAt, locale) : '';

  return (
    <SpotShell scroll>
      <SpotSettingsHeader title={t('membershipTitle')} subtitle={t('membershipSubtitle')} />

      <Animated.View entering={spotEnter(40, reduceMotion)}>
        <SpotGlass strong style={styles.hero}>
          <LinearGradient
            pointerEvents="none"
            colors={[`${MEMBERSHIP_RED}38`, 'rgba(255,45,85,0.02)', 'rgba(0,0,0,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.heroHead}>
            {primary ? (
              <View style={styles.heroTick}>
                <LinearGradient
                  colors={['#FF6B86', '#DD0F3E']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <MembershipCheckMark size={46} />
              </View>
            ) : (
              <View style={styles.heroIcon}>
                <Ionicons name="sparkles" size={22} color={spot.accent} />
              </View>
            )}
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.kicker}>{t('membershipYourPlan')}</Text>
              <Text style={styles.heroTitle}>{primary?.name ?? t('membershipFreeAccount')}</Text>
              <Text style={styles.heroBody}>
                {primary
                  ? `${t(membershipStatusKey(primary.status))}${end ? ` · ${t('membershipActiveUntil')} ${end}` : ''}`
                  : t('membershipFreeAccountHint')}
              </Text>
            </View>
            {primary && userId ? <MembershipTick userId={userId} size={22} /> : null}
          </View>

          {plans.length > 1 ? (
            <View style={styles.planPills}>
              {plans.map((plan) => (
                <View key={`${plan.key}-${plan.expiresAt ?? 'none'}`} style={styles.planPill}>
                  <View style={[styles.planPillDot, { backgroundColor: MEMBERSHIP_PLANS[plan.key]?.accent ?? spot.accent }]} />
                  <Text style={styles.planPillText}>{plan.name}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {primary ? (
            <SpotButton label={t('membershipManage')} onPress={() => openPlan(primary.key)} />
          ) : null}
        </SpotGlass>
      </Animated.View>

      <SpotSettingsSection title={t('membershipPackagesSubtitle')} />
      {MEMBERSHIP_PLAN_ORDER.map((key, index) => {
        const meta = MEMBERSHIP_PLANS[key];
        const active = activeKeys.has(key);
        const benefits = planBenefits(meta, locale).slice(0, 4);
        return (
          <Animated.View key={key} entering={spotEnter(80 + index * 40, reduceMotion)}>
            <SpotGlass strong style={styles.planCard}>
              <LinearGradient
                pointerEvents="none"
                colors={[`${meta.accent}2E`, 'rgba(0,0,0,0)', 'rgba(0,0,0,0)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.planHead}>
                <View style={[styles.planIcon, { backgroundColor: meta.tint, borderColor: `${meta.accent}55` }]}>
                  <Ionicons name={meta.icon} size={22} color={meta.accent} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={styles.planNameRow}>
                    <Text style={styles.planName}>{meta.name}</Text>
                    {active ? (
                      <View style={styles.activeChip}>
                        <Ionicons name="checkmark-circle" size={11} color="#FFFFFF" />
                        <Text style={styles.activeChipText}>{t('membershipActivePackage')}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.planTagline}>{planTagline(meta, locale)}</Text>
                </View>
              </View>

              <View style={styles.benefits}>
                {benefits.map((benefit) => (
                  <View key={benefit} style={styles.benefitRow}>
                    <View style={[styles.benefitDot, { backgroundColor: meta.tint, borderColor: `${meta.accent}66` }]}>
                      <Ionicons name="checkmark" size={10} color={meta.accent} />
                    </View>
                    <Text style={styles.benefitText}>{benefit}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.planFoot}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.priceHint}>
                    {planPrice[key]} <Text style={styles.pricePeriod}>/ {t('membershipPerMonth')}</Text>
                  </Text>
                  <Text style={styles.priceStore}>{t('membershipPriceStore')}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => openPlan(key)}
                  style={({ pressed }) => [styles.planCta, { backgroundColor: meta.accent }, pressed && { opacity: 0.85 }]}
                >
                  <Text style={styles.planCtaText}>{t('membershipCta')}</Text>
                  <Ionicons name="arrow-forward" size={14} color="#12080C" />
                </Pressable>
              </View>
            </SpotGlass>
          </Animated.View>
        );
      })}

      <Animated.View entering={spotEnter(240, reduceMotion)}>
        <SpotGlass style={styles.safety}>
          <View style={styles.safetyRow}>
            <View style={styles.safetyIcon}>
              <Ionicons name="shield-checkmark" size={18} color={spot.accent} />
            </View>
            <Text style={styles.safetyText}>{t('membershipSafetyNote')}</Text>
          </View>
        </SpotGlass>
        <Text style={styles.footer}>
          LITXTECH LLC · support@litxtech.com
        </Text>
      </Animated.View>
    </SpotShell>
  );
}

const styles = StyleSheet.create({
  hero: { padding: 0, gap: 14 },
  heroHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroTick: {
    width: 46,
    height: 46,
    borderRadius: 23,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  heroIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(30,215,96,0.14)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(30,215,96,0.34)',
  },
  kicker: { color: MEMBERSHIP_RED, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  heroTitle: { color: spot.ink, fontSize: 23, fontWeight: '800', letterSpacing: -0.5 },
  heroBody: { color: spot.muted, fontSize: 12, lineHeight: 17 },
  planPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  planPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  planPillDot: { width: 6, height: 6, borderRadius: 3 },
  planPillText: { color: spot.ink, fontSize: 10.5, fontWeight: '700' },
  planCard: { padding: 0, gap: 13 },
  planHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  planIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  planNameRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  planName: { color: spot.ink, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: MEMBERSHIP_RED,
  },
  activeChipText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
  planTagline: { color: spot.muted, fontSize: 12, lineHeight: 17 },
  benefits: { gap: 7 },
  benefitRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  benefitDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 1,
  },
  benefitText: { flex: 1, color: spot.ink, fontSize: 12.5, lineHeight: 18 },
  planFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: spot.line,
  },
  priceHint: { color: spot.ink, fontSize: 12.5, fontWeight: '800' },
  pricePeriod: { color: spot.muted, fontSize: 10.5, fontWeight: '600' },
  priceStore: { color: spot.dim, fontSize: 10.5 },
  planCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  planCtaText: { color: '#12080C', fontSize: 12.5, fontWeight: '800' },
  safety: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  safetyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  safetyIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(30,215,96,0.12)',
  },
  safetyText: { flex: 1, color: spot.muted, fontSize: 11.5, lineHeight: 17 },
  footer: { color: spot.dim, fontSize: 11, textAlign: 'center', marginTop: 10 },
});
