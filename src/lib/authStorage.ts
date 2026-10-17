import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Chunked SecureStore adapter for Supabase auth.
 * Keeps the session across app restarts. Falls back to/migrates from AsyncStorage
 * so existing signed-in users are not forced to log in again after this change.
 *
 * Sign-out policy lives in AuthProvider / settings — storage only persists the session.
 */
const CHUNK = 1800;

async function deleteChunks(key: string) {
  const meta = await SecureStore.getItemAsync(`${key}.n`);
  const count = meta ? Number(meta) : 0;
  const jobs = [SecureStore.deleteItemAsync(`${key}.n`)];
  for (let index = 0; index < Math.max(count, 1); index += 1) {
    jobs.push(SecureStore.deleteItemAsync(`${key}.${index}`));
  }
  await Promise.all(jobs.map((job) => job.catch(() => undefined)));
}

async function readSecure(key: string) {
  const meta = await SecureStore.getItemAsync(`${key}.n`);
  if (!meta) {
    return SecureStore.getItemAsync(key);
  }
  const count = Number(meta);
  if (!Number.isFinite(count) || count <= 0) return null;
  const parts: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const part = await SecureStore.getItemAsync(`${key}.${index}`);
    if (part == null) return null;
    parts.push(part);
  }
  return parts.join('');
}

async function writeSecure(key: string, value: string) {
  await deleteChunks(key);
  await SecureStore.deleteItemAsync(key).catch(() => undefined);
  if (value.length <= CHUNK) {
    await SecureStore.setItemAsync(key, value);
    return;
  }
  const count = Math.ceil(value.length / CHUNK);
  await SecureStore.setItemAsync(`${key}.n`, String(count));
  for (let index = 0; index < count; index += 1) {
    await SecureStore.setItemAsync(`${key}.${index}`, value.slice(index * CHUNK, (index + 1) * CHUNK));
  }
}

export const authStorage = {
  async getItem(key: string) {
    if (Platform.OS === 'web') {
      try {
        return globalThis.localStorage?.getItem(key) ?? null;
      } catch {
        return null;
      }
    }

    const secure = await readSecure(key);
    if (secure != null) return secure;

    // One-time migration from the previous AsyncStorage session key.
    try {
      const legacy = await AsyncStorage.getItem(key);
      if (legacy) {
        await writeSecure(key, legacy);
        await AsyncStorage.removeItem(key).catch(() => undefined);
        return legacy;
      }
    } catch {
      /* ignore */
    }
    return null;
  },

  async setItem(key: string, value: string) {
    if (Platform.OS === 'web') {
      try {
        globalThis.localStorage?.setItem(key, value);
      } catch {
        /* ignore quota */
      }
      return;
    }
    await writeSecure(key, value);
    await AsyncStorage.removeItem(key).catch(() => undefined);
  },

  async removeItem(key: string) {
    if (Platform.OS === 'web') {
      try {
        globalThis.localStorage?.removeItem(key);
      } catch {
        /* ignore */
      }
      return;
    }
    await deleteChunks(key);
    await SecureStore.deleteItemAsync(key).catch(() => undefined);
    await AsyncStorage.removeItem(key).catch(() => undefined);
  },
};
