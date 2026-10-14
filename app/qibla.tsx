import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import * as Location from 'expo-location';
import { Screen } from '@/components/layout/Screen';
import { AppCard } from '@/components/ui/AppCard';
import { AppHeader } from '@/components/ui/AppHeader';
import { useT } from '@/i18n';
import { usePrayerStore } from '@/stores/prayerStore';
import { useTheme } from '@/theme/ThemeProvider';

function qiblaBearing(lat: number, lng: number) {
  const kaabaLat = (21.4225 * Math.PI) / 180;
  const kaabaLng = (39.8262 * Math.PI) / 180;
  const phi = (lat * Math.PI) / 180;
  const lambda = (lng * Math.PI) / 180;
  const y = Math.sin(kaabaLng - lambda);
  const x = Math.cos(phi) * Math.tan(kaabaLat) - Math.sin(phi) * Math.cos(kaabaLng - lambda);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

export default function QiblaScreen() {
  const { colors } = useTheme();
  const t = useT();
  const location = usePrayerStore((state) => state.location);
  const [heading, setHeading] = useState<number | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const lat = location.latitude ?? 41.0082;
  const lng = location.longitude ?? 28.9784;
  const bearing = (qiblaBearing(lat, lng) + 360) % 360;
  const delta = heading == null ? null : ((bearing - heading + 540) % 360) - 180;

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    let active = true;
    void (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        if (active) setWarning(t('qiblaNoPermission'));
        return;
      }
      try {
        subscription = await Location.watchHeadingAsync((value) => {
          const next = value.trueHeading >= 0 ? value.trueHeading : value.magHeading;
          if (next >= 0) setHeading(next);
        });
      } catch {
        if (active) setWarning(t('qiblaNoCompass'));
      }
    })();
    return () => {
      active = false;
      subscription?.remove();
    };
  }, [t]);

  return (
    <Screen scroll>
      <AppHeader title={t('qibla')} subtitle={location.city} />
      <AppCard elevated>
        <Text style={{ color: colors.textSecondary }}>{t('qiblaDirection')}</Text>
        <Text style={{ color: colors.primary, fontSize: 56, fontWeight: '700' }}>{Math.round(bearing)}°</Text>
        <Text style={{ color: colors.text, fontSize: 18 }}>
          {delta == null ? t('qiblaWaiting') : t('qiblaTurn', { degrees: Math.abs(Math.round(delta)), direction: delta > 0 ? t('qiblaRight') : t('qiblaLeft') })}
        </Text>
        {warning ? <Text style={{ color: colors.warning, marginTop: 8 }}>{warning}</Text> : null}
        <Text style={{ color: colors.textSecondary, marginTop: 12 }}>{t('qiblaCalibration')}</Text>
      </AppCard>
    </Screen>
  );
}
