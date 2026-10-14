export type PrayerActivityInput = {
  city: string;
  prayerKey: string;
  prayerName: string;
  prayerTime: string;
  endsAt: number;
};

export type SafdasNative = {
  publishWidgetSnapshot?: (json: string) => void;
  isLiveActivityAvailable?: () => boolean;
  start?: (city: string, prayerKey: string, prayerName: string, prayerTime: string, endsAt: number) => Promise<boolean>;
  end?: () => Promise<boolean>;
  canScheduleExactAlarms?: () => boolean;
  openExactAlarmSettings?: () => void;
};

export function publishWidgetSnapshot(json: string): void;
export function liveActivitiesAvailable(): boolean;
export function startPrayerActivity(input: PrayerActivityInput): Promise<boolean>;
export function endPrayerActivity(): Promise<boolean>;
export function canScheduleExactAlarms(): boolean;
export function openExactAlarmSettings(): void;
