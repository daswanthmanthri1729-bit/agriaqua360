import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Language } from '@/locales';
import type { WeatherQuery } from '@/features/weather/api';

type Prefs = {
  language: Language | null;
  onboardingDone: boolean;
  permissionsReviewed: boolean;
  weatherPlace: WeatherQuery | null;
  setWeatherPlace: (q: WeatherQuery | null) => void;
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
      weatherPlace: null,
      setWeatherPlace: (weatherPlace) => set({ weatherPlace }),
      setLanguage: (language) => set({ language }),
      setOnboardingDone: () => set({ onboardingDone: true }),
      setPermissionsReviewed: () => set({ permissionsReviewed: true }),
    }),
    { name: 'agriaqua-preferences', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
