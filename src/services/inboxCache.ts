import AsyncStorage from '@react-native-async-storage/async-storage';
import type { InboxRow } from '@/services/social';

const keyFor = (userId: string) => `safdas:inbox:v1:${userId}`;

export async function readInboxCache(userId: string): Promise<InboxRow[] | undefined> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as InboxRow[];
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export async function writeInboxCache(userId: string, rows: InboxRow[]) {
  try {
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify(rows));
  } catch {
    /* ignore quota */
  }
}
