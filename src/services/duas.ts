import { BUNDLED_DUAS, type DuaLocale } from '@/content/duas';
import type { Locale } from '@/i18n';
import { requireSupabase } from '@/lib/supabase';
import type { PlayableTrack } from '@/services/audio/engine';
import { playQueue, useAudioEngine } from '@/services/audio/engine';
import {
  arabicKey,
  audioIndexSize,
  bundledDuaAudioIndex,
  lookupDuaAudio,
  readDuaAudioIndex,
  syncDuaAudioIndex,
  type DuaAudioIndex,
} from '@/services/dua/audioCatalog';
import {
  duaVoiceArtist,
  getDuaVoice,
  resolveDuaAudioUrl,
  resolveDuaAyahNumber,
} from '@/services/dua/voices';
import { bundledHisnEntries, type DuaEntry } from '@/services/duaCatalog';
import { hisnCategoryLabel, hisnDuaTitle } from '@/services/dua/hisnCategories';
import {
  detectSurahsInText,
  isAyatAlKursi,
  surahCategoryKey,
  surahCategoryLabel,
  surahFirstAyahGlobal,
  surahTitle,
} from '@/services/dua/surahClassify';
import { useDuaVoiceStore } from '@/stores/duaVoiceStore';

export { arabicKey };

export type DuaItem = {
  id: string;
  slug: string;
  arabic: string;
  transliteration: string | null;
  audioUrl: string | null;
  openDuaUrl: string | null;
  ayahNumber: number | null;
  categoryNumber?: string | null;
  entryNumber?: string | null;
  categoryLabel?: string | null;
  title: string | null;
  meaning: string | null;
  source: string | null;
  favorite: boolean;
};

const TRANSLATION_CHAIN: DuaLocale[] = ['tr', 'en', 'ar', 'es'];

function pickTranslation(
  translations: { locale: string; title: string; meaning: string; source: string | null }[],
  preferred: DuaLocale,
) {
  const order = [preferred, ...TRANSLATION_CHAIN.filter((item) => item !== preferred)];
  for (const locale of order) {
    const hit = translations.find((item) => item.locale === locale && (item.title || item.meaning));
    if (hit) return hit;
  }
  return null;
}

function categoryLabelFor(
  entry: Pick<DuaEntry, 'categoryNumber' | 'categoryEn' | 'categoryAr'>,
  lang: DuaLocale,
) {
  return hisnCategoryLabel(entry.categoryNumber, entry.categoryEn, entry.categoryAr, lang);
}

function compareDuaItems(a: DuaItem, b: DuaItem) {
  const cat = Number(a.categoryNumber ?? 9999) - Number(b.categoryNumber ?? 9999);
  if (cat !== 0) return cat;
  const entry = Number(a.entryNumber ?? 9999) - Number(b.entryNumber ?? 9999);
  if (entry !== 0) return entry;
  return (a.title ?? a.slug).localeCompare(b.title ?? b.slug, undefined, { sensitivity: 'base' });
}

export type PlaylistItem = DuaItem & { itemId: string; sortOrder: number };

export type Playlist = {
  id: string;
  name: string;
  repeatMode: 'off' | 'all' | 'one';
  shuffle: boolean;
  items: PlaylistItem[];
};

function asLocale(locale: Locale): DuaLocale {
  if (locale === 'en' || locale === 'ar' || locale === 'es') return locale;
  return 'tr';
}

function fillDua(current: DuaItem, next: DuaItem): DuaItem {
  return {
    ...current,
    audioUrl: current.audioUrl ?? next.audioUrl,
    openDuaUrl: current.openDuaUrl ?? next.openDuaUrl,
    ayahNumber: current.ayahNumber ?? next.ayahNumber,
    categoryNumber: current.categoryNumber ?? next.categoryNumber,
    entryNumber: current.entryNumber ?? next.entryNumber,
    // Prefer newer localized labels/titles (remote refresh after locale fix).
    categoryLabel: next.categoryLabel ?? current.categoryLabel,
    title: next.title ?? current.title,
    meaning: next.meaning ?? current.meaning,
    source: current.source ?? next.source,
    transliteration: current.transliteration ?? next.transliteration,
    favorite: current.favorite || next.favorite,
  };
}

