'use client';

import { API_URL } from './api';

let _sdk: any = null;
let _identity: any = null;
let _error: string | null = null;

export function isDiscordActivity(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.parent !== window && window.location !== window.parent.location;
  } catch {
    return true;
  }
}

export function getDiscordIdentity() {
  return _identity;
}

export function getDiscordSdkError() {
  return _error;
}

export async function initDiscordSdk(): Promise<boolean> {
  if (_sdk) return true;
  if (!isDiscordActivity()) return false;

  try {
    const { DiscordSDK } = await import('@discord/embedded-app-sdk');
    const sdk = new DiscordSDK(process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || '');
    await sdk.ready();
    _sdk = sdk;
    return true;
  } catch (e) {
    _error = e instanceof Error ? e.message : 'SDK init failed';
    return false;
  }
}

export async function authenticateDiscordActivity(): Promise<{ token: string; user: any } | null> {
  if (!_sdk) {
    const ok = await initDiscordSdk();
    if (!ok) return null;
  }

  try {
    const auth = await _sdk.commands.authenticate({ access_token: true });
    _identity = auth;

    const res = await fetch(`${API_URL}/api/auth/discord/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken: auth.access_token }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Token exchange failed');
    }

    return await res.json();
  } catch (e) {
    _error = e instanceof Error ? e.message : 'Auth failed';
    return null;
  }
}
