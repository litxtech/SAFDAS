import { CalculationMethod, Coordinates, PrayerTimes } from 'adhan';

const cities = [
  { label: 'İstanbul', city: 'Istanbul', country: 'Turkey', method: 13, lat: 41.0082, lng: 28.9784, calc: 'Turkey' },
  { label: 'Ankara', city: 'Ankara', country: 'Turkey', method: 13, lat: 39.9334, lng: 32.8597, calc: 'Turkey' },
  { label: 'Trabzon', city: 'Trabzon', country: 'Turkey', method: 13, lat: 41.0027, lng: 39.7168, calc: 'Turkey' },
  { label: 'Mekke', city: 'Makkah', country: 'Saudi Arabia', method: 4, lat: 21.4225, lng: 39.8262, calc: 'UmmAlQura' },
  { label: 'Medine', city: 'Madinah', country: 'Saudi Arabia', method: 4, lat: 24.5247, lng: 39.5692, calc: 'UmmAlQura' },
];

const keys = [
  ['Fajr', 'fajr'],
  ['Sunrise', 'sunrise'],
  ['Dhuhr', 'dhuhr'],
  ['Asr', 'asr'],
  ['Maghrib', 'maghrib'],
  ['Isha', 'isha'],
];

function minutes(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function delta(a, b) {
  return minutes(a) - minutes(b);
}

for (const place of cities) {
  const url = `https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(place.city)}&country=${encodeURIComponent(place.country)}&method=${place.method}&iso8601=true`;
  const response = await fetch(url);
  if (!response.ok) {
    console.log(`${place.label}: AlAdhan HTTP ${response.status}`);
    continue;
  }
  const json = await response.json();
  const timings = json.data.timings;
  const params = CalculationMethod[place.calc]();
  const local = new PrayerTimes(new Coordinates(place.lat, place.lng), new Date(), params);
  console.log(`\n${place.label} · AlAdhan method ${place.method} (${json.data.meta.method.name}) vs adhan ${place.calc}`);
  for (const [apiKey, localKey] of keys) {
    const remote = new Date(timings[apiKey]);
    const computed = local[localKey];
    const diff = delta(remote, computed);
    console.log(`  ${apiKey.padEnd(8)} AlAdhan ${remote.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}  yerel ${computed.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}  fark ${diff} dk`);
  }
  console.log('  Not: Bu fark resmî Diyanet veya Ümmü’l-Kurâ ilanı değildir. İki hesap motorunun karşılaştırmasıdır.');
}