function ayahFor(dua: {
  slug: string;
  source?: string | null;
  arabic?: string | null;
  categoryNumber?: string | null;
  ayahNumber?: number | null;
}) {
  const resolved = resolveDuaAyahNumber({
    ayahNumber: dua.ayahNumber,
    slug: dua.slug,
    source: dua.source,
    arabic: dua.arabic,
    categoryNumber: dua.categoryNumber,
  });
  if (resolved) return resolved;
  if (dua.arabic && isAyatAlKursi(dua.arabic)) return 262;
  if (dua.arabic) {
    const hits = detectSurahsInText(dua.arabic, '', dua.source ?? '');
    const first = hits[0] ? surahFirstAyahGlobal(hits[0].surah) : null;
    if (first) return first;
  }
  return null;
}

function withAudio<T extends DuaItem>(dua: T, index: DuaAudioIndex | null): T {
  const clip = lookupDuaAudio(dua.arabic, index, {
    categoryNumber: dua.categoryNumber,
    number: dua.entryNumber,
  });
  const openDuaUrl = dua.openDuaUrl ?? clip?.url ?? null;
  const ayahNumber = ayahFor(dua);
  const voiceId = useDuaVoiceStore.getState().id;
  const audioUrl = resolveDuaAudioUrl({
    voiceId,
    openDuaUrl,
    audioUrl: dua.audioUrl,
    ayahNumber,
    slug: dua.slug,
    source: dua.source,
    arabic: dua.arabic,
    categoryNumber: dua.categoryNumber,
  });
  return { ...dua, openDuaUrl, ayahNumber, audioUrl };
}

function attachAudio(duas: DuaItem[], index: DuaAudioIndex | null) {
  return duas.map((dua) => withAudio(dua, index));
}

function duaMergeKey(dua: DuaItem) {
  // Keep each category/entry distinct so the same Arabic (e.g. Kursi) can live
  // under morning AND sleep without stealing the other section — and so Yâsîn
  // never collapses into Secde / Alif-Lam-Mim.
  if (dua.categoryNumber && dua.entryNumber) return `${dua.categoryNumber}:${dua.entryNumber}`;
  if (dua.id) return `id:${dua.id}`;
  if (dua.slug) return `slug:${dua.slug}`;
  const arabic = arabicKey(dua.arabic);
  if (arabic) return arabic;
  return '';
}

export function mergeDuas(groups: DuaItem[][]) {
  const map = new Map<string, DuaItem>();
  for (const group of groups) {
    for (const dua of group) {
      const key = duaMergeKey(dua);
      if (!key) continue;
      const existing = map.get(key);
      map.set(key, existing ? fillDua(existing, dua) : dua);
    }
  }
  return [...map.values()].sort(compareDuaItems);
}

/** Sync Hisn library for instant first paint (no network / storage). */
export function bundledDuasFor(locale: Locale): DuaItem[] {
  try {
    const entries = bundledHisnEntries();
    if (entries.length >= 40) {
      return attachAudio(fromCatalog(entries, locale), bundledDuaAudioIndex());
    }
  } catch {
    /* fall through to tiny emergency list */
  }
  return attachAudio(fromBundle(locale, new Set()), bundledDuaAudioIndex());
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: () => T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return Promise.race([
    promise.finally(() => {
      if (timer) clearTimeout(timer);
    }),
    new Promise<T>((resolve) => {
      timer = setTimeout(() => resolve(fallback()), ms);
    }),
  ]);
}

function fromBundle(locale: Locale, favorites: Set<string>): DuaItem[] {
  const lang = asLocale(locale);
  return BUNDLED_DUAS.map((dua) => {
    const text = dua.translations[lang];
    const source = text?.source ?? dua.source;
    return {
      id: dua.slug,
      slug: dua.slug,
      arabic: dua.arabic,
      transliteration: dua.transliteration,
      audioUrl: dua.audioUrl,
      openDuaUrl: null,
      ayahNumber: ayahFor({ slug: dua.slug, source, arabic: dua.arabic }),
      title: text?.title ?? null,
      meaning: text?.meaning ?? null,
      source,
      favorite: favorites.has(dua.slug),
    };
  });
}

