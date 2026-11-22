import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Language } from '@/locales';

type Prefs = {
  language: Language | null;
  onboardingDone: boolean;
  permissionsReviewed: boolean;
  setLanguage: (l: Language) => void;
  setOnboardingDone: () => void;
  setPermissionsReviewed: () => void;
};

export const usePreferences = create<Prefs>()(
  persist(
    (set) => ({
      language: null,
      onboardingDone: false,
      permissionsReviewed: false,
      setLanguage: (language) => set({ language }),
      setOnboardingDone: () => set({ onboardingDone: true }),
      setPermissionsReviewed: () => set({ permissionsReviewed: true }),
    }),
    { name: 'agriaqua-preferences', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
