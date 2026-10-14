import { requireNativeModule } from 'expo-modules-core';

/** @type {import('./index').SafdasNative | null} */
let native = null;
try {
  native = requireNativeModule('SafdasActivity');
} catch {
  native = null;
}

export function publishWidgetSnapshot(json) {
  native?.publishWidgetSnapshot?.(json);
}

export function liveActivitiesAvailable() {
  return Boolean(native?.isLiveActivityAvailable?.());
}

export function startPrayerActivity(input) {
  if (!native?.start) return Promise.resolve(false);
  return native.start(input.city, input.prayerKey, input.prayerName, input.prayerTime, input.endsAt);
}

export function endPrayerActivity() {
  if (!native?.end) return Promise.resolve(false);
  return native.end();
}

export function canScheduleExactAlarms() {
  return Boolean(native?.canScheduleExactAlarms?.() ?? true);
}

export function openExactAlarmSettings() {
  native?.openExactAlarmSettings?.();
}
