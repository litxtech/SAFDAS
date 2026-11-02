import { File } from 'expo-file-system';
import { syncDuaAudioIndex } from '@/services/dua/audioCatalog';
import {
  directoryBytes,
  duaClipFile,
  duaFileName,
  duaPackDir,
  ensureOfflineDirs,
  offlineRoot,
  quranAyahFile,
  quranPackDir,
} from '@/services/offline/resolve';
import { estimateQuranPackBytes, getReciter, QURAN_AYAH_COUNT, RECITERS, remoteAudioUrl } from '@/services/quran/reciters';

export const OFFLINE_BUDGET_BYTES = 3 * 1024 * 1024 * 1024;
export const DUAS_PACK_ID = 'duas:hisn' as const;

export type QuranPackId = `quran:${string}`;
export type PackId = QuranPackId | typeof DUAS_PACK_ID;

export type PackStatus = 'idle' | 'queued' | 'downloading' | 'ready' | 'error' | 'paused';

export type PackState = {
  id: PackId;
  status: PackStatus;
  done: number;
  total: number;
  bytes: number;
  error?: string;
  updatedAt: number;
};

export type OfflineSnapshot = {
  packs: Record<string, PackState>;
  usedBytes: number;
  budgetBytes: number;
  activeId: PackId | null;
};

type ProgressHandler = (snapshot: OfflineSnapshot) => void;

let packs: Record<string, PackState> = {};
let listeners = new Set<ProgressHandler>();
/** Bumped to abort the currently running pack workers. */
let runGeneration = 0;
let running = false;
let activeId: PackId | null = null;
const queue: PackId[] = [];
/** Packs that should stop as soon as possible. */
const aborted = new Set<PackId>();
/** Packs removed via delete — ignore late pause markers. */
const removed = new Set<PackId>();
/** Cached total — full tree walks freeze the UI once thousands of files exist. */
let cachedUsedBytes = 0;
let cachedUsedFresh = false;

function emit() {
  const snapshot = getOfflineSnapshot();
  for (const listener of listeners) listener(snapshot);
}

function yieldToUi() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

export function subscribeOffline(listener: ProgressHandler) {
  listeners.add(listener);
  listener(getOfflineSnapshot());
  return () => {
    listeners.delete(listener);
  };
}

export function getOfflineSnapshot(): OfflineSnapshot {
  return {
    packs: { ...packs },
    usedBytes: readUsedBytes(),
    budgetBytes: OFFLINE_BUDGET_BYTES,
    activeId,
  };
}

export function quranPackId(reciterId: string): QuranPackId {
  return `quran:${getReciter(reciterId).id}`;
}

export function packLabelParts(id: PackId) {
  if (id === DUAS_PACK_ID) return { kind: 'duas' as const, reciterId: null };
  return { kind: 'quran' as const, reciterId: id.slice('quran:'.length) };
}

function measureUsedBytes() {
  try {
    cachedUsedBytes = directoryBytes(offlineRoot());
    cachedUsedFresh = true;
    return cachedUsedBytes;
  } catch {
    cachedUsedBytes = Object.values(packs).reduce((sum, pack) => sum + (pack.bytes || 0), 0);
    cachedUsedFresh = true;
    return cachedUsedBytes;
  }
}

function readUsedBytes() {
  if (cachedUsedFresh) return cachedUsedBytes;
  return measureUsedBytes();
}

function bumpUsedBytes(delta: number) {
  if (!cachedUsedFresh) measureUsedBytes();
  cachedUsedBytes = Math.max(0, cachedUsedBytes + delta);
}

function setPack(partial: PackState) {
  packs = { ...packs, [partial.id]: partial };
  emit();
}

function removeFromQueue(id: PackId) {
  for (let i = queue.length - 1; i >= 0; i -= 1) {
    if (queue[i] === id) queue.splice(i, 1);
  }
}

function packDirBytes(id: PackId) {
  try {
    if (id === DUAS_PACK_ID) return directoryBytes(duaPackDir());
    return directoryBytes(quranPackDir(id.slice('quran:'.length)));
  } catch {
    return packs[id]?.bytes ?? 0;
  }
}

