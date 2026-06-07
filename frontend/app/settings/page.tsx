'use client';

import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/useTranslation';

export default function SettingsPage() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
      <h1 className="text-2xl font-bold">{t('settings_page_title')}</h1>
      <p className="text-zinc-400 text-sm">{t('discord_account_note')}</p>
      <button onClick={() => router.push('/')} className="px-6 py-3 bg-[var(--primary)] text-white rounded-xl">
        {t('back_home')}
      </button>
    </div>
  );
}
