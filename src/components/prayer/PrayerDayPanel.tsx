import { useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { formatCountdown, nextPrayer } from '@/services/prayer/service';
import type { PrayerDay, PrayerKey } from '@/services/prayer/types';
import { dateLocale, useI18nStore, useT, type I18nKey } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';

const LABELS: Record<PrayerKey, I18nKey> = {
  fajr: 'fajr',
  sunrise: 'sunrise',
  dhuhr: 'dhuhr',
  asr: 'asr',
  maghrib: 'maghrib',
  isha: 'isha',
};

const ICONS: Record<PrayerKey, keyof typeof Ionicons.glyphMap> = {
  fajr: 'moon-outline',
  sunrise: 'sunny-outline',
  dhuhr: 'sunny',
  asr: 'partly-sunny-outline',
  maghrib: 'cloudy-night-outline',
  isha: 'moon',
};

type Props = {
  day: PrayerDay;
  city: string;
  methodLabel: string;
  notifications: PrayerKey[];
  onToggle: (key: PrayerKey) => void;
  onLocation: () => void;
  onMethod: () => void;
  onQibla: () => void;
  onAlerts: () => void;
  onSalahDuas: () => void;
};

export function PrayerDayPanel({
  day,
  city,
  methodLabel,
  notifications,
  onToggle,
  onLocation,
  onMethod,
  onQibla,
  onAlerts,
  onSalahDuas,
}: Props) {
  const { colors, name, reduceMotion: themeReduce } = useTheme();
  const systemReduce = useReducedMotion();
  const reduceMotion = themeReduce || Boolean(systemReduce);
  const t = useT();
  const locale = useI18nStore((state) => state.locale);
  const focused = useIsFocused();
  const [now, setNow] = useState(() => new Date());
  const dark = name === 'dark';

  useEffect(() => {
    if (!focused) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer) return;
      setNow(new Date());
      timer = setInterval(() => setNow(new Date()), 1000);
    };
    const stop = () => {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    };
    if (AppState.currentState === 'active') start();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') start();
      else stop();
    });
    return () => {
      stop();
      sub.remove();
    };
  }, [focused]);

  const upcoming = nextPrayer(day, now);
  const nowMs = now.getTime();
  const timeLabel = (at: string) =>
    new Date(at).toLocaleTimeString(dateLocale(locale), { hour: '2-digit', minute: '2-digit' });

  const heroColors = dark
    ? (['#2A1F45', '#1E2230', '#171920'] as const)
    : (['#EDE4FF', '#F3EEFF', '#F8F9FC'] as const);

  const enter = (delay: number) =>
    reduceMotion ? undefined : FadeInDown.delay(delay).duration(380).easing(Easing.out(Easing.cubic));
  const fade = (delay: number) => (reduceMotion ? undefined : FadeIn.delay(delay).duration(420));

  const sourceLabel =
    day.source === 'aladhan' ? 'AlAdhan' : day.source === 'cache' ? t('sourceCache') : t('sourceFallback');

  const quick: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    hint?: string;
    onPress: () => void;
  }[] = [
    { icon: 'location-outline', label: t('chooseLocation'), hint: city, onPress: onLocation },
    { icon: 'compass-outline', label: t('qiblaDirection'), onPress: onQibla },
    { icon: 'book-outline', label: t('salahDuasShort'), onPress: onSalahDuas },
    { icon: 'calculator-outline', label: t('prayerMethod'), hint: methodLabel, onPress: onMethod },
    { icon: 'notifications-outline', label: t('notificationSettings'), onPress: onAlerts },
  ];

  return (
    <View style={styles.root}>
      <Animated.View entering={fade(40)}>
        <LinearGradient colors={heroColors} style={styles.hero}>
          <View style={styles.heroTop}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('chooseLocation')}
              onPress={onLocation}
              hitSlop={6}
              style={styles.cityHit}
            >
              <Ionicons name="location" size={14} color={colors.primary} />
              <Text style={[styles.city, { color: colors.text }]} numberOfLines={1}>
                {city}
              </Text>
              <Ionicons name="chevron-down" size={14} color={colors.iconMuted} />
            </Pressable>
            <View style={[styles.sourcePill, { backgroundColor: dark ? 'rgba(166,92,214,0.22)' : '#FFFFFF' }]}>
              <Text style={[styles.sourceText, { color: colors.primary }]}>{sourceLabel}</Text>
            </View>
          </View>

          <Text style={[styles.dateLine, { color: colors.textSecondary }]} numberOfLines={1}>
            {[day.gregorianLabel, day.hijriLabel].filter(Boolean).join(' · ')}
          </Text>

          <Text style={[styles.nextEyebrow, { color: colors.textSecondary }]}>{t('nextPrayer')}</Text>
          <Text style={[styles.nextName, { color: colors.text }]}>
            {upcoming ? t(LABELS[upcoming.key]) : t('prayersDone')}
          </Text>
          <Text style={[styles.countdown, { color: colors.primary }]}>
            {upcoming ? formatCountdown(upcoming.at, now) : '--:--:--'}
          </Text>
        </LinearGradient>
      </Animated.View>

      <Animated.View entering={enter(120)} style={styles.quickRow}>
        {quick.map((item) => (
          <Pressable
            key={item.label}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            onPress={item.onPress}
            style={({ pressed }) => [
              styles.quickChip,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <View style={[styles.quickIcon, { backgroundColor: colors.primaryMuted }]}>
              <Ionicons name={item.icon} size={16} color={colors.primary} />
            </View>
            <Text style={[styles.quickLabel, { color: colors.text }]} numberOfLines={1}>
              {item.label}
            </Text>
            {item.hint ? (
              <Text style={[styles.quickHint, { color: colors.textSecondary }]} numberOfLines={1}>
                {item.hint}
              </Text>
            ) : null}
          </Pressable>
        ))}
      </Animated.View>

      <Animated.View entering={enter(160)}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('salahDuasTitle')}
          onPress={onSalahDuas}
          style={({ pressed }) => [
            styles.duasCard,
            {
              backgroundColor: dark ? 'rgba(166,92,214,0.16)' : colors.primaryMuted,
              borderColor: colors.primary,
              opacity: pressed ? 0.94 : 1,
            },
          ]}
        >
          <View style={[styles.duasIcon, { backgroundColor: colors.surface }]}>
            <Ionicons name="musical-notes-outline" size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.duasTitle, { color: colors.text }]}>{t('salahDuasTitle')}</Text>
            <Text style={[styles.duasSub, { color: colors.textSecondary }]} numberOfLines={2}>
              {t('salahDuasCardHint')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.primary} />
        </Pressable>
      </Animated.View>

      <Animated.View entering={enter(200)} style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('prayerTimes')}</Text>
        <View style={styles.timeline}>
          {day.timings.map((item, index) => {
            const atMs = new Date(item.at).getTime();
            const isNext = upcoming?.key === item.key;
            const isPast = atMs <= nowMs && !isNext;
            const isLast = index === day.timings.length - 1;
            return (
              <View key={item.key} style={styles.timelineRow}>
                <View style={styles.rail}>
                  <View
                    style={[
                      styles.dot,
                      {
                        backgroundColor: isNext ? colors.primary : isPast ? colors.border : colors.primaryMuted,
                        borderColor: isNext ? colors.primary : 'transparent',
                      },
                      isNext && styles.dotActive,
                    ]}
                  >
                    <Ionicons
                      name={ICONS[item.key]}
                      size={isNext ? 14 : 12}
                      color={isNext ? colors.onPrimary : isPast ? colors.iconMuted : colors.primary}
                    />
                  </View>
                  {!isLast ? (
                    <View style={[styles.railLine, { backgroundColor: colors.border }]} />
                  ) : null}
                </View>
                <View
                  style={[
                    styles.timeCard,
                    {
                      backgroundColor: isNext ? colors.primaryMuted : 'transparent',
                      borderColor: isNext ? colors.primary : 'transparent',
                    },
                    isNext && styles.timeCardActive,
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.timeName,
                        { color: isPast && !isNext ? colors.textSecondary : colors.text },
                        isNext && { color: colors.primary, fontWeight: '800' },
                      ]}
                    >
                      {t(LABELS[item.key])}
                    </Text>
                    {isNext ? (
                      <Text style={[styles.timeHint, { color: colors.primary }]}>{t('nextPrayer')}</Text>
                    ) : null}
                  </View>
                  <Text
                    style={[
                      styles.timeValue,
                      { color: isPast && !isNext ? colors.textSecondary : colors.text },
                      isNext && { color: colors.primary },
                    ]}
                  >
                    {timeLabel(item.at)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </Animated.View>

      <Animated.View entering={enter(280)} style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('lockNotifications')}</Text>
          <Pressable accessibilityRole="button" onPress={onAlerts} hitSlop={8}>
            <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>{t('notificationSettings')}</Text>
          </Pressable>
        </View>
        <View style={[styles.notifyList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {(Object.keys(LABELS) as PrayerKey[]).map((key, index, list) => {
            const on = notifications.includes(key);
            const last = index === list.length - 1;
            return (
              <Pressable
                key={key}
                accessibilityRole="switch"
                accessibilityState={{ checked: on }}
                accessibilityLabel={t(LABELS[key])}
                onPress={() => onToggle(key)}
                style={[
                  styles.notifyRow,
                  !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                ]}
              >
                <View style={[styles.notifyIcon, { backgroundColor: on ? colors.primaryMuted : colors.backgroundSecondary }]}>
                  <Ionicons name={ICONS[key]} size={16} color={on ? colors.primary : colors.iconMuted} />
                </View>
                <Text style={[styles.notifyLabel, { color: colors.text }]}>{t(LABELS[key])}</Text>
                <View
                  style={[
                    styles.toggleTrack,
                    { backgroundColor: on ? colors.primary : colors.border },
                  ]}
                >
                  <View style={[styles.toggleThumb, on && styles.toggleThumbOn]} />
                </View>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>{t('lockNotificationsHint')}</Text>
        {day.disclaimer ? (
          <Text style={[styles.hint, { color: colors.textSecondary }]} numberOfLines={3}>
            {day.disclaimer}
          </Text>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 18 },
  hero: {
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 22,
    overflow: 'hidden',
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  cityHit: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  city: { fontSize: 15, fontWeight: '700', maxWidth: 180 },
  sourcePill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  sourceText: { fontSize: 11, fontWeight: '700' },
  dateLine: { marginTop: 10, fontSize: 13, lineHeight: 18 },
  nextEyebrow: { marginTop: 22, fontSize: 13, fontWeight: '600', letterSpacing: 0.2 },
  nextName: {
    marginTop: 4,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  countdown: {
    marginTop: 6,
    fontSize: 40,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
  },
  duasCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  duasIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  duasTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  duasSub: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickChip: {
    width: '48%',
    flexGrow: 1,
    minWidth: '46%',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 6,
  },
  quickIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: { fontSize: 13, fontWeight: '700' },
  quickHint: { fontSize: 11, lineHeight: 14 },
  section: { gap: 10 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
  timeline: { gap: 0 },
  timelineRow: { flexDirection: 'row', minHeight: 58 },
  rail: { width: 36, alignItems: 'center' },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    marginTop: 8,
  },
  dotActive: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginTop: 6,
  },
  railLine: { flex: 1, width: 2, marginTop: 4, marginBottom: 0, borderRadius: 1 },
  timeCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 4,
    gap: 10,
  },
  timeCardActive: { borderWidth: 1.5 },
  timeName: { fontSize: 16, fontWeight: '700' },
  timeHint: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  timeValue: { fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  notifyList: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  notifyRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 12,
  },
  notifyIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifyLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
  toggleTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    padding: 3,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  toggleThumbOn: { alignSelf: 'flex-end' },
  hint: { fontSize: 12, lineHeight: 17 },
});
