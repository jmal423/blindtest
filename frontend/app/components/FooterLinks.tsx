'use client';

import Link from 'next/link';
import { useTranslation } from '@/lib/useTranslation';

export default function FooterLinks() {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-center gap-4">
      <Link href="/terms" className="hover:text-foreground/60 transition-colors">
        {t('terms_of_service')}
      </Link>
      <Link href="/privacy" className="hover:text-foreground/60 transition-colors">
        {t('privacy_policy')}
      </Link>
    </div>
  );
}
