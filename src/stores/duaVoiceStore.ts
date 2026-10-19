import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_DUA_VOICE_ID, getDuaVoice } from '@/services/dua/voices';

type DuaVoiceState = {
  id: string;
  setId: (id: string) => void;
};

export const useDuaVoiceStore = create<DuaVoiceState>()(
  persist(
    (set) => ({
      id: DEFAULT_DUA_VOICE_ID,
      setId: (id) => set({ id: getDuaVoice(id).id }),
    }),
    { name: 'safdas-dua-voice', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
