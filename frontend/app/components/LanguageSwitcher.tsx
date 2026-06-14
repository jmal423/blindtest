'use client';

import { useTranslation } from '@/lib/useTranslation';

const LABELS: Record<string, string> = {
  en: 'EN',
  fr: 'FR',
  pt: 'PT',
  es: 'ES',
};

const FLAG_COLORS: Record<string, string> = {
  en: 'from-blue-700 via-white to-red-600',
  fr: 'from-blue-700 via-white to-red-600',
  pt: 'from-green-700 via-red-600 to-red-600',
  es: 'from-red-600 via-yellow-400 to-red-600',
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
          className={`text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg transition-all border ${
            language === lang
              ? 'bg-foreground/10 border-foreground/20 text-foreground'
              : 'border-transparent text-foreground/40 hover:text-foreground/70 hover:border-white/5'
          }`}
          title={lang.toUpperCase()}
        >
          {LABELS[lang]}
        </button>
      ))}
    </div>
  );
}
