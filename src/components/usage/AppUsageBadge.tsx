import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useT } from '@/i18n';
import { useAuthStore } from '@/stores/authStore';
import { formatUsageParts, USAGE_GUEST_KEY, useUsageStore } from '@/stores/usageStore';
import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  /** Compact single-line (side drawer) vs card (profile menu). */
  variant?: 'inline' | 'card';
};

export function AppUsageBadge({ variant = 'inline' }: Props) {
  const { colors, name } = useTheme();
  const t = useT();
  const userId = useAuthStore((state) => state.session?.user.id);
  const usageTotals = useUsageStore((state) => state.totals);
  const usageActiveAt = useUsageStore((state) => state.activeStartedAt);
  const usageActiveKey = useUsageStore((state) => state.activeKey);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);

  const key = userId ?? USAGE_GUEST_KEY;
  const ms =
    (usageTotals[key] ?? 0) +
    (usageActiveAt != null && usageActiveKey === key ? Math.max(0, now - usageActiveAt) : 0);
  const value = formatUsageParts(ms, {
    hours: t('appUsageHours'),
    minutes: t('appUsageMinutes'),
  });

  if (variant === 'card') {
    const surface = name === 'dark' ? 'rgba(255,255,255,0.06)' : colors.backgroundSecondary;
    return (
      <View
        accessibilityRole="text"
        accessibilityLabel={`${t('appUsageLabel')}: ${value}`}
        style={[styles.card, { backgroundColor: surface, borderColor: colors.border }]}
      >
        <View style={[styles.iconWrap, { backgroundColor: colors.primaryMuted }]}>
          <Ionicons name="time-outline" size={20} color={colors.primary} />
        </View>
        <View style={styles.cardText}>
          <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>{t('appUsageLabel')}</Text>
          <Text style={[styles.cardValue, { color: colors.text }]}>{value}</Text>
        </View>
      </View>
    );
  }

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`${t('appUsageLabel')}: ${value}`}
      style={styles.inline}
    >
      <Ionicons name="time-outline" size={16} color={colors.primary} />
      <Text style={[styles.inlineLabel, { color: colors.textSecondary }]}>{t('appUsageLabel')}</Text>
      <Text style={[styles.inlineValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, flexWrap: 'wrap' },
  inlineLabel: { fontSize: 13, fontWeight: '600' },
  inlineValue: { fontSize: 13, fontWeight: '800' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { flex: 1, gap: 2 },
  cardLabel: { fontSize: 13, fontWeight: '600' },
  cardValue: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
});
