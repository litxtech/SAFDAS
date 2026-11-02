import type { Locale } from '@/i18n';
import type { ApplicationStatus, JobSearchStatus, JobVisibility, WorkType } from './types';

export type Option<T extends string = string> = { value: T; tr: string; en: string };

export const WORK_TYPES: Option<WorkType>[] = [
  { value: 'full_time', tr: 'Tam zamanlı', en: 'Full-time' },
  { value: 'part_time', tr: 'Yarı zamanlı', en: 'Part-time' },
  { value: 'remote', tr: 'Uzaktan', en: 'Remote' },
  { value: 'hybrid', tr: 'Hibrit', en: 'Hybrid' },
  { value: 'seasonal', tr: 'Dönemsel', en: 'Seasonal' },
  { value: 'internship', tr: 'Staj', en: 'Internship' },
];

export const EXPERIENCE_LEVELS: Option[] = [
  { value: 'entry', tr: 'Yeni başlayan', en: 'Entry level' },
  { value: 'junior', tr: 'Junior', en: 'Junior' },
  { value: 'mid', tr: 'Orta seviye', en: 'Mid level' },
  { value: 'senior', tr: 'Kıdemli', en: 'Senior' },
  { value: 'lead', tr: 'Yönetici / Lider', en: 'Lead' },
];

export const EDUCATION_LEVELS: Option[] = [
  { value: 'primary', tr: 'İlköğretim', en: 'Primary school' },
  { value: 'high_school', tr: 'Lise', en: 'High school' },
  { value: 'associate', tr: 'Ön lisans', en: 'Associate degree' },
  { value: 'bachelor', tr: 'Lisans', en: 'Bachelor’s degree' },
  { value: 'master', tr: 'Yüksek lisans', en: 'Master’s degree' },
  { value: 'doctorate', tr: 'Doktora', en: 'Doctorate' },
  { value: 'other', tr: 'Diğer', en: 'Other' },
];

export const JOB_SEARCH_STATUS: Option<JobSearchStatus>[] = [
  { value: 'actively_looking', tr: 'Aktif olarak iş arıyorum', en: 'Actively looking' },
  { value: 'open', tr: 'Fırsatlara açığım', en: 'Open to opportunities' },
  { value: 'not_looking', tr: 'Şu an iş aramıyorum', en: 'Not looking right now' },
];

export const VISIBILITY_OPTIONS: Option<JobVisibility>[] = [
  { value: 'employers', tr: 'İşverenlere görünür', en: 'Visible to employers' },
  { value: 'applied_only', tr: 'Yalnızca başvurduğum işverenlere görünür', en: 'Only employers I applied to' },
  { value: 'hidden', tr: 'Profilimi gizle', en: 'Hide my profile' },
];

export const APPLICATION_STATUSES: { value: ApplicationStatus; tr: string; en: string; tone: 'primary' | 'neutral' | 'success' | 'warning' | 'danger' }[] = [
  { value: 'submitted', tr: 'Başvuru gönderildi', en: 'Submitted', tone: 'neutral' },
  { value: 'reviewing', tr: 'İnceleniyor', en: 'Under review', tone: 'warning' },
  { value: 'interview', tr: 'Görüşmeye davet', en: 'Interview', tone: 'primary' },
  { value: 'offer', tr: 'Teklif gönderildi', en: 'Offer sent', tone: 'primary' },
  { value: 'hired', tr: 'İşe alındı', en: 'Hired', tone: 'success' },
  { value: 'rejected', tr: 'Olumsuz sonuçlandı', en: 'Not selected', tone: 'danger' },
  { value: 'withdrawn', tr: 'Aday geri çekti', en: 'Withdrawn', tone: 'neutral' },
];

export const CONTRACT_TYPES: Option[] = [
  { value: 'permanent', tr: 'Belirsiz süreli', en: 'Permanent' },
  { value: 'fixed_term', tr: 'Belirli süreli', en: 'Fixed-term' },
  { value: 'freelance', tr: 'Serbest / Freelance', en: 'Freelance' },
  { value: 'internship', tr: 'Staj sözleşmesi', en: 'Internship contract' },
];

