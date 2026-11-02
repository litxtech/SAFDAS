import type { Locale } from '@/i18n';
import type {
  NasipGender,
  NasipMaritalStatus,
  NasipMarriageTimeline,
  NasipPhotoVisibility,
  NasipRelocationPreference,
  NasipReportReason,
  NasipShowCity,
  NasipSmoking,
} from './types';

export type NasipOption<T extends string = string> = { value: T; tr: string; en: string };

export const NASIP_GENDERS: NasipOption<NasipGender>[] = [
  { value: 'female', tr: 'Kadın', en: 'Woman' },
  { value: 'male', tr: 'Erkek', en: 'Man' },
  { value: 'self_describe', tr: 'Kendimi tanımlamak istiyorum', en: 'I prefer to self-describe' },
  { value: 'prefer_not_to_say', tr: 'Belirtmek istemiyorum', en: 'Prefer not to say' },
];

export const NASIP_EDUCATION_LEVELS: NasipOption[] = [
  { value: 'primary', tr: 'İlköğretim', en: 'Primary school' },
  { value: 'high_school', tr: 'Lise', en: 'High school' },
  { value: 'associate', tr: 'Ön lisans', en: 'Associate degree' },
  { value: 'bachelor', tr: 'Lisans', en: "Bachelor's degree" },
  { value: 'master', tr: 'Yüksek lisans', en: "Master's degree" },
  { value: 'doctorate', tr: 'Doktora', en: 'Doctorate' },
  { value: 'other', tr: 'Diğer', en: 'Other' },
];

export const NASIP_EMPLOYMENT_STATUSES: NasipOption[] = [
  { value: 'employed', tr: 'Çalışıyorum', en: 'Employed' },
  { value: 'self_employed', tr: 'Kendi işim', en: 'Self-employed' },
  { value: 'student', tr: 'Öğrenciyim', en: 'Student' },
  { value: 'seeking', tr: 'İş arıyorum', en: 'Looking for work' },
  { value: 'retired', tr: 'Emekliyim', en: 'Retired' },
  { value: 'other', tr: 'Diğer', en: 'Other' },
];

export const NASIP_MARITAL_STATUSES: NasipOption<NasipMaritalStatus>[] = [
  { value: 'never_married', tr: 'Hiç evlenmedim', en: 'Never married' },
  { value: 'divorced', tr: 'Boşandım', en: 'Divorced' },
  { value: 'widowed', tr: 'Eşimi kaybettim', en: 'Widowed' },
];

export const NASIP_SMOKING: NasipOption<NasipSmoking>[] = [
  { value: 'never', tr: 'Kullanmıyorum', en: 'Never' },
  { value: 'occasionally', tr: 'Ara sıra', en: 'Occasionally' },
  { value: 'regularly', tr: 'Düzenli', en: 'Regularly' },
];

export const NASIP_TIMELINES: NasipOption<NasipMarriageTimeline>[] = [
  { value: 'within_6_months', tr: '6 ay içinde', en: 'Within 6 months' },
  { value: 'within_1_year', tr: '1 yıl içinde', en: 'Within 1 year' },
  { value: 'within_2_years', tr: '2 yıl içinde', en: 'Within 2 years' },
  { value: 'no_rush', tr: 'Acelesi yok', en: 'No rush' },
];

export const NASIP_RELOCATION_PREFERENCES: NasipOption<NasipRelocationPreference>[] = [
  { value: 'yes', tr: 'Taşınmaya açığım', en: 'Open to relocating' },
  { value: 'maybe', tr: 'Duruma bağlı', en: 'Depends' },
  { value: 'no', tr: 'Taşınmayı düşünmüyorum', en: "I don't plan to relocate" },
];

export const NASIP_PHOTO_VISIBILITY: NasipOption<NasipPhotoVisibility>[] = [
  { value: 'everyone', tr: 'Herkese görünür', en: 'Visible to everyone' },
  { value: 'matches', tr: 'Yalnızca eşleşmelerime görünür', en: 'Only my matches' },
  { value: 'approved', tr: 'İzin verdiğim kişilere görünür', en: 'Only people I approve' },
];

export const NASIP_SHOW_CITY: NasipOption<NasipShowCity>[] = [
  { value: 'city', tr: 'Şehir görünsün', en: 'Show my city' },
  { value: 'region', tr: 'Yalnızca ülke görünsün', en: 'Show only my country' },
  { value: 'hidden', tr: 'Konum görünmesin', en: 'Hide my location' },
];

export const NASIP_REPORT_REASONS: NasipOption<NasipReportReason>[] = [
  { value: 'harassment', tr: 'Taciz veya rahatsız edici davranış', en: 'Harassment or unwanted behaviour' },
  { value: 'spam', tr: 'Spam veya istenmeyen mesaj', en: 'Spam or unwanted messages' },
  { value: 'scam', tr: 'Dolandırıcılık veya para talebi', en: 'Scam or request for money' },
  { value: 'fake_profile', tr: 'Sahte profil', en: 'Fake profile' },
  { value: 'inappropriate_photo', tr: 'Uygunsuz fotoğraf', en: 'Inappropriate photo' },
  { value: 'threat', tr: 'Tehdit', en: 'Threat' },
  { value: 'minor', tr: 'Reşit olmayan kullanıcı', en: 'User appears to be a minor' },
  { value: 'impersonation', tr: 'Kimlik taklidi', en: 'Impersonation' },
  { value: 'other', tr: 'Diğer', en: 'Other' },
];

