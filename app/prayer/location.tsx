import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { CITIES, COUNTRIES, citiesFor } from '@/data/locations';
import { Screen } from '@/components/layout/Screen';
import { AppButton } from '@/components/ui/AppButton';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppInput } from '@/components/ui/AppInput';
import { useT } from '@/i18n';
import { methodForCountry } from '@/services/prayer/methods';
import { usePrayerStore } from '@/stores/prayerStore';
import { useToastStore } from '@/stores/toastStore';
import { useTheme } from '@/theme/ThemeProvider';

export default function LocationScreen() {
  const { colors } = useTheme();
  const t = useT();
  const setLocation = usePrayerStore((state) => state.setLocation);
  const show = useToastStore((state) => state.show);
  const [country, setCountry] = useState('TR');
  const [query, setQuery] = useState('');
  const cities = citiesFor(country).filter((city) => city.city.toLocaleLowerCase('tr').includes(query.toLocaleLowerCase('tr')));

  async function useGps() {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      show(t('locationDenied'), 'info');
      return;
    }
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const places = await Location.reverseGeocodeAsync(position.coords);
    const place = places[0];
    const countryCode = place?.isoCountryCode ?? 'TR';
    const known = COUNTRIES.find((item) => item.code === countryCode);
    setLocation({
      countryCode,
      countryName: known?.name ?? place?.country ?? 'Turkey',
      city: place?.city || place?.region || t('myLocation'),
      district: place?.district ?? null,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      timezone: null,
      utcOffsetMinutes: -new Date().getTimezoneOffset(),
      source: 'gps',
    });
    router.back();
  }

  return (
    <Screen scroll>
      <AppHeader title={t('locationTitle')} subtitle={t('locationSubtitle')} />
      <AppButton label={t('useMyLocation')} onPress={() => void useGps()} />
      <Text style={{ color: colors.textSecondary }}>{t('country')}</Text>
      {COUNTRIES.map((item) => (
        <Pressable key={item.code} onPress={() => setCountry(item.code)}>
          <Text style={{ color: item.code === country ? colors.primary : colors.text, paddingVertical: 6 }}>{item.name}</Text>
        </Pressable>
      ))}
      <AppInput label={t('searchCity')} value={query} onChangeText={setQuery} />
      {cities.map((city) => (
        <Pressable
          key={city.city}
          onPress={() => {
            setLocation({
              countryCode: city.countryCode,
              countryName: city.countryName,
              city: city.city,
              district: null,
              latitude: city.latitude,
              longitude: city.longitude,
              timezone: city.timezone,
              utcOffsetMinutes: city.utcOffsetMinutes,
              source: 'manual',
            });
            void methodForCountry(city.countryCode);
            router.back();
          }}
        >
          <Text style={{ color: colors.text, paddingVertical: 8 }}>{city.city}</Text>
        </Pressable>
      ))}
      {country !== 'TR' && country !== 'SA' ? (
        <Text style={{ color: colors.textSecondary }}>
          {t('noCityList', { count: CITIES.length })}
        </Text>
      ) : null}
    </Screen>
  );
}