function markPaused(id: PackId) {
  if (removed.has(id)) return;
  const prev = packs[id];
  const done = prev?.done ?? 0;
  const total = prev?.total ?? (id === DUAS_PACK_ID ? 0 : QURAN_AYAH_COUNT);
  setPack({
    id,
    status: done > 0 && done >= total && total > 0 ? 'ready' : 'paused',
    done,
    total,
    bytes: packDirBytes(id),
    updatedAt: Date.now(),
  });
}

async function mapPool<T>(items: T[], limit: number, task: (item: T) => Promise<void>, alive: () => boolean) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length || 1) }, async () => {
    while (alive() && cursor < items.length) {
      const index = cursor;
      cursor += 1;
      const item = items[index];
      if (item !== undefined) await task(item);
    }
  });
  await Promise.all(workers);
}

async function downloadFile(url: string, file: File) {
  if (file.exists) return file.size ?? 0;
  await File.downloadFileAsync(url, file, { idempotent: true });
  return file.size ?? 0;
}

function aliveFor(id: PackId, generation: number) {
  return () => runGeneration === generation && !aborted.has(id) && activeId === id;
}

async function downloadQuranPack(reciterId: string, generation: number) {
  const id = quranPackId(reciterId);
  const dir = quranPackDir(reciterId);
  ensureOfflineDirs();
  if (!dir.exists) dir.create({ intermediates: true });

  const ayahs = Array.from({ length: QURAN_AYAH_COUNT }, (_, index) => index + 1);
  const existingNames = new Set<string>();
  let bytes = 0;
  try {
    for (const item of dir.list()) {
      if (item instanceof File) {
        existingNames.add(item.name);
        bytes += item.size ?? 0;
      }
    }
  } catch {
    bytes = packs[id]?.bytes ?? 0;
  }
  let done = existingNames.size;

  setPack({ id, status: 'downloading', done, total: ayahs.length, bytes, updatedAt: Date.now() });

  const pending = ayahs.filter((ayah) => !existingNames.has(`${ayah}.mp3`));
  const alive = aliveFor(id, generation);
  let sinceYield = 0;

  await mapPool(
    pending,
    4,
    async (ayah) => {
      if (!alive()) return;
      try {
        const added = await downloadFile(remoteAudioUrl(ayah, reciterId), quranAyahFile(reciterId, ayah));
        if (!alive()) return;
        done += 1;
        bytes += added;
        bumpUsedBytes(added);
      } catch (error) {
        if (!alive()) return;
        if (error instanceof Error && error.message === 'offline_budget') throw error;
        // Skip a single failed ayah; keep the pack moving.
        return;
      }
      sinceYield += 1;
      if (done % 12 === 0 || done === ayahs.length) {
        if (readUsedBytes() > OFFLINE_BUDGET_BYTES) throw new Error('offline_budget');
        setPack({ id, status: 'downloading', done, total: ayahs.length, bytes, updatedAt: Date.now() });
      }
      if (sinceYield >= 8) {
        sinceYield = 0;
        await yieldToUi();
      }
    },
    alive,
  );

  if (!alive()) {
    markPaused(id);
    return;
  }
  try {
    bytes = directoryBytes(dir);
    done = dir.list().filter((item) => item instanceof File).length;
  } catch {
    /* keep counters */
  }
  setPack({
    id,
    status: done >= ayahs.length ? 'ready' : 'paused',
    done,
    total: ayahs.length,
    bytes,
    updatedAt: Date.now(),
  });
}

