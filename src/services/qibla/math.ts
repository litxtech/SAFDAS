import { Coordinates, Qibla } from 'adhan';

/** Kaaba courtyard centre (WGS84), matching common prayer apps. */
export const KAABA = { lat: 21.4225241, lng: 39.8261818 } as const;

/** Great-circle qibla bearing in degrees from true north [0, 360). */
export function qiblaBearing(lat: number, lng: number): number {
  return ((Qibla(new Coordinates(lat, lng)) % 360) + 360) % 360;
}

/** Shortest signed turn from `from` to `to` in degrees (−180, 180]. */
export function shortestDelta(from: number, to: number): number {
  return ((((to - from) % 360) + 540) % 360) - 180;
}

export function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

/** Haversine distance to the Kaaba in kilometres. */
export function distanceToKaabaKm(lat: number, lng: number): number {
  const earth = 6371;
  const phi1 = (lat * Math.PI) / 180;
  const phi2 = (KAABA.lat * Math.PI) / 180;
  const dPhi = ((KAABA.lat - lat) * Math.PI) / 180;
  const dLambda = ((KAABA.lng - lng) * Math.PI) / 180;
  const a = Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return 2 * earth * Math.asin(Math.sqrt(a));
}

/**
 * Pick a heading relative to true north.
 * Expo returns trueHeading = −1 when the geomagnetic model is not ready;
 * fall back to magHeading + last known declination, then raw magnetic.
 */
export function resolveTrueHeading(
  trueHeading: number,
  magHeading: number,
  declinationRef: { current: number | null },
): { heading: number; magneticOnly: boolean } | null {
  const magOk = Number.isFinite(magHeading) && magHeading >= 0;
  const trueOk = Number.isFinite(trueHeading) && trueHeading >= 0;

  if (trueOk && magOk) {
    declinationRef.current = shortestDelta(magHeading, trueHeading);
    return { heading: normalizeDegrees(trueHeading), magneticOnly: false };
  }
  if (trueOk) {
    return { heading: normalizeDegrees(trueHeading), magneticOnly: false };
  }
  if (magOk) {
    const declination = declinationRef.current ?? 0;
    return { heading: normalizeDegrees(magHeading + declination), magneticOnly: declinationRef.current == null };
  }
  return null;
}

/** Phone sensors rarely beat ~2°; tighter than this feels “stuck wrong”. */
export const ALIGN_TOLERANCE_DEG = 2.5;

export function isAligned(delta: number | null, tolerance = ALIGN_TOLERANCE_DEG): boolean {
  return delta != null && Math.abs(delta) <= tolerance;
}

/** Exponential smoothing in degree space (handles 359 ↔ 1 wrap). */
export function smoothHeading(previous: number | null, next: number, alpha = 0.28): number {
  if (previous == null || !Number.isFinite(previous)) return next;
  return normalizeDegrees(previous + alpha * shortestDelta(previous, next));
}
