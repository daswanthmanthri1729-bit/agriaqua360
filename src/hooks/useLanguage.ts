import { useTranslation } from 'react-i18next';
import { isLanguage, Language } from '@/locales';
import { usePreferences } from '@/store/preferences';
import { supabase } from '@/lib/supabase';

// Switches i18next immediately (all mounted screens re-render) and persists the choice.
export function useLanguage() {
  const { i18n } = useTranslation();
  const setLanguage = usePreferences((s) => s.setLanguage);
  const language: Language = isLanguage(i18n.language) ? i18n.language : 'en';
  const change = (l: Language) => {
    i18n.changeLanguage(l);
    setLanguage(l);
    // Best-effort sync so AI answers and notifications follow the language; ignored when signed out.
    supabase.auth.getSession().then(({ data }) => {
      const id = data.session?.user.id;
      if (id) supabase.from('profiles').update({ preferred_language: l }).eq('id', id).then(() => {});
    });
  };
  return { language, change };
}