async function downloadDuasPack(generation: number) {
  const id = DUAS_PACK_ID;
  ensureOfflineDirs();
  const dir = duaPackDir();
  if (!dir.exists) dir.create({ intermediates: true });

  const index = await syncDuaAudioIndex();
  if (!aliveFor(id, generation)()) {
    markPaused(id);
    return;
  }

  const urls = [...new Set(Object.values(index.bySource).map((clip) => clip.url))];
  let done = urls.filter((url) => {
    const name = duaFileName(url);
    return Boolean(name && duaClipFile(name).exists);
  }).length;
  let bytes = directoryBytes(dir);
  setPack({ id, status: 'downloading', done, total: urls.length, bytes, updatedAt: Date.now() });

  const pending = urls.filter((url) => {
    const name = duaFileName(url);
    return Boolean(name && !duaClipFile(name).exists);
  });
  const alive = aliveFor(id, generation);
  let sinceYield = 0;

  await mapPool(
    pending,
    3,
    async (url) => {
      if (!alive()) return;
      const name = duaFileName(url);
      if (!name) {
        done += 1;
        return;
      }
      try {
        const added = await downloadFile(url, duaClipFile(name));
        if (!alive()) return;
        done += 1;
        bytes += added;
        bumpUsedBytes(added);
      } catch (error) {
        if (!alive()) return;
        if (error instanceof Error && error.message === 'offline_budget') throw error;
        return;
      }
      sinceYield += 1;
      if (done % 6 === 0 || done === urls.length) {
        if (readUsedBytes() > OFFLINE_BUDGET_BYTES) throw new Error('offline_budget');
        setPack({ id, status: 'downloading', done, total: urls.length, bytes, updatedAt: Date.now() });
      }
      if (sinceYield >= 6) {
        sinceYield = 0;
        await yieldToUi();
      }
    },
    alive,
  );

  if (!alive()) {
    markPaused(id);
    return;
  }
  bytes = directoryBytes(dir);
  done = urls.filter((url) => {
    const name = duaFileName(url);
    return Boolean(name && duaClipFile(name).exists);
  }).length;
  setPack({
    id,
    status: done >= urls.length && urls.length > 0 ? 'ready' : 'paused',
    done,
    total: urls.length,
    bytes,
    updatedAt: Date.now(),
  });
}

async function runQueue() {
  if (running) return;
  running = true;
  try {
    while (queue.length) {
      const id = queue.shift();
      if (!id) continue;
      if (aborted.has(id)) {
        markPaused(id);
        continue;
      }
      aborted.delete(id);
      activeId = id;
      const generation = runGeneration;
      emit();
      try {
        if (id === DUAS_PACK_ID) await downloadDuasPack(generation);
        else await downloadQuranPack(id.slice('quran:'.length), generation);
      } catch (error) {
        if (aborted.has(id) || runGeneration !== generation) {
          markPaused(id);
        } else {
          const message = error instanceof Error ? error.message : 'download_failed';
          const prev = packs[id];
          setPack({
            id,
            status: 'error',
            done: prev?.done ?? 0,
            total: prev?.total ?? 0,
            bytes: packDirBytes(id),
            error: message,
            updatedAt: Date.now(),
          });
        }
      } finally {
        if (activeId === id) activeId = null;
        emit();
      }
    }
  } finally {
    running = false;
    activeId = null;
    emit();
  }
}

function estimateIncoming(id: PackId) {
  if (id === DUAS_PACK_ID) return 50 * 1024 * 1024;
  return estimateQuranPackBytes(id.slice('quran:'.length));
}

/** Start or resume a pack download. */
export function enqueuePack(id: PackId) {
  ensureOfflineDirs();
  removed.delete(id);
  aborted.delete(id);
  const used = readUsedBytes();
  const existing = packs[id];
  if (existing?.status === 'ready') return;
  if (existing?.status === 'downloading' || activeId === id) return;
  if (queue.includes(id)) return;

  const projected = used + (existing?.bytes ? 0 : estimateIncoming(id));
  if (projected > OFFLINE_BUDGET_BYTES && !(existing && existing.done > 0)) {
    setPack({
      id,
      status: 'error',
      done: existing?.done ?? 0,
      total: existing?.total ?? 0,
      bytes: existing?.bytes ?? 0,
      error: 'offline_budget',
      updatedAt: Date.now(),
    });
    return;
  }

  setPack({
    id,
    status: 'queued',
    done: existing?.done ?? 0,
    total: existing?.total ?? (id === DUAS_PACK_ID ? 0 : QURAN_AYAH_COUNT),
    bytes: existing?.bytes ?? packDirBytes(id),
    updatedAt: Date.now(),
  });
  queue.push(id);
  void runQueue();
}

