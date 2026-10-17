import { BUNDLED_DUAS, type DuaLocale } from '@/content/duas';
import type { Locale } from '@/i18n';
import { requireSupabase } from '@/lib/supabase';
import type { PlayableTrack } from '@/services/audio/engine';
import { playQueue, useAudioEngine } from '@/services/audio/engine';
import { arabicKey, lookupDuaAudio, readDuaAudioIndex, syncDuaAudioIndex, type DuaAudioIndex } from '@/services/dua/audioCatalog';
import {
  DUA_AYAH_BY_SLUG,
  duaVoiceArtist,
  getDuaVoice,
  globalAyahNumber,
  parseAyahRef,
  resolveDuaAudioUrl,
} from '@/services/dua/voices';
import { syncDuaCatalog, type DuaEntry } from '@/services/duaCatalog';
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

function categoryLabelFor(entry: Pick<DuaEntry, 'categoryEn' | 'categoryAr'>, lang: DuaLocale) {
  if (lang === 'ar') return entry.categoryAr || entry.categoryEn || null;
  return entry.categoryEn || entry.categoryAr || null;
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
    categoryLabel: current.categoryLabel ?? next.categoryLabel,
    title: current.title ?? next.title,
    meaning: current.meaning ?? next.meaning,
    source: current.source ?? next.source,
    transliteration: current.transliteration ?? next.transliteration,
    favorite: current.favorite || next.favorite,
  };
}

function ayahFor(slug: string, source: string | null | undefined) {
  if (DUA_AYAH_BY_SLUG[slug]) return DUA_AYAH_BY_SLUG[slug] ?? null;
  const ref = parseAyahRef(source);
  if (!ref) return null;
  return globalAyahNumber(ref.surah, ref.ayah);
}

function withAudio<T extends DuaItem>(dua: T, index: DuaAudioIndex | null): T {
  const clip = lookupDuaAudio(dua.arabic, index, {
    categoryNumber: dua.categoryNumber,
    number: dua.entryNumber,
  });
  const openDuaUrl = dua.openDuaUrl ?? clip?.url ?? null;
  const ayahNumber = dua.ayahNumber ?? ayahFor(dua.slug, dua.source);
  const voiceId = useDuaVoiceStore.getState().id;
  const audioUrl = resolveDuaAudioUrl({
    voiceId,
    openDuaUrl,
    audioUrl: dua.audioUrl,
    ayahNumber,
    slug: dua.slug,
    source: dua.source,
  });
  return { ...dua, openDuaUrl, ayahNumber, audioUrl };
}

function attachAudio(duas: DuaItem[], index: DuaAudioIndex | null) {
  return duas.map((dua) => withAudio(dua, index));
}

export function mergeDuas(groups: DuaItem[][]) {
  const map = new Map<string, DuaItem>();
  for (const group of groups) {
    for (const dua of group) {
      const key = arabicKey(dua.arabic);
      if (!key) continue;
      const existing = map.get(key);
      map.set(key, existing ? fillDua(existing, dua) : dua);
    }
  }
  return [...map.values()].sort(compareDuaItems);
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
      ayahNumber: ayahFor(dua.slug, source),
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
    const uri = resolveDuaAudioUrl({
      voiceId,
      openDuaUrl: dua.openDuaUrl,
      audioUrl: dua.audioUrl,
      ayahNumber: dua.ayahNumber,
      slug: dua.slug,
      source: dua.source,
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
      ayahNumber: dua.ayahNumber ?? undefined,
      openDuaUrl: dua.openDuaUrl,
    });
  }
  return tracks;
}

export async function loadDuas(locale: Locale, userId?: string): Promise<DuaItem[]> {
  const stored = await loadStoredDuas(locale, userId);
  let remote: DuaItem[] = [];
  try {
    const { readCached } = await import('@/services/remoteStore');
    const { DUA_CATALOG_KEY } = await import('@/services/duaCatalog');
    const cached = await readCached<{ duas: DuaEntry[]; incomplete?: boolean }>('safdas:duas:catalog:v1');
    const cachedV2 = await readCached<{ duas: DuaEntry[]; incomplete?: boolean }>(DUA_CATALOG_KEY);
    const best = (cachedV2?.duas?.length ?? 0) >= (cached?.duas?.length ?? 0) ? cachedV2 : cached;
    if (best?.duas?.length) remote = fromCatalog(best.duas, locale);
  } catch {
    remote = [];
  }
  const audio = await readDuaAudioIndex();
  const merged = attachAudio(mergeDuas([stored, remote]), audio);
  return merged.length ? merged : attachAudio(stored, audio);
}

/** Arka planda katalog + OpenDua ses indeksi; eksik kategori varsa force tamamlar. */
export async function refreshDuaCatalogInBackground(locale: Locale): Promise<DuaItem[] | null> {
  try {
    const { catalogCoverage } = await import('@/services/duaCatalog');
    let catalog = await syncDuaCatalog();
    if (!catalogCoverage(catalog).complete) {
      catalog = await syncDuaCatalog({ force: true });
    }
    const audio = await syncDuaAudioIndex().catch(() => readDuaAudioIndex());
    return attachAudio(fromCatalog(catalog.duas, locale), audio);
  } catch {
    return null;
  }
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
    const uri =
      resolveDuaAudioUrl({
        voiceId: voice.id,
        openDuaUrl: item.openDuaUrl,
        audioUrl: item.openDuaUrl ? null : item.uri,
        ayahNumber: item.ayahNumber,
        slug,
      }) ?? item.uri;
    return {
      ...item,
      id: `dua:${voice.id}:${slug}`,
      uri,
      artist: voice.name,
      duaSlug: slug,
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
    if (error || !data?.length) return fromBundle(locale, new Set());
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
        ayahNumber: ayahFor(slug, source),
        title: chosen?.title ?? null,
        meaning: chosen?.meaning ?? null,
        source,
        favorite: favoriteIds.has(row.id as string),
      };
    });
  } catch {
    return fromBundle(locale, new Set());
  }
}

function fromCatalog(entries: DuaEntry[], locale: Locale): DuaItem[] {
  const lang = asLocale(locale);
  return entries.flatMap((entry) => {
    const arabic = entry.arabic.trim();
    if (!arabic) return [];
    const english = entry.english.trim();
    const category = categoryLabelFor(entry, lang);
    const snippet = english.split(/[.؟!?\n]/)[0]?.trim() || english.slice(0, 48);
    const slug = entry.slug || entry.id;
    const source = entry.reference.trim() || category;
    // Catalog API only ships Arabic + English. Prefer locale-correct category labels;
    // never present English copy as if it were Arabic UI text.
    const title =
      lang === 'ar'
        ? category || snippet || null
        : lang === 'en'
          ? snippet || category
          : category || snippet || null;
    const meaning = lang === 'ar' ? null : english || null;
    return [{
      id: entry.id,
      slug,
      arabic,
      transliteration: entry.transliteration ?? null,
      audioUrl: null,
      openDuaUrl: null,
      ayahNumber: ayahFor(slug, source),
      categoryNumber: entry.categoryNumber,
      entryNumber: entry.number,
      categoryLabel: category,
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
  return sections;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function toggleFavorite(userId: string, duaId: string, favorite: boolean) {
  if (!isUuid(duaId)) throw new Error('favorite_unavailable');
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
            ayahNumber: ayahFor(slug, source),
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