export const CURRENCIES: Option[] = [
  { value: 'TRY', tr: 'TRY — Türk lirası', en: 'TRY — Turkish lira' },
  { value: 'EUR', tr: 'EUR — Euro', en: 'EUR — Euro' },
  { value: 'USD', tr: 'USD — Dolar', en: 'USD — US dollar' },
  { value: 'GBP', tr: 'GBP — Sterlin', en: 'GBP — Pound sterling' },
  { value: 'AED', tr: 'AED — Dirhem', en: 'AED — Dirham' },
  { value: 'SAR', tr: 'SAR — Riyal', en: 'SAR — Riyal' },
  { value: 'QAR', tr: 'QAR — Riyal', en: 'QAR — Riyal' },
  { value: 'KWD', tr: 'KWD — Dinar', en: 'KWD — Dinar' },
  { value: 'CAD', tr: 'CAD — Kanada doları', en: 'CAD — Canadian dollar' },
  { value: 'AZN', tr: 'AZN — Manat', en: 'AZN — Manat' },
  { value: 'MYR', tr: 'MYR — Ringgit', en: 'MYR — Ringgit' },
  { value: 'EGP', tr: 'EGP — Mısır poundu', en: 'EGP — Egyptian pound' },
  { value: 'PKR', tr: 'PKR — Pakistan rupisi', en: 'PKR — Pakistani rupee' },
  { value: 'IDR', tr: 'IDR — Endonezya rupisi', en: 'IDR — Indonesian rupiah' },
];

export const SALARY_PERIODS: Option[] = [
  { value: 'monthly', tr: 'Aylık', en: 'Monthly' },
  { value: 'hourly', tr: 'Saatlik', en: 'Hourly' },
  { value: 'yearly', tr: 'Yıllık', en: 'Yearly' },
];

export const LANGUAGE_OPTIONS = [
  { code: 'tr', tr: 'Türkçe', en: 'Turkish' },
  { code: 'en', tr: 'İngilizce', en: 'English' },
  { code: 'de', tr: 'Almanca', en: 'German' },
  { code: 'ar', tr: 'Arapça', en: 'Arabic' },
  { code: 'fr', tr: 'Fransızca', en: 'French' },
  { code: 'es', tr: 'İspanyolca', en: 'Spanish' },
  { code: 'nl', tr: 'Felemenkçe', en: 'Dutch' },
  { code: 'ru', tr: 'Rusça', en: 'Russian' },
  { code: 'az', tr: 'Azerbaycanca', en: 'Azerbaijani' },
  { code: 'ur', tr: 'Urduca', en: 'Urdu' },
  { code: 'id', tr: 'Endonezce', en: 'Indonesian' },
  { code: 'ms', tr: 'Malayca', en: 'Malay' },
  { code: 'fa', tr: 'Farsça', en: 'Persian' },
] as const;

export const LANGUAGE_LEVELS: Option[] = [
  { value: 'basic', tr: 'Başlangıç', en: 'Basic' },
  { value: 'intermediate', tr: 'Orta', en: 'Intermediate' },
  { value: 'advanced', tr: 'İleri', en: 'Advanced' },
  { value: 'native', tr: 'Ana dil', en: 'Native' },
];

export const SKILL_LEVELS: Option[] = [
  { value: 'beginner', tr: 'Başlangıç', en: 'Beginner' },
  { value: 'intermediate', tr: 'Orta', en: 'Intermediate' },
  { value: 'advanced', tr: 'İleri', en: 'Advanced' },
  { value: 'expert', tr: 'Uzman', en: 'Expert' },
];

export const SECTORS: Option[] = [
  { value: 'tourism', tr: 'Turizm ve konaklama', en: 'Tourism & hospitality' },
  { value: 'food', tr: 'Yeme-içme', en: 'Food & beverage' },
  { value: 'retail', tr: 'Perakende', en: 'Retail' },
  { value: 'logistics', tr: 'Lojistik ve taşımacılık', en: 'Logistics & transport' },
  { value: 'construction', tr: 'İnşaat', en: 'Construction' },
  { value: 'manufacturing', tr: 'Üretim ve sanayi', en: 'Manufacturing' },
  { value: 'technology', tr: 'Teknoloji ve yazılım', en: 'Technology & software' },
  { value: 'health', tr: 'Sağlık', en: 'Healthcare' },
  { value: 'education', tr: 'Eğitim', en: 'Education' },
  { value: 'finance', tr: 'Finans ve muhasebe', en: 'Finance & accounting' },
  { value: 'sales', tr: 'Satış ve pazarlama', en: 'Sales & marketing' },
  { value: 'admin', tr: 'İdari işler', en: 'Administration' },
  { value: 'customer', tr: 'Müşteri hizmetleri', en: 'Customer service' },
  { value: 'engineering', tr: 'Mühendislik', en: 'Engineering' },
  { value: 'security', tr: 'Güvenlik', en: 'Security' },
  { value: 'cleaning', tr: 'Temizlik', en: 'Cleaning' },
  { value: 'beauty', tr: 'Güzellik ve bakım', en: 'Beauty & care' },
  { value: 'media', tr: 'Medya ve içerik', en: 'Media & content' },
  { value: 'legal', tr: 'Hukuk', en: 'Legal' },
  { value: 'other', tr: 'Diğer', en: 'Other' },
];

