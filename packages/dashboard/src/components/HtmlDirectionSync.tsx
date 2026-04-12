// ============================================================
// SUPER RESERVATION PLATFORM — HTML Direction Sync
// Client component that syncs <html> lang/dir attributes
// with the Zustand language store.
// ============================================================

'use client';

import { useEffect } from 'react';
import { useLanguage } from '@/store/language';

export default function HtmlDirectionSync() {
  const lang = useLanguage((s) => s.lang);

  useEffect(() => {
    const html = document.documentElement;
    html.lang = lang;
    html.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.body.style.direction = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  return null;
}
