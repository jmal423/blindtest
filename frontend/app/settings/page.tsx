'use client';

import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const router = useRouter();

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="text-zinc-400 text-sm">Account settings are managed through Discord.</p>
      <button onClick={() => router.push('/')} className="px-6 py-3 bg-[var(--primary)] text-white rounded-xl">
        Back Home
      </button>
    </div>
  );
}
