'use client';

import { useTranslation } from '@/lib/useTranslation';

const FLAGS: Record<string, string> = {
  en: '🇬🇧',
  fr: '🇫🇷',
  pt: '🇵🇹',
  es: '🇪🇸',
};

export default function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { language, setLanguage } = useTranslation();
  const langs = ['en', 'fr', 'pt', 'es'] as const;

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {langs.map(lang => (
        <button
          key={lang}
          onClick={() => setLanguage(lang)}
          className={`text-lg px-1 py-0.5 rounded transition-all ${
            language === lang
              ? 'scale-110 brightness-125'
              : 'opacity-40 hover:opacity-70 grayscale'
          }`}
          title={lang.toUpperCase()}
        >
          {FLAGS[lang]}
        </button>
      ))}
    </div>
  );
}