/** Pause a single pack (stop download, keep files). */
export function pausePack(id: PackId) {
  aborted.add(id);
  removeFromQueue(id);
  if (activeId === id) {
    runGeneration += 1;
  }
  const pack = packs[id];
  if (pack && (pack.status === 'downloading' || pack.status === 'queued')) {
    markPaused(id);
  }
  emit();
}

/** Cancel pack download (same as pause — partial files kept until delete). */
export function cancelPack(id: PackId) {
  pausePack(id);
}

/** Stop every active / queued download. */
export function cancelDownloads() {
  runGeneration += 1;
  const ids = new Set<PackId>([...queue, ...(activeId ? [activeId] : [])]);
  for (const id of Object.keys(packs) as PackId[]) {
    const pack = packs[id];
    if (pack?.status === 'downloading' || pack?.status === 'queued') ids.add(id);
  }
  queue.length = 0;
  for (const id of ids) {
    aborted.add(id);
    markPaused(id);
  }
  activeId = null;
  emit();
}

/** Delete downloaded files for a pack (stops download first). */
export function deletePack(id: PackId) {
  removed.add(id);
  aborted.add(id);
  removeFromQueue(id);
  if (activeId === id) {
    runGeneration += 1;
    activeId = null;
  }
  const before = packs[id]?.bytes ?? packDirBytes(id);
  try {
    if (id === DUAS_PACK_ID) {
      const dir = duaPackDir();
      if (dir.exists) dir.delete();
    } else {
      const dir = quranPackDir(id.slice('quran:'.length));
      if (dir.exists) dir.delete();
    }
  } catch {
    /* ignore */
  }
  bumpUsedBytes(-before);
  const next = { ...packs };
  delete next[id];
  packs = next;
  emit();
}

export function refreshPackStats() {
  ensureOfflineDirs();
  measureUsedBytes();
  for (const reciter of RECITERS) {
    const id = quranPackId(reciter.id);
    const dir = quranPackDir(reciter.id);
    if (!dir.exists) continue;
    let done = 0;
    try {
      done = dir.list().filter((item) => item instanceof File).length;
    } catch {
      done = 0;
    }
    const bytes = directoryBytes(dir);
    if (done <= 0) continue;
    const current = packs[id];
    if (current?.status === 'downloading' || current?.status === 'queued') {
      setPack({ ...current, done, bytes, updatedAt: Date.now() });
      continue;
    }
    setPack({
      id,
      status: done >= QURAN_AYAH_COUNT ? 'ready' : 'paused',
      done,
      total: QURAN_AYAH_COUNT,
      bytes,
      updatedAt: Date.now(),
    });
  }

  const duas = duaPackDir();
  if (duas.exists) {
    let done = 0;
    try {
      done = duas.list().filter((item) => item instanceof File).length;
    } catch {
      done = 0;
    }
    if (done > 0) {
      const current = packs[DUAS_PACK_ID];
      if (current?.status === 'downloading' || current?.status === 'queued') {
        setPack({ ...current, done, bytes: directoryBytes(duas), updatedAt: Date.now() });
      } else {
        setPack({
          id: DUAS_PACK_ID,
          status: done >= 200 ? 'ready' : 'paused',
          done,
          total: Math.max(done, current?.total ?? done),
          bytes: directoryBytes(duas),
          updatedAt: Date.now(),
        });
      }
    }
  }
  emit();
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'] as const;
  let value = bytes;
  let unit: 'B' | 'KB' | 'MB' | 'GB' = 'B';
  for (const next of units) {
    value /= 1024;
    unit = next;
    if (value < 1024) break;
  }
  return `${value.toFixed(value >= 10 || unit === 'GB' ? 1 : 0)} ${unit}`;
}
