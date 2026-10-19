import { router } from 'expo-router';

type SurahHref = {
  pathname: '/quran/[surah]';
  params: { surah: string; ayah?: string };
};

function surahHref(surah: number, ayah?: number): SurahHref {
  const params: SurahHref['params'] = { surah: String(surah) };
  if (ayah != null && Number.isFinite(ayah) && ayah > 0) params.ayah = String(ayah);
  return { pathname: '/quran/[surah]', params };
}

/**
 * Open a surah.
 * - default: navigate (reuses stack entries when possible)
 * - replace: swap the current surah screen (auto-advance / in-reader switches)
 */
export function openSurah(surah: number, ayah?: number, options?: { replace?: boolean }) {
  const href = surahHref(surah, ayah);
  if (options?.replace) {
    router.replace(href);
    return;
  }
  router.navigate(href);
}

/** Jump to Quran home without stepping through every opened surah. */
export function goQuranHome() {
  if (router.canDismiss()) {
    router.dismissTo('/quran');
    return;
  }
  router.replace('/quran');
}

/** Open the shared player without stacking multiple player screens. */
export function openPlayer() {
  router.navigate('/player');
}

export function openRecentListens() {
  router.navigate('/quran/recent');
}
