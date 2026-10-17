import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'safdas-dhikr-prefs-v1';

export type DhikrPrefs = {
  sound: boolean;
  haptics: boolean;
};

const DEFAULTS: DhikrPrefs = { sound: true, haptics: true };

export async function loadDhikrPrefs(): Promise<DhikrPrefs> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<DhikrPrefs>;
    return {
      sound: typeof parsed.sound === 'boolean' ? parsed.sound : DEFAULTS.sound,
      haptics: typeof parsed.haptics === 'boolean' ? parsed.haptics : DEFAULTS.haptics,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveDhikrPrefs(prefs: DhikrPrefs) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}
