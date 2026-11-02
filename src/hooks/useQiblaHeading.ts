import { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as Location from 'expo-location';
import { useSharedValue } from 'react-native-reanimated';
import { resolveTrueHeading, shortestDelta, smoothHeading } from '@/services/qibla/math';

export type QiblaCoords = { lat: number; lng: number };

type Options = {
  fallback: QiblaCoords;
  /** Pause GPS/compass when false (blur / background). */
  enabled?: boolean;
  onPermissionDenied?: () => void;
  onCompassUnavailable?: () => void;
};

/** Cap React heading updates — dial still tracks via Reanimated shared value. */
const HEADING_REACT_MIN_MS = 120;
const HEADING_REACT_MIN_DEG = 0.4;

export function useQiblaHeading({
  fallback,
  enabled = true,
  onPermissionDenied,
  onCompassUnavailable,
}: Options) {
  const [heading, setHeading] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState(0);
  const [magneticOnly, setMagneticOnly] = useState(false);
  const [coords, setCoords] = useState<QiblaCoords | null>(null);
  const rotation = useSharedValue(0);
  const unwrapped = useRef(0);
  const smoothed = useRef<number | null>(null);
  const declination = useRef<number | null>(null);
  const lastReactHeadingAt = useRef(0);
  const lastReactHeading = useRef<number | null>(null);
  const lastAccuracy = useRef(0);
  const lastMagneticOnly = useRef(false);
  const deniedRef = useRef(onPermissionDenied);
  const unavailableRef = useRef(onCompassUnavailable);
  deniedRef.current = onPermissionDenied;
  unavailableRef.current = onCompassUnavailable;

  useEffect(() => {
    if (!enabled) return;

    let headingSub: Location.LocationSubscription | null = null;
    let positionSub: Location.LocationSubscription | null = null;
    let active = true;
    let appActive = AppState.currentState === 'active';

    const removeSubs = () => {
      headingSub?.remove();
      positionSub?.remove();
      headingSub = null;
      positionSub = null;
    };

    const startWatchers = async () => {
      if (!active || !appActive) return;
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!active || !appActive) return;
      if (!permission.granted) {
        deniedRef.current?.();
        return;
      }

      try {
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!active || !appActive) return;
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        positionSub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 25,
            timeInterval: 8_000,
          },
          (next) => {
            if (!active || !appActive) return;
            setCoords({ lat: next.coords.latitude, lng: next.coords.longitude });
          },
        );
        if (!active || !appActive) {
          positionSub?.remove();
          positionSub = null;
        }
      } catch {
        if (active) deniedRef.current?.();
      }

      if (!active || !appActive) return;

      try {
        headingSub = await Location.watchHeadingAsync((value) => {
          if (!active || !appActive) return;
          const resolved = resolveTrueHeading(value.trueHeading, value.magHeading, declination);
          if (!resolved) return;

          const next = smoothHeading(smoothed.current, resolved.heading);
          smoothed.current = next;

          // Dial rotates opposite to heading so geographic north stays under the rose.
          const target = -next;
          unwrapped.current += shortestDelta(unwrapped.current, target);
          rotation.value = unwrapped.current;

          const now = Date.now();
          const headingMoved =
            lastReactHeading.current == null ||
            Math.abs(shortestDelta(lastReactHeading.current, next)) >= HEADING_REACT_MIN_DEG;
          const due = now - lastReactHeadingAt.current >= HEADING_REACT_MIN_MS;
          if (headingMoved && due) {
            lastReactHeadingAt.current = now;
            lastReactHeading.current = next;
            setHeading(next);
          }

          if (resolved.magneticOnly !== lastMagneticOnly.current) {
            lastMagneticOnly.current = resolved.magneticOnly;
            setMagneticOnly(resolved.magneticOnly);
          }
          if (value.accuracy !== lastAccuracy.current) {
            lastAccuracy.current = value.accuracy;
            setAccuracy(value.accuracy);
          }
        });
        if (!active || !appActive) {
          headingSub?.remove();
          headingSub = null;
        }
      } catch {
        if (active) unavailableRef.current?.();
      }
    };

    void startWatchers();

    const onAppState = (status: AppStateStatus) => {
      const nextActive = status === 'active';
      if (nextActive === appActive) return;
      appActive = nextActive;
      if (!appActive) {
        removeSubs();
        return;
      }
      void startWatchers();
    };
    const appSub = AppState.addEventListener('change', onAppState);

    return () => {
      active = false;
      appSub.remove();
      removeSubs();
    };
  }, [enabled, rotation]);

  return {
    heading,
    accuracy,
    magneticOnly,
    coords: coords ?? fallback,
    usingGps: coords != null,
    rotation,
  };
}
