'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export interface Settings {
  masterVolume: number;
  sfxVolume: number;
  autoFocusInput: boolean;
  reducedMotion: boolean;
  colorblindMode: boolean;
  theme: 'dark' | 'light';
  language: 'en' | 'fr' | 'pt' | 'es';
}

interface SettingsContextValue {
  settings: Settings;
  updateSettings: (partial: Partial<Settings>) => void;
}

const defaults: Settings = {
  masterVolume: 1,
  sfxVolume: 0.8,
  autoFocusInput: true,
  reducedMotion: false,
  colorblindMode: false,
  theme: 'dark',
  language: 'en',
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

function load(): Settings {
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem('blindtest_settings');
    if (!raw) return defaults;
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return defaults;
  }
}

function save(settings: Settings) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('blindtest_settings', JSON.stringify(settings));
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaults);

  useEffect(() => {
    setSettings(load());
  }, []);

  useEffect(() => {
    save(settings);
  }, [settings]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', settings.reducedMotion);
  }, [settings.reducedMotion]);

  const updateSettings = (partial: Partial<Settings>) => {
    setSettings(prev => ({ ...prev, ...partial }));
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
