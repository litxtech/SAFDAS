import { translate, useI18nStore } from '@/i18n';
import { readCached, refreshCached, writeCached } from '@/services/remoteStore';

const BASE = 'https://api.islamic.app/v1/dhikr';
/** v2: always finish incomplete catalogs; parse transliteration from HTML body. */
export const DUA_CATALOG_KEY = 'safdas:duas:catalog:v2';
const FULL_REFRESH_MS = 24 * 60 * 60 * 1000;
const SOFT_TTL_MS = 6 * 60 * 60 * 1000;
const CONCURRENCY = 8;
const MAX_ROUNDS = 3;

export type DuaCategory = {
  number: string;
  en: string;
  ar: string;
  count: number;
};

export type DuaEntry = {
  id: string;
  number: string;
  categoryNumber: string;
  categoryEn: string;
  categoryAr: string;
  arabic: string;
  english: string;
  reference: string;
  repeatCount?: number;
  slug?: string;
  transliteration?: string;
};

export type DuaCatalog = {
  categories: DuaCategory[];
  shortcuts: string[];
  duas: DuaEntry[];
  fingerprints: Record<string, number>;
  syncedAt: number;
  incomplete: boolean;
  expectedCount: number;
};

export type DuaGroup = {
  id: string;
  titleEn: string;
  titleAr: string;
  duas: DuaEntry[];
};

type RawText = { text?: string; body?: string };
type RawDua = {
  number: string;
  slug?: string;
  repeatCount?: number;
  transliteration?: { en?: string };
  source?: { en?: string };
  category?: { number: string; en: string; ar: string };
  en: RawText;
  ar: RawText;
};

type IndexPayload = {
  data: {
    shortcuts?: string[];
    categories?: DuaCategory[];
  };
};

type GroupPayload = {
  data: {
    shortcut?: string;
    label?: string;
    category?: { number: string; en: string; ar: string };
    duas?: RawDua[];
  };
};

function duaError() {
  return new Error(translate(useI18nStore.getState().locale, 'duasError'));
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw duaError();
  return response.json() as Promise<T>;
}

function stripTags(value: string) {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function spanText(body: string, className: string) {
  const match = body.match(new RegExp(`<span[^>]*class=["'][^"']*${className}[^"']*["'][^>]*>([\\s\\S]*?)</span>`, 'i'));
  return match?.[1] ? stripTags(match[1]) : '';
}

function referenceFrom(body: string) {
  const labeled = spanText(body, 'hisn_english_reference');
  if (labeled) return labeled;
  const parts = body.split(/Reference:\s*/i);
  const reference = parts[parts.length - 1];
  if (parts.length < 2 || !reference) return '';
  return stripTags(reference);
}

function toEntry(raw: RawDua): DuaEntry {
  const category = raw.category ?? { number: '0', en: '', ar: '' };
  const enBody = raw.en.body ?? '';
  return {
    id: `${category.number}:${raw.number}`,
    number: String(raw.number),
    categoryNumber: String(category.number),
    categoryEn: category.en,
    categoryAr: category.ar,
    arabic: raw.ar.text?.trim() ?? '',
    english: raw.en.text?.trim() ?? '',
    reference: raw.source?.en?.trim() || referenceFrom(enBody),
    repeatCount: raw.repeatCount,
    slug: raw.slug,
    transliteration: raw.transliteration?.en?.trim() || spanText(enBody, 'transliteration') || undefined,
  };
}

function compareDuas(a: DuaEntry, b: DuaEntry) {
  const category = Number(a.categoryNumber) - Number(b.categoryNumber);
  if (category !== 0) return category;
  return Number(a.number) - Number(b.number);
}

async function mapPool<T>(items: T[], limit: number, task: (item: T) => Promise<void>) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length || 1) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      const item = items[index];
      if (item !== undefined) await task(item);
    }
  });
  await Promise.all(workers);
}

async function loadGroup(id: string): Promise<DuaGroup> {
  const json = await getJson<GroupPayload>(`${BASE}/${encodeURIComponent(id)}`);
  const duas = (json.data.duas ?? []).map(toEntry);
  const first = duas[0];
  return {
    id,
    titleEn: json.data.label || json.data.category?.en || first?.categoryEn || id,
    titleAr: json.data.category?.ar || first?.categoryAr || json.data.label || id,
    duas,
  };
}

function expectedCount(categories: DuaCategory[]) {
  return categories.reduce((sum, category) => sum + (Number(category.count) || 0), 0);
}