export const NASIP_PROFILE_STATUS_LABELS: Record<string, { tr: string; en: string; tone: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' }> = {
  draft: { tr: 'Taslak', en: 'Draft', tone: 'neutral' },
  active: { tr: 'Aktif', en: 'Active', tone: 'success' },
  hidden: { tr: 'Gizli', en: 'Hidden', tone: 'warning' },
  frozen: { tr: 'Donduruldu', en: 'Frozen', tone: 'warning' },
  suspended: { tr: 'Askıda', en: 'Suspended', tone: 'danger' },
  deleted: { tr: 'Silindi', en: 'Deleted', tone: 'danger' },
};

export const NASIP_REQUEST_STATUS_LABELS: Record<string, { tr: string; en: string }> = {
  pending: { tr: 'Beklemede', en: 'Pending' },
  accepted: { tr: 'Kabul edildi', en: 'Accepted' },
  declined: { tr: 'Reddedildi', en: 'Declined' },
  withdrawn: { tr: 'Geri çekildi', en: 'Withdrawn' },
  blocked: { tr: 'Engellendi', en: 'Blocked' },
};

export const NASIP_PLUS_BENEFITS = {
  tr: [
    'Günde 20 tanışma isteği',
    'Gelişmiş arama filtreleri',
    'İlgi gösterenleri daha kapsamlı görme',
    'Genişletilmiş şehir ve ülke keşfi',
    'Gizli gezinme modu',
    'Gelişmiş karşılıklı tercih eşleştirmesi',
  ],
  en: [
    '20 introduction requests per day',
    'Advanced search filters',
    'A fuller view of people interested in you',
    'Expanded city and country discovery',
    'Invisible browsing',
    'Advanced mutual-preference matching',
  ],
} as const;

export const NASIP_FREE_BENEFITS = {
  tr: [
    'Evlilik profili oluşturma',
    'Adayları keşfetme',
    'Temel filtreler',
    'Günde 5 tanışma isteği',
    'Karşılıklı kabulden sonra ücretsiz mesajlaşma',
    'Engelleme, şikâyet ve hesap dondurma',
  ],
  en: [
    'Create a marriage profile',
    'Discover candidates',
    'Basic filters',
    '5 introduction requests per day',
    'Free messaging after a mutual match',
    'Blocking, reporting and freezing',
  ],
} as const;

export const NASIP_PRODUCT_IDS = {
  ios: process.env.EXPO_PUBLIC_NASIP_IOS_PRODUCT_ID ?? 'com.litxtech.namazim.nasip.plus.monthly',
  android: process.env.EXPO_PUBLIC_NASIP_ANDROID_PRODUCT_ID ?? 'nasip_plus_monthly',
} as const;

export function nasipOptionLabel(option: NasipOption | undefined, locale: Locale): string {
  if (!option) return '';
  return locale === 'tr' ? option.tr : option.en;
}

export function nasipLabelFor(
  options: NasipOption[],
  value: string | null | undefined,
  locale: Locale,
): string {
  return nasipOptionLabel(options.find((option) => option.value === value), locale) || (value ?? '');
}

export function nasipProfileStatusLabel(status: string, locale: Locale) {
  const row = NASIP_PROFILE_STATUS_LABELS[status];
  return row ? (locale === 'tr' ? row.tr : row.en) : status;
}

/** Local guard only. The server recomputes the age from birth_date. */
export function nasipAgeFromBirthDate(value: string | null | undefined, today = new Date()): number | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || !month || !day) return null;
  let age = today.getFullYear() - year;
  const beforeBirthday =
    today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day);
  if (beforeBirthday) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

export function isNasipAdultBirthDate(value: string | null | undefined): boolean {
  const age = nasipAgeFromBirthDate(value);
  return age !== null && age >= 18;
}

export function isPlausibleNasipBirthDate(value: string | null | undefined): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const age = nasipAgeFromBirthDate(value);
  return age !== null && age >= 0 && age <= 120;
}

export function formatNasipDate(value: string | null | undefined, locale: Locale): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatNasipRelative(value: string | null | undefined, locale: Locale): string {
  if (!value) return '';
  const date = new Date(value).getTime();
  if (Number.isNaN(date)) return '';
  const minutes = Math.max(0, Math.round((Date.now() - date) / 60_000));
  if (minutes < 60) {
    return locale === 'tr' ? `${Math.max(1, minutes)} dk önce` : `${Math.max(1, minutes)}m ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) return locale === 'tr' ? `${hours} sa önce` : `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return locale === 'tr' ? `${days} gün önce` : `${days}d ago`;
  return formatNasipDate(value, locale);
}

export function formatNasipHeight(height: number | null | undefined): string {
  return height ? `${height} cm` : '—';
}
