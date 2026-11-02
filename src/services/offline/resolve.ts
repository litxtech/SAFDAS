import { Directory, File, Paths } from 'expo-file-system';

const ROOT = 'safdas-offline';

export function offlineRoot() {
  return new Directory(Paths.document, ROOT);
}

/** edition klasör adı = reciter id (CDN identifier). */
export function quranPackDir(reciterId: string) {
  return new Directory(Paths.document, ROOT, 'quran', reciterId);
}

export function quranAyahFile(reciterId: string, ayah: number) {
  return new File(quranPackDir(reciterId), `${ayah}.mp3`);
}

export function duaPackDir() {
  return new Directory(Paths.document, ROOT, 'duas');
}

export function duaClipFile(fileName: string) {
  return new File(duaPackDir(), fileName);
}

export function ensureOfflineDirs() {
  const root = offlineRoot();
  if (!root.exists) root.create({ intermediates: true });
  const quran = new Directory(Paths.document, ROOT, 'quran');
  if (!quran.exists) quran.create({ intermediates: true });
  const duas = duaPackDir();
  if (!duas.exists) duas.create({ intermediates: true });
}

export function localQuranUri(reciterId: string, ayah: number) {
  try {
    const file = quranAyahFile(reciterId, ayah);
    if (file.exists) return file.uri;
  } catch {
    /* native module yok / web */
  }
  return null;
}

export function localDuaUri(remoteUrl: string | null | undefined) {
  if (!remoteUrl) return null;
  try {
    const name = duaFileName(remoteUrl);
    if (!name) return null;
    const file = duaClipFile(name);
    if (file.exists) return file.uri;
  } catch {
    /* ignore */
  }
  return null;
}

export function duaFileName(remoteUrl: string) {
  try {
    const path = remoteUrl.split('?')[0] ?? remoteUrl;
    const leaf = path.split('/').pop();
    if (!leaf || !leaf.endsWith('.mp3')) return null;
    return leaf.replace(/[^a-zA-Z0-9._-]/g, '_');
  } catch {
    return null;
  }
}

export function directoryBytes(dir: Directory): number {
  try {
    if (!dir.exists) return 0;
    let total = 0;
    for (const item of dir.list()) {
      if (item instanceof File) total += item.size ?? 0;
      else if (item instanceof Directory) total += directoryBytes(item);
    }
    return total;
  } catch {
    return 0;
  }
}
