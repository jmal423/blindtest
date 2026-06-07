'use client';

import { useCallback } from 'react';
import { useSettings } from '@/app/context/SettingsContext';

import en from '@/locales/en.json';
import fr from '@/locales/fr.json';
import pt from '@/locales/pt.json';
import es from '@/locales/es.json';

type Locale = 'en' | 'fr' | 'pt' | 'es';
type TranslationDict = Record<string, string>;

const dicts: Record<Locale, TranslationDict> = { en, fr, pt, es };

export function useTranslation() {
  const { settings, updateSettings } = useSettings();
  const lang: Locale = settings.language as Locale;

  const t = useCallback((key: string, vars?: Record<string, string | number>) => {
    const dict = dicts[lang] || dicts.en;
    let text = dict[key];
    if (text === undefined) {
      text = dicts.en[key] || key;
    }
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        text = text.replace(`{${k}}`, String(v));
      }
    }
    return text;
  }, [lang]);

  const setLanguage = useCallback((language: Locale) => {
    updateSettings({ language });
  }, [updateSettings]);

  return { t, language: lang, setLanguage };
}