export function tracksFor(duas: DuaItem[], artist?: string): PlayableTrack[] {
  const voiceId = useDuaVoiceStore.getState().id;
  const voiceArtist = artist ?? duaVoiceArtist(voiceId);
  const tracks: PlayableTrack[] = [];
  for (const dua of duas) {
    const ayahNumber = ayahFor(dua);
    const uri = resolveDuaAudioUrl({
      voiceId,
      openDuaUrl: dua.openDuaUrl,
      audioUrl: dua.audioUrl,
      ayahNumber,
      slug: dua.slug,
      source: dua.source,
      arabic: dua.arabic,
      categoryNumber: dua.categoryNumber,
    });
    if (!uri) continue;
    tracks.push({
      id: `dua:${voiceId}:${dua.slug}`,
      uri,
      title: dua.title ?? dua.slug,
      artist: voiceArtist,
      kind: 'dua',
      duaId: dua.id,
      duaSlug: dua.slug,
      ayahNumber: ayahNumber ?? undefined,
      openDuaUrl: dua.openDuaUrl,
      duaArabic: dua.arabic,
      categoryNumber: dua.categoryNumber ?? undefined,
    });
  }
  return tracks;
}

async function readCachedCatalog(locale: Locale): Promise<DuaItem[]> {
  try {
    const { ensureBundledDuaCatalog, readDuaCatalog } = await import('@/services/duaCatalog');
    const catalog = (await readDuaCatalog()) ?? (await ensureBundledDuaCatalog());
    if (catalog.duas.length) return fromCatalog(catalog.duas, locale);
  } catch {
    /* ignore */
  }
  return [];
}

async function ensureAudioIndex(): Promise<DuaAudioIndex | null> {
  const cached = await readDuaAudioIndex().catch(() => null);
  if (audioIndexSize(cached) >= 20) return cached;
  return withTimeout(syncDuaAudioIndex(), 12_000, () => cached);
}

export async function loadDuas(locale: Locale, userId?: string): Promise<DuaItem[]> {
  // Prefer ship-time Hisn (268+) immediately — never paint only the 6 emergency slugs.
  const hisnSync = bundledDuasFor(locale);
  const storedPromise = withTimeout(loadStoredDuas(locale, userId), 1800, () => [] as DuaItem[]);
  const audioPromise = ensureAudioIndex();

  let remote = await readCachedCatalog(locale);
  if (remote.length < 40) {
    try {
      const { bootstrapDuaCatalog, ensureBundledDuaCatalog } = await import('@/services/duaCatalog');
      const seeded = await ensureBundledDuaCatalog();
      if (seeded.duas.length) remote = fromCatalog(seeded.duas, locale);
      if (remote.length < 40) {
        const boot = await withTimeout(bootstrapDuaCatalog(28), 15_000, () => null as Awaited<ReturnType<typeof bootstrapDuaCatalog>> | null);
        if (boot?.duas?.length) remote = fromCatalog(boot.duas, locale);
      }
    } catch {
      /* keep whatever we have */
    }
  }

  const [stored, audio, localFavorites] = await Promise.all([
    storedPromise,
    audioPromise,
    userId ? readLocalFavorites(userId) : Promise.resolve(new Set<string>()),
  ]);
  const primary = remote.length >= 40 ? remote : remote.length ? mergeDuas([hisnSync, remote]) : hisnSync;
  const merged = attachAudio(mergeDuas([primary, stored]), audio);
  const withFavorites = markDuaFavorites(merged.length ? merged : hisnSync, localFavorites);
  return withFavorites;
}