function isCatalogComplete(catalog: DuaCatalog | null | undefined) {
  if (!catalog?.categories?.length) return false;
  if (catalog.incomplete) return false;
  const expected = catalog.expectedCount || expectedCount(catalog.categories);
  if (expected > 0 && catalog.duas.length < expected) return false;
  return !catalog.categories.some((category) => (catalog.fingerprints[category.number] ?? 0) !== category.count);
}

async function mergeEntries(entries: DuaEntry[]) {
  if (!entries.length) return;
  const cached = await readCached<DuaCatalog>(DUA_CATALOG_KEY);
  if (!cached) return;
  const duas = new Map(cached.duas.map((dua) => [dua.id, dua]));
  for (const entry of entries) duas.set(entry.id, entry);
  const fingerprints = { ...cached.fingerprints };
  for (const number of new Set(entries.map((entry) => entry.categoryNumber))) {
    fingerprints[number] = [...duas.values()].filter((dua) => dua.categoryNumber === number).length;
  }
  const next: DuaCatalog = {
    ...cached,
    duas: [...duas.values()].sort(compareDuas),
    fingerprints,
    expectedCount: cached.expectedCount || expectedCount(cached.categories),
    incomplete: cached.categories.some((category) => (fingerprints[category.number] ?? 0) !== category.count),
  };
  await writeCached(DUA_CATALOG_KEY, next);
}

async function downloadCatalog(force: boolean): Promise<DuaCatalog> {
  const cached = await readCached<DuaCatalog>(DUA_CATALOG_KEY);
  const index = await getJson<IndexPayload>(BASE);
  const categories = index.data.categories ?? [];
  const shortcuts = index.data.shortcuts ?? [];
  if (!categories.length) throw duaError();

  const expected = expectedCount(categories);
  const full = force || !cached || Date.now() - cached.syncedAt > FULL_REFRESH_MS || !isCatalogComplete(cached);
  const pending = categories.filter(
    (category) => full || (cached?.fingerprints[category.number] ?? -1) !== category.count,
  );
  const live = new Set(categories.map((category) => category.number));
  const duas = new Map(
    (cached?.duas ?? []).filter((dua) => live.has(dua.categoryNumber)).map((dua) => [dua.id, dua]),
  );
  const fingerprints = { ...(cached?.fingerprints ?? {}) };
  for (const number of Object.keys(fingerprints)) {
    if (!live.has(number)) delete fingerprints[number];
  }

  let failed = 0;
  let roundPending = pending;

  for (let round = 0; round < MAX_ROUNDS && roundPending.length; round += 1) {
    const retry: DuaCategory[] = [];
    await mapPool(roundPending, CONCURRENCY, async (category) => {
      try {
        const group = await loadGroup(category.number);
        for (const [id, dua] of duas) {
          if (dua.categoryNumber === category.number) duas.delete(id);
        }
        for (const entry of group.duas) duas.set(entry.id, entry);
        fingerprints[category.number] = group.duas.length;
        if (group.duas.length !== category.count) retry.push(category);
      } catch {
        retry.push(category);
      }
    });
    failed = retry.length;
    roundPending = retry;
  }

  const incomplete =
    failed > 0 ||
    categories.some((category) => (fingerprints[category.number] ?? 0) !== category.count) ||
    [...duas.values()].length < expected;

  return {
    categories,
    shortcuts,
    duas: [...duas.values()].sort(compareDuas),
    fingerprints,
    syncedAt: !incomplete ? Date.now() : cached?.syncedAt ?? 0,
    incomplete,
    expectedCount: expected,
  } satisfies DuaCatalog;
}

export async function syncDuaCatalog(options?: { force?: boolean }) {
  const force = Boolean(options?.force);
  const cached = await readCached<DuaCatalog>(DUA_CATALOG_KEY);

  // Fresh + complete → reuse. Incomplete or forced → always re-download missing parts.
  if (!force && cached && isCatalogComplete(cached)) {
    return refreshCached(DUA_CATALOG_KEY, SOFT_TTL_MS, () => downloadCatalog(false));
  }

  const value = await downloadCatalog(force || !isCatalogComplete(cached));
  await writeCached(DUA_CATALOG_KEY, value);
  return value;
}

export function fetchDuaGroup(id: string) {
  return refreshCached(`safdas:duas:group:${id}`, 0, async () => {
    const group = await loadGroup(id);
    await mergeEntries(group.duas);
    return group;
  });
}

export function catalogCoverage(catalog: DuaCatalog | null | undefined) {
  if (!catalog) return { have: 0, expected: 0, complete: false };
  const expected = catalog.expectedCount || expectedCount(catalog.categories);
  return {
    have: catalog.duas.length,
    expected,
    complete: isCatalogComplete(catalog),
  };
}