export const COMPANY_SIZES: Option[] = [
  { value: '1-5', tr: '1–5 çalışan', en: '1–5 employees' },
  { value: '6-25', tr: '6–25 çalışan', en: '6–25 employees' },
  { value: '26-100', tr: '26–100 çalışan', en: '26–100 employees' },
  { value: '101-500', tr: '101–500 çalışan', en: '101–500 employees' },
  { value: '500+', tr: '500+ çalışan', en: '500+ employees' },
];

export const ORG_TYPES: Option[] = [
  { value: 'company', tr: 'Şirket', en: 'Company' },
  { value: 'hotel', tr: 'Otel / Konaklama', en: 'Hotel / Hospitality' },
  { value: 'restaurant', tr: 'Restoran / Kafe', en: 'Restaurant / Café' },
  { value: 'agency', tr: 'Ajans', en: 'Agency' },
  { value: 'ngo', tr: 'Dernek / Vakıf', en: 'NGO / Foundation' },
  { value: 'public', tr: 'Kamu kurumu', en: 'Public institution' },
  { value: 'other', tr: 'Diğer', en: 'Other' },
];

export const BENEFIT_OPTIONS = [
  { key: 'benefit_bonus', tr: 'Prim', en: 'Bonus' },
  { key: 'benefit_meals', tr: 'Yemek', en: 'Meals' },
  { key: 'benefit_transport', tr: 'Yol', en: 'Transport allowance' },
  { key: 'benefit_shuttle', tr: 'Servis', en: 'Shuttle service' },
  { key: 'benefit_accommodation', tr: 'Konaklama', en: 'Accommodation' },
  { key: 'benefit_insurance', tr: 'Sigorta', en: 'Insurance' },
] as const;

export const AVAILABILITY_OPTIONS: Option[] = [
  { value: 'immediate', tr: 'Hemen başlayabilirim', en: 'Immediately' },
  { value: '2_weeks', tr: '2 hafta içinde', en: 'Within 2 weeks' },
  { value: '1_month', tr: '1 ay içinde', en: 'Within 1 month' },
  { value: '3_months', tr: '3 ay içinde', en: 'Within 3 months' },
];

export function optionLabel(option: Option | undefined, locale: Locale): string {
  if (!option) return '';
  return locale === 'tr' ? option.tr : option.en;
}

export function findOption(options: Option[], value: string | null | undefined): Option | undefined {
  if (!value) return undefined;
  return options.find((option) => option.value === value);
}

export function labelFor(options: Option[], value: string | null | undefined, locale: Locale): string {
  return optionLabel(findOption(options, value), locale) || (value ?? '');
}

export function statusLabel(status: ApplicationStatus, locale: Locale): string {
  const row = APPLICATION_STATUSES.find((item) => item.value === status);
  return row ? (locale === 'tr' ? row.tr : row.en) : status;
}

export function statusTone(status: ApplicationStatus) {
  return APPLICATION_STATUSES.find((item) => item.value === status)?.tone ?? 'neutral';
}

export function languageLabel(code: string, locale: Locale): string {
  const row = LANGUAGE_OPTIONS.find((item) => item.code === code);
  return row ? (locale === 'tr' ? row.tr : row.en) : code.toUpperCase();
}

export function formatSalary(
  min: number | null,
  max: number | null,
  currency: string | null,
  period: string | null,
  locale: Locale,
): string {
  if (min == null && max == null) return locale === 'tr' ? 'Maaş belirtilmedi' : 'Salary not specified';
  const fmt = (value: number) =>
    new Intl.NumberFormat(locale === 'tr' ? 'tr-TR' : 'en-US', {
      maximumFractionDigits: 0,
    }).format(value);
  const range = min != null && max != null && min !== max ? `${fmt(min)}–${fmt(max)}` : fmt((min ?? max) as number);
  const periodLabel = period === 'hourly'
    ? (locale === 'tr' ? 'saat' : 'hour')
    : period === 'yearly'
      ? (locale === 'tr' ? 'yıl' : 'year')
      : (locale === 'tr' ? 'ay' : 'month');
  return `${range} ${currency ?? ''} / ${periodLabel}`.trim();
}

export function formatDate(value: string | null | undefined, locale: Locale): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatRelative(value: string | null | undefined, locale: Locale): string {
  if (!value) return '';
  const date = new Date(value).getTime();
  if (Number.isNaN(date)) return '';
  const diffMinutes = Math.max(0, Math.round((Date.now() - date) / 60_000));
  if (diffMinutes < 60) {
    return locale === 'tr' ? `${Math.max(1, diffMinutes)} dk önce` : `${Math.max(1, diffMinutes)}m ago`;
  }
  const hours = Math.round(diffMinutes / 60);
  if (hours < 24) return locale === 'tr' ? `${hours} sa önce` : `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return locale === 'tr' ? `${days} gün önce` : `${days}d ago`;
  return formatDate(value, locale);
}