/** Katalog + OpenDua ses indeksi; eksikse bootstrap + force sync. */
export async function refreshDuaCatalogInBackground(locale: Locale): Promise<DuaItem[] | null> {
  try {
    const { bootstrapDuaCatalog, catalogCoverage, ensureBundledDuaCatalog, syncDuaCatalog } =
      await import('@/services/duaCatalog');
    const audio = await ensureAudioIndex();

    let catalog = await ensureBundledDuaCatalog().catch(() => null);
    if (!catalog || catalogCoverage(catalog).have < 40) {
      catalog = await bootstrapDuaCatalog(28).catch(() => catalog);
    }
    const coverage = catalogCoverage(catalog);
    catalog = await syncDuaCatalog({ force: !coverage.complete || coverage.have < 40 });
    const items = attachAudio(fromCatalog(catalog.duas, locale), audio);
    return items.length ? items : null;
  } catch {
    return null;
  }
}

/** Tek dua için ses URL’sini canlı indeksten yeniden çöz. */
export async function resolvePlayableDua(dua: DuaItem): Promise<DuaItem> {
  const audio = await ensureAudioIndex();
  return withAudio(dua, audio);
}

export async function selectDuaVoice(voiceId: string) {
  const voice = getDuaVoice(voiceId);
  const previous = useDuaVoiceStore.getState().id;
  useDuaVoiceStore.getState().setId(voice.id);
  if (previous === voice.id) return;
  const { queue, index } = useAudioEngine.getState();
  const current = queue[index];
  if (!current || current.kind !== 'dua') return;
  const next = queue.map((item) => {
    if (item.kind !== 'dua') return item;
    const slug = item.duaSlug ?? item.id.replace(/^dua:(?:[^:]+:)?/, '');
    const ayahNumber = resolveDuaAyahNumber({
      ayahNumber: item.ayahNumber,
      slug,
      arabic: item.duaArabic,
      categoryNumber: item.categoryNumber,
    });
    const uri =
      resolveDuaAudioUrl({
        voiceId: voice.id,
        openDuaUrl: item.openDuaUrl,
        audioUrl: null,
        ayahNumber,
        slug,
        arabic: item.duaArabic,
        categoryNumber: item.categoryNumber,
      }) ?? item.uri;
    return {
      ...item,
      id: `dua:${voice.id}:${slug}`,
      uri,
      artist: voice.name,
      duaSlug: slug,
      ayahNumber: ayahNumber ?? item.ayahNumber,
    };
  });
  await playQueue(next, index);
}

async function loadStoredDuas(locale: Locale, userId?: string): Promise<DuaItem[]> {
  const lang = asLocale(locale);
  try {
    const client = requireSupabase();
    const [{ data, error }, favorites] = await Promise.all([
      client.from('duas').select('id, slug, arabic, transliteration, source, audio_url, sort_order, dua_translations(locale, title, meaning, source)').order('sort_order'),
      userId ? client.from('dua_favorites').select('dua_id').eq('user_id', userId) : Promise.resolve({ data: [] }),
    ]);
    if (error || !data?.length) return [];
    const favoriteIds = new Set((favorites.data ?? []).map((row) => row.dua_id as string));
    return data.map((row) => {
      const translations = (row.dua_translations as { locale: string; title: string; meaning: string; source: string | null }[] | null) ?? [];
      const chosen = pickTranslation(translations, lang);
      const source = chosen?.source ?? (row.source as string | null) ?? null;
      const slug = row.slug as string;
      return {
        id: row.id as string,
        slug,
        arabic: row.arabic as string,
        transliteration: (row.transliteration as string | null) ?? null,
        audioUrl: (row.audio_url as string | null) ?? null,
        openDuaUrl: null,
        ayahNumber: ayahFor({ slug, source, arabic: row.arabic as string }),
        title: chosen?.title ?? null,
        meaning: chosen?.meaning ?? null,
        source,
        favorite: favoriteIds.has(row.id as string),
      };
    });
  } catch {
    return [];
  }
}

