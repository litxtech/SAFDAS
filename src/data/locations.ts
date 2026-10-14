export type CityRecord = {
  countryCode: string;
  countryName: string;
  city: string;
  latitude: number;
  longitude: number;
  timezone: string;
  utcOffsetMinutes: number;
};

export const COUNTRIES: { code: string; name: string }[] = [
  { code: 'TR', name: 'Turkey' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'EG', name: 'Egypt' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'QA', name: 'Qatar' },
  { code: 'KW', name: 'Kuwait' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'SG', name: 'Singapore' },
];

const TR: Array<[string, number, number]> = [
  ['Adana', 37.0, 35.3213],
  ['Adıyaman', 37.7648, 38.2786],
  ['Afyonkarahisar', 38.7507, 30.5567],
  ['Ağrı', 39.7191, 43.0503],
  ['Aksaray', 38.3687, 34.037],
  ['Amasya', 40.6499, 35.8353],
  ['Ankara', 39.9334, 32.8597],
  ['Antalya', 36.8969, 30.7133],
  ['Ardahan', 41.1105, 42.7022],
  ['Artvin', 41.1828, 41.8183],
  ['Aydın', 37.856, 27.8416],
  ['Balıkesir', 39.6484, 27.8826],
  ['Bartın', 41.6344, 32.3375],
  ['Batman', 37.8812, 41.1351],
  ['Bayburt', 40.2552, 40.2249],
  ['Bilecik', 40.0567, 30.0665],
  ['Bingöl', 38.8854, 40.4983],
  ['Bitlis', 38.4006, 42.1095],
  ['Bolu', 40.736, 31.6061],
  ['Burdur', 37.7203, 30.2908],
  ['Bursa', 40.1885, 29.061],
  ['Çanakkale', 40.1553, 26.4142],
  ['Çankırı', 40.6013, 33.6134],
  ['Çorum', 40.5506, 34.9556],
  ['Denizli', 37.7765, 29.0864],
  ['Diyarbakır', 37.9144, 40.2306],
  ['Düzce', 40.8438, 31.1565],
  ['Edirne', 41.6818, 26.5623],
  ['Elazığ', 38.681, 39.2264],
  ['Erzincan', 39.75, 39.5],
  ['Erzurum', 39.9043, 41.2679],
  ['Eskişehir', 39.7767, 30.5206],
  ['Gaziantep', 37.0662, 37.3833],
  ['Giresun', 40.9128, 38.3895],
  ['Gümüşhane', 40.4386, 39.5086],
  ['Hakkari', 37.5744, 43.7408],
  ['Hatay', 36.4018, 36.3498],
  ['Iğdır', 39.9237, 44.045],
  ['Isparta', 37.7648, 30.5566],
  ['İstanbul', 41.0082, 28.9784],
  ['İzmir', 38.4237, 27.1428],
  ['Kahramanmaraş', 37.5753, 36.9228],
  ['Karabük', 41.2061, 32.6204],
  ['Karaman', 37.1759, 33.2287],
  ['Kars', 40.6167, 43.1],
  ['Kastamonu', 41.3887, 33.7827],
  ['Kayseri', 38.7312, 35.4787],
  ['Kilis', 36.7184, 37.1212],
  ['Kırıkkale', 39.8468, 33.5153],
  ['Kırklareli', 41.7333, 27.2167],
  ['Kırşehir', 39.1425, 34.1709],
  ['Kocaeli', 40.8533, 29.8815],
  ['Konya', 37.8746, 32.4932],
  ['Kütahya', 39.4242, 29.9833],
  ['Malatya', 38.3552, 38.3095],
  ['Manisa', 38.6191, 27.4289],
  ['Mardin', 37.3212, 40.7245],
  ['Mersin', 36.8121, 34.6415],
  ['Muğla', 37.2153, 28.3636],
  ['Muş', 38.9462, 41.7539],
  ['Nevşehir', 38.6939, 34.6857],
  ['Niğde', 37.9667, 34.6833],
  ['Ordu', 40.9839, 37.8764],
  ['Osmaniye', 37.0742, 36.2478],
  ['Rize', 41.0201, 40.5234],
  ['Sakarya', 40.694, 30.4358],
  ['Samsun', 41.2867, 36.33],
  ['Siirt', 37.9333, 41.95],
  ['Sinop', 42.0231, 35.1531],
  ['Sivas', 39.7477, 37.0179],
  ['Şanlıurfa', 37.1591, 38.7969],
  ['Şırnak', 37.4187, 42.4918],
  ['Tekirdağ', 40.9833, 27.5167],
  ['Tokat', 40.3167, 36.55],
  ['Trabzon', 41.0027, 39.7168],
  ['Tunceli', 39.1079, 39.5401],
  ['Uşak', 38.6823, 29.4082],
  ['Van', 38.4891, 43.4089],
  ['Yalova', 40.65, 29.2667],
  ['Yozgat', 39.8181, 34.8147],
  ['Zonguldak', 41.4564, 31.7987],
];

const SA: Array<[string, number, number]> = [
  ['Makkah', 21.4225, 39.8262],
  ['Madinah', 24.5247, 39.5692],
  ['Riyadh', 24.7136, 46.6753],
  ['Jeddah', 21.4858, 39.1925],
  ['Dammam', 26.4207, 50.0888],
  ['Taif', 21.2703, 40.4158],
];

function expand(countryCode: string, countryName: string, timezone: string, offset: number, rows: Array<[string, number, number]>): CityRecord[] {
  return rows.map(([city, latitude, longitude]) => ({
    countryCode,
    countryName,
    city,
    latitude,
    longitude,
    timezone,
    utcOffsetMinutes: offset,
  }));
}

export const CITIES: CityRecord[] = [
  ...expand('TR', 'Turkey', 'Europe/Istanbul', 180, TR),
  ...expand('SA', 'Saudi Arabia', 'Asia/Riyadh', 180, SA),
];

export function citiesFor(countryCode: string): CityRecord[] {
  return CITIES.filter((city) => city.countryCode === countryCode);
}

export const DEFAULT_LOCATION = CITIES.find((city) => city.city === 'İstanbul') as CityRecord;
