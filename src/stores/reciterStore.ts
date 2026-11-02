import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_RECITER_ID, getReciter } from '@/services/quran/reciters';

type ReciterState = {
  id: string;
  setId: (id: string) => void;
};

export const useReciterStore = create<ReciterState>()(
  persist(
    (set) => ({
      id: DEFAULT_RECITER_ID,
      setId: (id) => set({ id: getReciter(id).id }),
    }),
    { name: 'safdas-reciter', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
