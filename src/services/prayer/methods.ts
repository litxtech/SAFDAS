type Copy = { tr: string; en: string; ar: string };

export type CalculationMethodOption = {
  id: number;
  name: Copy;
  regions: Copy;
};

export const CALCULATION_METHODS: CalculationMethodOption[] = [
  { id: 13, name: { tr: 'Diyanet İşleri Başkanlığı', en: 'Diyanet', ar: 'رئاسة الشؤون الدينية' }, regions: { tr: 'Türkiye', en: 'Turkey', ar: 'تركيا' } },
  { id: 4, name: { tr: 'Ümmü’l-Kurâ', en: 'Umm al-Qura', ar: 'أم القرى' }, regions: { tr: 'Suudi Arabistan', en: 'Saudi Arabia', ar: 'السعودية' } },
  { id: 3, name: { tr: 'Muslim World League', en: 'Muslim World League', ar: 'رابطة العالم الإسلامي' }, regions: { tr: 'Avrupa ve genel', en: 'Europe and general', ar: 'أوروبا وعام' } },
  { id: 2, name: { tr: 'ISNA', en: 'ISNA', ar: 'ISNA' }, regions: { tr: 'Kuzey Amerika', en: 'North America', ar: 'أمريكا الشمالية' } },
  { id: 5, name: { tr: 'Mısır Genel Araştırmalar Kurulu', en: 'Egyptian General Authority of Survey', ar: 'الهيئة المصرية العامة للمساحة' }, regions: { tr: 'Mısır, Afrika', en: 'Egypt, Africa', ar: 'مصر وأفريقيا' } },
  { id: 1, name: { tr: 'Karaçi', en: 'Karachi', ar: 'كراتشي' }, regions: { tr: 'Pakistan, Bangladeş', en: 'Pakistan, Bangladesh', ar: 'باكستان وبنغلاديش' } },
  { id: 8, name: { tr: 'Körfez bölgesi', en: 'Gulf region', ar: 'منطقة الخليج' }, regions: { tr: 'BAE ve Körfez', en: 'UAE and the Gulf', ar: 'الإمارات والخليج' } },
  { id: 9, name: { tr: 'Kuveyt', en: 'Kuwait', ar: 'الكويت' }, regions: { tr: 'Kuveyt', en: 'Kuwait', ar: 'الكويت' } },
  { id: 10, name: { tr: 'Katar', en: 'Qatar', ar: 'قطر' }, regions: { tr: 'Katar', en: 'Qatar', ar: 'قطر' } },
  { id: 11, name: { tr: 'MUIS', en: 'MUIS', ar: 'MUIS' }, regions: { tr: 'Singapur', en: 'Singapore', ar: 'سنغافورة' } },
  { id: 12, name: { tr: 'UOIF', en: 'UOIF', ar: 'UOIF' }, regions: { tr: 'Fransa', en: 'France', ar: 'فرنسا' } },
  { id: 15, name: { tr: 'Moonsighting Committee', en: 'Moonsighting Committee', ar: 'لجنة رؤية الهلال' }, regions: { tr: 'Dünya geneli', en: 'Worldwide', ar: 'العالم' } },
];

const COUNTRY_METHODS: Record<string, number> = {
  TR: 13,
  SA: 4,
  US: 2,
  CA: 2,
  EG: 5,
  PK: 1,
  BD: 1,
  AE: 8,
  OM: 8,
  BH: 8,
  KW: 9,
  QA: 10,
  SG: 11,
  FR: 12,
  GB: 3,
  DE: 3,
  NL: 3,
};

export function methodForCountry(countryCode: string): number {
  return COUNTRY_METHODS[countryCode.toUpperCase()] ?? 3;
}

const METHOD_FALLBACK = { tr: 'Yöntem', en: 'Method', ar: 'طريقة' } as const;

export function methodName(id: number, locale: keyof Copy = 'tr'): string {
  return CALCULATION_METHODS.find((method) => method.id === id)?.name[locale] ?? `${METHOD_FALLBACK[locale]} ${id}`;
}
