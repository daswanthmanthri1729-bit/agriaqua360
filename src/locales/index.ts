import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import en from './en/translation.json';
import te from './te/translation.json';
import hi from './hi/translation.json';

export const LANGUAGES = [
  { code: 'en', native: 'English', english: 'English', short: 'EN', glyph: 'En', speech: 'en-IN' },
  { code: 'te', native: 'తెలుగు', english: 'Telugu', short: 'తెలుగు', glyph: 'తె', speech: 'te-IN' },
  { code: 'hi', native: 'हिन्दी', english: 'Hindi', short: 'हिन्दी', glyph: 'अ', speech: 'hi-IN' },
] as const;
export type Language = (typeof LANGUAGES)[number]['code'];
export const isLanguage = (v: unknown): v is Language => LANGUAGES.some((l) => l.code === v);

export function deviceLanguage(): Language {
  const code = getLocales()[0]?.languageCode;
  return isLanguage(code) ? code : 'en';
}

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, te: { translation: te }, hi: { translation: hi } },
  lng: deviceLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
