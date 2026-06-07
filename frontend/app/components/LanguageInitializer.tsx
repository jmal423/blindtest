'use client';

import { useEffect } from 'react';
import { useSettings } from '@/app/context/SettingsContext';

export default function LanguageInitializer() {
  const { settings } = useSettings();

  useEffect(() => {
    document.documentElement.lang = settings.language;
  }, [settings.language]);

  return null;
}
