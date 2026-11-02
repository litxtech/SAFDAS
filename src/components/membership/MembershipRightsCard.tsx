import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useT } from '@/i18n';
import { fetchEntitlements, fetchMyOrganizations } from '@/services/jobs/api';
import { fetchNasipEntitlements } from '@/services/nasip/api';
import { useProfileMembership } from '@/services/membership';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  /** Closes the drawer before navigating. */
  onNavigate: () => void;
};

type RightsRow = {
  key: string;
  label: string;
  period: string;
  used: number;
  limit: number;
};

/**
 * Compact used/remaining allowance card for the profile menu.
 * Every number comes from the same server entitlements the plan screens use,
 * including the local grant applied right after a purchase.
 */
export function MembershipRightsCard({ onNavigate }: Props) {
  const { colors, name } = useTheme();
  const t = useT();
  const userId = useAuthStore((state) => state.session?.user.id);

  const nasip = useQuery({
    queryKey: ['nasip-entitlements', userId],
    queryFn: fetchNasipEntitlements,
    enabled: Boolean(userId),
    staleTime: 60_000,
  });
  const orgs = useQuery({
    queryKey: ['job-orgs', userId],
    queryFn: () => fetchMyOrganizations(userId!),
    enabled: Boolean(userId),
    staleTime: 5 * 60_000,
  });
  const orgId = orgs.data?.[0]?.id ?? null;
  const jobs = useQuery({
    queryKey: ['job-entitlements', orgId],
    queryFn: () => fetchEntitlements(orgId),
    enabled: Boolean(userId),
    staleTime: 60_000,
  });
  const membership = useProfileMembership(userId);

  const nasipLimit = nasip.data?.daily_request_limit ?? 5;
  const nasipUsed = nasip.data?.requests_used_today ?? 0;
  const jobLimits = jobs.data?.limits;
  const jobUsage = jobs.data?.usage;

  const rows: RightsRow[] = [
    {
      key: 'nasip',
      label: t('profileRightsNasip'),
      period: t('profileRightsToday'),
      used: nasipUsed,
      limit: nasipLimit,
    },
  ];
  if (jobLimits && (jobLimits.direct_messages > 0 || (jobUsage?.direct_messages ?? 0) > 0)) {
    rows.push({
      key: 'job-messages',
      label: t('profileRightsJobMessages'),
      period: t('profileRightsMonth'),
      used: jobUsage?.direct_messages ?? 0,
      limit: jobLimits.direct_messages,
    });
  }
  if (jobLimits && (jobLimits.direct_invites > 0 || (jobUsage?.direct_invites ?? 0) > 0)) {
    rows.push({
      key: 'job-invites',
      label: t('profileRightsJobInvites'),
      period: t('profileRightsMonth'),
      used: jobUsage?.direct_invites ?? 0,
      limit: jobLimits.direct_invites,
    });
  }

  const planNames = membership.plans.map((plan) => plan.name);
  const surface = name === 'dark' ? 'rgba(255,255,255,0.06)' : colors.backgroundSecondary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t('profileRightsTitle')}: ${t('profileRightsSubtitle')}`}
      onPress={onNavigate}
      style={({ pressed }) => [styles.card, { backgroundColor: surface, borderColor: colors.border }, pressed && { opacity: 0.88 }]}
    >
      <View style={styles.head}>
        <View style={[styles.iconWrap, { backgroundColor: colors.primaryMuted }]}>
          <Ionicons name="ribbon-outline" size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={[styles.title, { color: colors.text }]}>{t('profileRightsTitle')}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('profileRightsSubtitle')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
      </View>

      {planNames.length > 0 ? (
        <View style={styles.pills}>
          {planNames.map((planName) => (
            <View key={planName} style={[styles.pill, { backgroundColor: colors.primaryMuted }]}>
              <Ionicons name="sparkles" size={10} color={colors.primary} />
              <Text style={[styles.pillText, { color: colors.primary }]}>{planName}</Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={[styles.pill, { backgroundColor: colors.backgroundSecondary }]}>
          <Text style={[styles.pillText, { color: colors.textSecondary }]}>{t('profileRightsFree')}</Text>
        </View>
      )}

      {rows.map((row) => {
        const limit = Math.max(1, row.limit);
        const used = Math.max(0, row.used);
        const left = Math.max(0, row.limit - used);
        const pct = Math.max(0, Math.min(100, (used / limit) * 100));
        return (
          <View key={row.key} style={styles.row}>
            <View style={styles.rowHead}>
              <Text style={[styles.rowLabel, { color: colors.text }]} numberOfLines={1}>
                {row.label}
              </Text>
              <Text style={[styles.rowPeriod, { color: colors.textSecondary }]}>{row.period}</Text>
            </View>
            <View style={styles.rowStats}>
              <Text style={[styles.rowUsed, { color: colors.textSecondary }]}>
                {t('profileRightsUsed', { used })}
              </Text>
              <Text style={[styles.rowLeft, { color: colors.primary }]}>
                {t('profileRightsLeft', { left })}
              </Text>
            </View>
            <View style={[styles.track, { backgroundColor: colors.divider }]}>
              <View style={[styles.fill, { width: `${pct}%`, backgroundColor: colors.primary }]} />
            </View>
          </View>
        );
      })}

      <Text style={[styles.cta, { color: colors.primary }]}>{t('profileRightsCta')} →</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 10,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 14, fontWeight: '800' },
  subtitle: { fontSize: 11.5 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pillText: { fontSize: 10, fontWeight: '800' },
  row: { gap: 4 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowLabel: { flex: 1, fontSize: 12, fontWeight: '700' },
  rowPeriod: { fontSize: 9.5, fontWeight: '600' },
  rowStats: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowUsed: { fontSize: 10.5, fontWeight: '600' },
  rowLeft: { fontSize: 10.5, fontWeight: '800' },
  track: { height: 4, borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },
  cta: { fontSize: 11, fontWeight: '800', paddingTop: 2 },
});
