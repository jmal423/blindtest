'use client';

export function isDebugMode(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('blindtest_debug') === 'true';
}

export function setDebugMode(v: boolean) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('blindtest_debug', v ? 'true' : 'false');
}