function fromCatalog(entries: DuaEntry[], locale: Locale): DuaItem[] {
  const lang = asLocale(locale);
  return entries.flatMap((entry) => {
    const arabic = entry.arabic.trim();
    if (!arabic) return [];
    const english = entry.english.trim();
    const hisnCategory = categoryLabelFor(entry, lang);
    const snippet = english.split(/[.؟!?\n]/)[0]?.trim() || english.slice(0, 72);
    const baseSlug = entry.slug || entry.id;
    const reference = entry.reference.trim();
    const meaning = lang === 'ar' ? null : english || null;

    const surahs = detectSurahsInText(arabic, english, reference);
    if (surahs.length > 0) {
      return surahs.map((hit) => {
        const categoryNumber = surahCategoryKey(hit.surah);
        const label = surahCategoryLabel(hit.surah, lang);
        const title = surahTitle(hit.surah, lang);
        const source = hit.source;
        const slug = `${baseSlug}-s${hit.surah}`;
        const split = surahs.length > 1;
        return {
          id: `${entry.id}:s${hit.surah}`,
          slug,
          // Keep full Hisn Arabic so OpenDua audio can resolve (never replace with surah title).
          arabic,
          transliteration: entry.transliteration ?? null,
          audioUrl: null,
          openDuaUrl: null,
          ayahNumber: surahFirstAyahGlobal(hit.surah) ?? ayahFor({ slug: baseSlug, source, arabic }),
          categoryNumber,
          // Hisn source number for OpenDua bySource lookup (do not mangle with surah id).
          entryNumber: entry.number,
          categoryLabel: label,
          title,
          meaning: split
            ? lang === 'tr'
              ? `${title} suresi (Hisn: ${hisnCategory ?? '—'})`
              : `${title} · ${hisnCategory ?? ''}`.trim()
            : meaning,
          source,
          favorite: false,
        };
      });
    }

    const source = reference || hisnCategory;
    const kursi = isAyatAlKursi(arabic);
    const title = hisnDuaTitle({
      lang,
      categoryLabel: hisnCategory,
      entryNumber: entry.number,
      englishSnippet: snippet,
      isKursi: kursi,
    });

    return [{
      id: entry.id,
      slug: baseSlug,
      arabic,
      transliteration: entry.transliteration ?? null,
      audioUrl: null,
      openDuaUrl: null,
      ayahNumber: ayahFor({ slug: baseSlug, source, arabic, categoryNumber: entry.categoryNumber }),
      categoryNumber: entry.categoryNumber,
      entryNumber: entry.number,
      categoryLabel: hisnCategory,
      title,
      meaning,
      source,
      favorite: false,
    }];
  });
}

export function filterDuas(duas: DuaItem[], query: string) {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return duas;
  return duas.filter((dua) => {
    const haystack = [dua.title, dua.meaning, dua.arabic, dua.transliteration, dua.source, dua.categoryLabel, dua.slug]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase();
    return haystack.includes(needle);
  });
}

