import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_LOCATION } from '@/data/locations';
import {
  defaultAlerts,
  enabledPrayerKeys,
  isLeadMinutes,
  PRAYER_KEYS,
  type AlertSound,
  type LeadMinutes,
  type PrayerAlert,
  type PrayerAlerts,
} from '@/services/prayer/alertPlan';
import { methodForCountry } from '@/services/prayer/methods';
import type { PrayerKey, PrayerLocation } from '@/services/prayer/types';

type PrayerPrefs = {
  location: PrayerLocation;
  methodId: number;
  methodOverridden: boolean;
  notifications: PrayerKey[];
  alerts: PrayerAlerts;
  sound: AlertSound;
  lockScreenNotifications: boolean;
  liveActivityEnabled: boolean;
  quranBackground: boolean;
  roomBackground: boolean;
  setLocation: (location: PrayerLocation) => void;
  setMethodId: (methodId: number) => void;
  toggleNotification: (key: PrayerKey) => void;
  setAlert: (key: PrayerKey, patch: Partial<PrayerAlert>) => void;
  setSound: (sound: AlertSound) => void;
  setLockScreenNotifications: (value: boolean) => void;
  setLiveActivityEnabled: (value: boolean) => void;
  setQuranBackground: (value: boolean) => void;
  setRoomBackground: (value: boolean) => void;
};

const initialLocation: PrayerLocation = {
  countryCode: DEFAULT_LOCATION.countryCode,
  countryName: DEFAULT_LOCATION.countryName,
  city: DEFAULT_LOCATION.city,
  district: null,
  latitude: DEFAULT_LOCATION.latitude,
  longitude: DEFAULT_LOCATION.longitude,
  timezone: DEFAULT_LOCATION.timezone,
  utcOffsetMinutes: DEFAULT_LOCATION.utcOffsetMinutes,
  source: 'manual',
};

const initialNotifications: PrayerKey[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

function normalizeAlerts(alerts: Partial<PrayerAlerts> | undefined, notifications: PrayerKey[]): PrayerAlerts {
  const base = alerts ?? defaultAlerts(notifications);
  const next = defaultAlerts(notifications);
  for (const key of PRAYER_KEYS) {
    const item = base[key];
    const lead = item?.leadMinutes ?? 0;
    next[key] = {
      enabled: item?.enabled ?? next[key].enabled,
      atTime: item?.atTime !== false,
      leadMinutes: isLeadMinutes(lead) ? lead : 0,
    };
  }
  return next;
}

export const usePrayerStore = create<PrayerPrefs>()(
  persist(
    (set) => ({
      location: initialLocation,
      methodId: methodForCountry(DEFAULT_LOCATION.countryCode),
      methodOverridden: false,
      notifications: initialNotifications,
      alerts: defaultAlerts(initialNotifications),
      sound: 'system',
      lockScreenNotifications: true,
      liveActivityEnabled: false,
      quranBackground: true,
      roomBackground: true,
      setLocation: (location) =>
        set((state) => ({
          location,
          methodId: state.methodOverridden ? state.methodId : methodForCountry(location.countryCode),
        })),
      setMethodId: (methodId) => set({ methodId, methodOverridden: true }),
      toggleNotification: (key) =>
        set((state) => {
          const alerts = { ...state.alerts, [key]: { ...state.alerts[key], enabled: !state.alerts[key].enabled } };
          return { alerts, notifications: enabledPrayerKeys(alerts) };
        }),
      setAlert: (key, patch) =>
        set((state) => {
          const current = state.alerts[key];
          const lead = patch.leadMinutes ?? current.leadMinutes;
          const alerts = {
            ...state.alerts,
            [key]: {
              ...current,
              ...patch,
              leadMinutes: isLeadMinutes(lead) ? lead : current.leadMinutes,
            },
          };
          return { alerts, notifications: enabledPrayerKeys(alerts) };
        }),
      setSound: (sound) => set({ sound }),
      setLockScreenNotifications: (lockScreenNotifications) => set({ lockScreenNotifications }),
      setLiveActivityEnabled: (liveActivityEnabled) => set({ liveActivityEnabled }),
      setQuranBackground: (quranBackground) => set({ quranBackground }),
      setRoomBackground: (roomBackground) => set({ roomBackground }),
    }),
    {
      name: 'safdas-prayer',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        location: state.location,
        methodId: state.methodId,
        methodOverridden: state.methodOverridden,
        notifications: state.notifications,
        alerts: state.alerts,
        sound: state.sound,
        lockScreenNotifications: state.lockScreenNotifications,
        liveActivityEnabled: state.liveActivityEnabled,
        quranBackground: state.quranBackground,
        roomBackground: state.roomBackground,
      }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<PrayerPrefs>;
        const notifications = saved.notifications ?? current.notifications;
        const alerts = normalizeAlerts(saved.alerts, notifications);
        const sound = saved.sound === 'silent' || saved.sound === 'system' || saved.sound === 'adhan' ? saved.sound : 'system';
        return {
          ...current,
          ...saved,
          alerts,
          notifications: enabledPrayerKeys(alerts),
          sound,
          lockScreenNotifications: saved.lockScreenNotifications ?? true,
          liveActivityEnabled: saved.liveActivityEnabled ?? false,
          quranBackground: saved.quranBackground ?? true,
          roomBackground: saved.roomBackground ?? true,
        };
      },
    },
  ),
);

export type { LeadMinutes };
