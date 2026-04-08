// ============================================================
// SUPER RESERVATION PLATFORM — Language Store
// Persists 'ar' | 'en' preference to localStorage.
// ============================================================

import { create } from 'zustand';

export type Lang = 'ar' | 'en';

interface LanguageState {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

export const useLanguage = create<LanguageState>((set) => ({
  lang:
    typeof window !== 'undefined'
      ? ((localStorage.getItem('hagez_lang') as Lang | null) ?? 'ar')
      : 'ar',
  setLang: (lang) => {
    if (typeof window !== 'undefined') localStorage.setItem('hagez_lang', lang);
    set({ lang });
  },
}));