export function groupDuasByCategory(duas: DuaItem[], fallbackTitle: string) {
  const sections: { key: string; title: string; data: DuaItem[] }[] = [];
  const index = new Map<string, { key: string; title: string; data: DuaItem[] }>();
  for (const dua of duas) {
    const key = dua.categoryNumber ?? dua.categoryLabel ?? 'general';
    const title = dua.categoryLabel?.trim() || fallbackTitle;
    let section = index.get(key);
    if (!section) {
      section = { key, title, data: [] };
      index.set(key, section);
      sections.push(section);
    }
    section.data.push(dua);
  }
  return sections.sort((a, b) => {
    const rank = (key: string) => {
      if (key.startsWith('surah:')) return 2000 + Number(key.slice(6) || 0);
      const n = Number(key);
      return Number.isFinite(n) ? n : 5000;
    };
    return rank(a.key) - rank(b.key);
  });
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function localFavoritesKey(userId: string) {
  return `safdas:duas:favorites:v1:${userId}`;
}

async function readLocalFavorites(userId: string): Promise<Set<string>> {
  const { readCached } = await import('@/services/remoteStore');
  const list = await readCached<string[]>(localFavoritesKey(userId));
  return new Set((list ?? []).filter(Boolean));
}

async function writeLocalFavorites(userId: string, ids: Set<string>) {
  const { writeCached } = await import('@/services/remoteStore');
  await writeCached(localFavoritesKey(userId), [...ids]);
}

export function markDuaFavorites(duas: DuaItem[], favoriteKeys: Set<string>): DuaItem[] {
  if (!favoriteKeys.size) return duas;
  return duas.map((dua) => ({
    ...dua,
    favorite: favoriteKeys.has(dua.id) || favoriteKeys.has(dua.slug) || dua.favorite,
  }));
}

/** Heart toggle: Hisn catalog ids ("27:3") stay local; DB UUID rows sync to Supabase. */
export async function toggleFavorite(userId: string, duaId: string, favorite: boolean) {
  const local = await readLocalFavorites(userId);
  if (favorite) local.delete(duaId);
  else local.add(duaId);
  await writeLocalFavorites(userId, local);

  if (!isUuid(duaId)) return;

  const client = requireSupabase();
  if (favorite) {
    const { error } = await client.from('dua_favorites').delete().eq('user_id', userId).eq('dua_id', duaId);
    if (error) throw error;
    return;
  }
  const { error } = await client.from('dua_favorites').insert({ user_id: userId, dua_id: duaId });
  if (error) throw error;
}

export async function loadPlaylists(userId: string, locale: Locale): Promise<Playlist[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('dua_playlists')
    .select('id, name, repeat_mode, shuffle, dua_playlist_items(id, sort_order, dua_id, duas(id, slug, arabic, transliteration, source, audio_url, dua_translations(locale, title, meaning, source)))')
    .eq('user_id', userId)
    .order('created_at');
  if (error) throw error;
  const lang = asLocale(locale);
  const audio = await readDuaAudioIndex();
  return (data ?? []).map((row) => {
    const items = ((row.dua_playlist_items as unknown as {
      id: string;
      sort_order: number;
      duas: {
        id: string;
        slug: string;
        arabic: string;
        transliteration: string | null;
        source: string | null;
        audio_url: string | null;
        dua_translations: { locale: string; title: string; meaning: string; source: string | null }[] | null;
      } | null;
    }[]) ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((item): PlaylistItem => {
        const dua = item.duas;
        const translation = dua?.dua_translations?.find((entry) => entry.locale === lang);
        const slug = dua?.slug ?? item.id;
        const source = translation?.source ?? dua?.source ?? null;
        return withAudio(
          {
            itemId: item.id,
            sortOrder: item.sort_order,
            id: dua?.id ?? item.id,
            slug,
            arabic: dua?.arabic ?? '',
            transliteration: dua?.transliteration ?? null,
            audioUrl: dua?.audio_url ?? null,
            openDuaUrl: null,
            ayahNumber: ayahFor({ slug, source, arabic: dua?.arabic ?? '' }),
            title: translation?.title ?? null,
            meaning: translation?.meaning ?? null,
            source,
            favorite: false,
          },
          audio,
        );
      });
    return {
      id: row.id as string,
      name: row.name as string,
      repeatMode: (row.repeat_mode as Playlist['repeatMode']) ?? 'off',
      shuffle: Boolean(row.shuffle),
      items,
    };
  });
}

export async function createPlaylist(userId: string, name: string) {
  const { data, error } = await requireSupabase().from('dua_playlists').insert({ user_id: userId, name }).select('id').single();
  if (error) throw error;
  return data.id as string;
}

export async function renamePlaylist(id: string, name: string) {
  const { error } = await requireSupabase().from('dua_playlists').update({ name, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function deletePlaylist(id: string) {
  const { error } = await requireSupabase().from('dua_playlists').delete().eq('id', id);
  if (error) throw error;
}

export async function addToPlaylist(playlistId: string, duaId: string, sortOrder: number) {
  const { error } = await requireSupabase().from('dua_playlist_items').insert({ playlist_id: playlistId, dua_id: duaId, sort_order: sortOrder });
  if (error) throw error;
}

export async function removePlaylistItem(itemId: string) {
  const { error } = await requireSupabase().from('dua_playlist_items').delete().eq('id', itemId);
  if (error) throw error;
}

export async function savePlaylistOrder(items: { itemId: string }[]) {
  const client = requireSupabase();
  await Promise.all(items.map((item, index) => client.from('dua_playlist_items').update({ sort_order: index }).eq('id', item.itemId)));
}
