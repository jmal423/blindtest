'use client';

export function isDebugMode(): boolean {
  if (typeof window === 'undefined') return false;
  if (localStorage.getItem('blindtest_debug') !== 'true') return false;

  try {
    const token = localStorage.getItem('blindtest_token');
    if (!token) return false;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.role === 'admin';
  } catch {
    return false;
  }
}

export function setDebugMode(v: boolean) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('blindtest_debug', v ? 'true' : 'false');
  window.dispatchEvent(new CustomEvent('debug-toggle'));
}

