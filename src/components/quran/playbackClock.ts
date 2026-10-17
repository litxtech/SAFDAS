export function playbackClock(currentTime: number, duration: number) {
  const known = duration > 0.2;
  const second = known ? Math.min(Math.ceil(duration), Math.floor(currentTime) + 1) : 0;
  const remaining = known ? Math.max(0, Math.ceil(duration - currentTime)) : 0;
  const progress = known ? Math.min(1, Math.max(0, currentTime / duration)) : 0;
  return { known, second, remaining, progress };
}
