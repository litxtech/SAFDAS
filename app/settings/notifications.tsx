import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { Screen } from '@/components/layout/Screen';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppSwitch } from '@/components/ui/AppSwitch';
import { LEAD_OPTIONS, PRAYER_KEYS, type AlertSound, type LeadMinutes } from '@/services/prayer/alertPlan';
import { useT, type I18nKey } from '@/i18n';
import { requireSupabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { usePrayerStore } from '@/stores/prayerStore';
import { useTheme } from '@/theme/ThemeProvider';
import type { PrayerKey } from '@/services/prayer/types';

const LABELS: Record<PrayerKey, I18nKey> = {
  fajr: 'notifyFajr',
  sunrise: 'notifySunrise',
  dhuhr: 'notifyDhuhr',
  asr: 'notifyAsr',
  maghrib: 'notifyMaghrib',
  isha: 'notifyIsha',
};

const SOUNDS: { id: AlertSound; label: I18nKey }[] = [
  { id: 'system', label: 'soundSystem' },
  { id: 'silent', label: 'soundSilent' },
  { id: 'adhan', label: 'soundAdhan' },
];

export default function NotificationSettings() {
  const t = useT();
  const { colors } = useTheme();
  const userId = useAuthStore((state) => state.session?.user.id);
  const client = useQueryClient();
  const alerts = usePrayerStore((state) => state.alerts);
  const sound = usePrayerStore((state) => state.sound);
  const lockScreen = usePrayerStore((state) => state.lockScreenNotifications);
  const liveActivity = usePrayerStore((state) => state.liveActivityEnabled);
  const quranBackground = usePrayerStore((state) => state.quranBackground);
  const roomBackground = usePrayerStore((state) => state.roomBackground);
  const setAlert = usePrayerStore((state) => state.setAlert);
  const setSound = usePrayerStore((state) => state.setSound);
  const setLockScreen = usePrayerStore((state) => state.setLockScreenNotifications);
  const setLiveActivity = usePrayerStore((state) => state.setLiveActivityEnabled);
  const setQuranBackground = usePrayerStore((state) => state.setQuranBackground);
  const setRoomBackground = usePrayerStore((state) => state.setRoomBackground);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [exactAlarms, setExactAlarms] = useState<boolean | null>(null);

  const query = useQuery({
    queryKey: ['notification-prefs', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data } = await requireSupabase().from('notification_preferences').select('prayer, social, security').eq('user_id', userId).maybeSingle();
      return data ?? { prayer: true, social: true, security: true };
    },
  });
  const prefs = query.data ?? { prayer: true, social: true, security: true };

  useEffect(() => {
    void Notifications.getPermissionsAsync().then((status) => setPermissionGranted(status.granted));
    if (Platform.OS !== 'android') return;
    try {
      const native = require('safdas-activity') as typeof import('safdas-activity');
      setExactAlarms(native.canScheduleExactAlarms());
    } catch {
      setExactAlarms(null);
    }
  }, []);

  async function update(key: 'prayer' | 'social' | 'security', value: boolean) {
    if (!userId) return;
    await requireSupabase().from('notification_preferences').upsert({ user_id: userId, ...prefs, [key]: value });
    void client.invalidateQueries({ queryKey: ['notification-prefs', userId] });
  }

  async function requestPermission() {
    const current = await Notifications.getPermissionsAsync();
    if (!current.granted && current.canAskAgain) {
      const next = await Notifications.requestPermissionsAsync();
      setPermissionGranted(next.granted);
      return;
    }
    await Linking.openSettings();
  }

  return (
    <Screen scroll>
      <AppHeader title={t('backgroundTitle')} subtitle={t('notificationsSubtitle')} />
      {permissionGranted === false ? (
        <AppCard>
          <Text style={{ color: colors.text, lineHeight: 20 }}>{t('notificationPermissionDenied')}</Text>
          <AppButton label={t('openSystemSettings')} variant="secondary" onPress={() => void requestPermission()} />
        </AppCard>
      ) : null}

      <AppCard>
        <Text style={{ color: colors.text, fontWeight: '700' }}>{t('prayerAlerts')}</Text>
        <Text style={{ color: colors.textSecondary, lineHeight: 20 }}>{t('prayerAlertsHint')}</Text>
        <Text style={{ color: colors.textSecondary, lineHeight: 20 }}>{t('alertRescheduleNote')}</Text>
        <Text style={{ color: colors.textSecondary, lineHeight: 20 }}>{t('deliveryLimit')}</Text>
        {PRAYER_KEYS.map((key) => {
          const alert = alerts[key];
          return (
            <View key={key} style={{ gap: 8, paddingTop: 8 }}>
              <AppSwitch label={t(LABELS[key])} value={alert.enabled} onValueChange={(enabled) => setAlert(key, { enabled })} />
              {alert.enabled ? (
                <>
                  <AppSwitch label={t('atTime')} value={alert.atTime} onValueChange={(atTime) => setAlert(key, { atTime })} />
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {LEAD_OPTIONS.map((minutes) => (
                      <LeadChip
                        key={minutes}
                        label={minutes === 0 ? t('leadNone') : t('leadMinutes', { minutes })}
                        selected={alert.leadMinutes === minutes}
                        onPress={() => setAlert(key, { leadMinutes: minutes as LeadMinutes })}
                      />
                    ))}
                  </View>
                </>
              ) : null}
            </View>
          );
        })}
      </AppCard>

      <AppCard>
        <Text style={{ color: colors.text, fontWeight: '700' }}>{t('soundSystem')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {SOUNDS.map((item) => (
            <LeadChip key={item.id} label={t(item.label)} selected={sound === item.id} onPress={() => setSound(item.id)} />
          ))}
        </View>
        {sound === 'adhan' ? <Text style={{ color: colors.textSecondary, lineHeight: 20 }}>{t('adhanMissing')}</Text> : null}
      </AppCard>

      <AppCard>
        <Text style={{ color: colors.text, fontWeight: '700' }}>{t('lockNotifications')}</Text>
        {Platform.OS === 'android' ? (
          <AppSwitch label={t('lockScreenAndroid')} value={lockScreen} onValueChange={setLockScreen} />
        ) : (
          <Text style={{ color: colors.textSecondary, lineHeight: 20 }}>{t('lockScreenSystem')}</Text>
        )}
        <AppButton label={t('openSystemSettings')} variant="secondary" onPress={() => void Linking.openSettings()} />
        {Platform.OS === 'android' ? <Text style={{ color: colors.textSecondary, lineHeight: 20 }}>{t('exactAlarmHint')}</Text> : null}
        {Platform.OS === 'android' && exactAlarms === false ? (
          <AppButton label={t('openExactAlarmSettings')} variant="secondary" onPress={openExactAlarmSettings} />
        ) : null}
      </AppCard>

      <AppCard>
        <AppSwitch label={t('liveActivityPref')} value={liveActivity} onValueChange={setLiveActivity} />
        <Text style={{ color: colors.textSecondary, lineHeight: 20 }}>{t('liveActivityHint')}</Text>
      </AppCard>

      <AppCard>
        <Text style={{ color: colors.text, fontWeight: '700' }}>{t('widgetInfo')}</Text>
        <Text style={{ color: colors.textSecondary, lineHeight: 20 }}>{t('widgetInfoHint')}</Text>
      </AppCard>

      <AppCard>
        <AppSwitch label={t('quranBackground')} value={quranBackground} onValueChange={setQuranBackground} />
        <Text style={{ color: colors.textSecondary, lineHeight: 20 }}>{t('quranBackgroundHint')}</Text>
        <AppSwitch label={t('roomBackground')} value={roomBackground} onValueChange={setRoomBackground} />
        <Text style={{ color: colors.textSecondary, lineHeight: 20 }}>{t('roomBackgroundHint')}</Text>
      </AppCard>

      <AppCard>
        <Text style={{ color: colors.text, fontWeight: '700' }}>{t('notifications')}</Text>
        <AppSwitch label={t('worshipAlerts')} value={Boolean(prefs.prayer)} onValueChange={(value) => void update('prayer', value)} />
        <AppSwitch label={t('socialAlerts')} value={Boolean(prefs.social)} onValueChange={(value) => void update('social', value)} />
        <AppSwitch label={t('securityAlerts')} value={Boolean(prefs.security)} onValueChange={(value) => void update('security', value)} />
      </AppCard>
    </Screen>
  );
}

function LeadChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: selected ? colors.primary : colors.surface,
        borderWidth: 1,
        borderColor: selected ? colors.primary : colors.border,
      }}
    >
      <Text style={{ color: selected ? colors.onPrimary : colors.text }}>{label}</Text>
    </Pressable>
  );
}

function openExactAlarmSettings() {
  try {
    const native = require('safdas-activity') as typeof import('safdas-activity');
    native.openExactAlarmSettings();
  } catch {
    void Linking.openSettings();
  }
}
