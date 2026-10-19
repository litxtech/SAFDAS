import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import Animated, { Easing, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { QiblaCompass } from '@/components/qibla/QiblaCompass';
import { Screen } from '@/components/layout/Screen';
import { AppHeader } from '@/components/ui/AppHeader';
import { useQiblaHeading } from '@/hooks/useQiblaHeading';
import { dateLocale, useI18nStore, useT } from '@/i18n';
import {
  distanceToKaabaKm,
  isAligned,
  qiblaBearing,
  shortestDelta,
} from '@/services/qibla/math';
import { usePrayerStore } from '@/stores/prayerStore';
import { useTheme } from '@/theme/ThemeProvider';

function formatDegrees(value: number) {
  return `${(Math.round(value * 10) / 10).toFixed(1)}°`;
}

function formatOffset(value: number) {
  const rounded = Math.round(value * 10) / 10;
  if (Math.abs(rounded) < 0.05) return '0.0°';
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded).toFixed(1)}°`;
}

export default function QiblaScreen() {
  const { colors, name, reduceMotion: themeReduce } = useTheme();
  const systemReduce = useReducedMotion();
  const reduceMotion = themeReduce || Boolean(systemReduce);
  const dark = name === 'dark';
  const t = useT();
  const locale = useI18nStore((state) => state.locale);
  const location = usePrayerStore((state) => state.location);
  const { width } = useWindowDimensions();
  const focused = useIsFocused();
  const [appActive, setAppActive] = useState(() => AppState.currentState === 'active');
  const [warning, setWarning] = useState<string | null>(null);
  const alignedRef = useRef(false);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => setAppActive(next === 'active'));
    return () => sub.remove();
  }, []);

  const fallback = {
    lat: location.latitude ?? 41.0082,
    lng: location.longitude ?? 28.9784,
  };

  const onPermissionDenied = useCallback(() => setWarning(t('qiblaNoPermission')), [t]);
  const onCompassUnavailable = useCallback(() => setWarning(t('qiblaNoCompass')), [t]);

  const { heading, accuracy, magneticOnly, coords, usingGps, rotation } = useQiblaHeading({
    fallback,
    enabled: focused && appActive,
    onPermissionDenied,
    onCompassUnavailable,
  });

  const bearing = qiblaBearing(coords.lat, coords.lng);
  const delta = heading == null ? null : shortestDelta(heading, bearing);
  const aligned = isAligned(delta);
  const size = Math.min(width - 40, 340);
  const distance = new Intl.NumberFormat(dateLocale(locale), { maximumFractionDigits: 0 }).format(
    distanceToKaabaKm(coords.lat, coords.lng),
  );

  useEffect(() => {
    if (!aligned || alignedRef.current) {
      alignedRef.current = aligned;
      return;
    }
    alignedRef.current = true;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [aligned]);

  const accuracyLabel =
    accuracy >= 3 ? t('qiblaAccuracyHigh') : accuracy === 2 ? t('qiblaAccuracyMedium') : t('qiblaAccuracyLow');

  const instruction =
    delta == null
      ? t('qiblaWaiting')
      : aligned
        ? t('qiblaAligned')
        : t('qiblaTurn', {
            degrees: Math.abs(delta).toFixed(1),
            direction: delta > 0 ? t('qiblaRight') : t('qiblaLeft'),
          });

  const enter = (delay: number) =>
    reduceMotion ? undefined : FadeInDown.delay(delay).duration(360).easing(Easing.out(Easing.cubic));

  const cityLabel = location.district ? `${location.district}, ${location.city}` : location.city;

  return (
    <Screen scroll>
      <AppHeader
        title={t('qibla')}
        subtitle={cityLabel}
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('chooseLocation')}
            onPress={() => router.push('/prayer/location')}
            hitSlop={8}
            style={[styles.menuButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Ionicons name="location-outline" size={20} color={colors.icon} />
          </Pressable>
        }
      />

      <Animated.View entering={enter(40)} style={styles.compassWrap}>
        <QiblaCompass
          size={size}
          rotation={rotation}
          bearing={bearing}
          aligned={aligned}
          centerValue={formatDegrees(bearing)}
          centerLabel={aligned ? t('qiblaAligned') : t('qibla')}
          locale={locale}
        />
      </Animated.View>

      <Animated.View
        entering={enter(140)}
        style={[
          styles.statusCard,
          {
            backgroundColor: aligned ? (dark ? 'rgba(69,198,165,0.16)' : '#E8F8F1') : colors.surface,
            borderColor: aligned ? colors.success : colors.border,
          },
        ]}
      >
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusIcon,
              { backgroundColor: aligned ? colors.success : colors.primaryMuted },
            ]}
          >
            <Ionicons
              name={aligned ? 'checkmark' : 'navigate'}
              size={18}
              color={aligned ? '#FFFFFF' : colors.primary}
            />
          </View>
          <Text style={[styles.statusText, { color: aligned ? colors.success : colors.text }]}>{instruction}</Text>
        </View>
      </Animated.View>

      <Animated.View entering={enter(220)} style={styles.metrics}>
        <View style={[styles.metric, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>{t('qiblaBearing')}</Text>
          <Text style={[styles.metricValue, { color: colors.text }]}>{formatDegrees(bearing)}</Text>
        </View>
        <View style={[styles.metric, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>{t('qiblaHeading')}</Text>
          <Text style={[styles.metricValue, { color: colors.text }]}>
            {heading == null ? '—' : formatDegrees(heading)}
          </Text>
        </View>
        <View style={[styles.metric, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>{t('qiblaOffset')}</Text>
          <Text style={[styles.metricValue, { color: aligned ? colors.success : colors.text }]}>
            {delta == null ? '—' : formatOffset(delta)}
          </Text>
        </View>
      </Animated.View>

      <Animated.View entering={enter(300)} style={styles.meta}>
        <Text style={{ color: colors.textSecondary }}>{t('qiblaDistance', { distance })}</Text>
        <Text style={{ color: colors.textSecondary }}>
          {usingGps ? accuracyLabel : t('qiblaUsingCity', { city: cityLabel })}
        </Text>
        <Text style={{ color: colors.textSecondary, lineHeight: 18 }}>{t('qiblaHoldLevel')}</Text>
        {magneticOnly ? <Text style={{ color: colors.warning, lineHeight: 18 }}>{t('qiblaMagneticOnly')}</Text> : null}
        {warning ? <Text style={{ color: colors.warning, lineHeight: 18 }}>{warning}</Text> : null}
        <Text style={{ color: colors.textSecondary, lineHeight: 18 }}>{t('qiblaCalibration')}</Text>
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  menuButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  compassWrap: { alignItems: 'center', marginTop: 4, marginBottom: 8 },
  statusCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: { flex: 1, fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
  metrics: { flexDirection: 'row', gap: 8 },
  metric: {
    flex: 1,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 12,
    gap: 4,
  },
  metricLabel: { fontSize: 11, fontWeight: '600' },
  metricValue: { fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  meta: { gap: 8, paddingBottom: 8 },
});
