'use client';

import { API_URL } from './api';
import { IS_MOCK, MOCK_TOKEN, MOCK_USER } from './mock';

let _sdk: any = null;
let _identity: any = null;
let _error: string | null = null;
let _instanceId: string | null = null;
let _channelId: string | null = null;
let _guildId: string | null = null;

export function isDiscordActivity(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.parent !== window;
  } catch {
    return true;
  }
}

export function getDiscordIdentity() {
  return _identity;
}

export function getDiscordSdk() {
  return _sdk;
}

export function getDiscordSdkError() {
  return _error;
}

export function getInstanceId() {
  return _instanceId;
}

export function getChannelId() {
  return _channelId;
}

export function getGuildId() {
  return _guildId;
}

export interface DiscordParticipant {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
  discriminator?: string;
}

export type ParticipantUpdateCallback = (participants: DiscordParticipant[]) => void;

export async function getConnectedParticipants(): Promise<DiscordParticipant[]> {
  if (!_sdk) return [];
  try {
    const result = await _sdk.commands.getInstanceConnectedParticipants();
    return result?.participants ?? [];
  } catch {
    return [];
  }
}

export function subscribeToParticipants(callback: ParticipantUpdateCallback): () => void {
  if (!_sdk) return () => {};
  try {
    const handler = (data: { participants: DiscordParticipant[] }) => {
      callback(data?.participants ?? []);
    };
    _sdk.commands.subscribe('ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE', handler);
    return () => {
      try {
        _sdk.commands.unsubscribe('ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE', handler);
      } catch {
        // ignore unsubscribe errors
      }
    };
  } catch {
    return () => {};
  }
}

const SCOPES = ['identify'] as const;

export async function authenticateDiscordActivity(): Promise<{ token: string; user: any } | null> {
  if (IS_MOCK) {
    return { token: MOCK_TOKEN, user: MOCK_USER };
  }
  try {
    const { DiscordSDK } = await import('@discord/embedded-app-sdk');
    const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || '';
    if (!clientId) {
      _error = 'NEXT_PUBLIC_DISCORD_CLIENT_ID not set';
      return null;
    }

    const sdk = new DiscordSDK(clientId);
    const readyPayload: any = await sdk.ready();
    _instanceId = readyPayload?.instanceId ?? null;
    _channelId = readyPayload?.channelId ?? null;
    _guildId = readyPayload?.guildId ?? null;

    const { code } = await sdk.commands.authorize({
      client_id: clientId,
      response_type: 'code',
      state: '',
      prompt: 'none',
      scope: [...SCOPES],
    });

    const res = await fetch(`${API_URL}/api/auth/discord/activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Token exchange failed');
    }

    const data = await res.json();

    // Finalize authentication with Discord client
    await sdk.commands.authenticate({ access_token: data.access_token });

    _sdk = sdk;
    _identity = data.user;

    return { token: data.token, user: data.user };
  } catch (e) {
    _error = e instanceof Error ? e.message : 'Auth failed';
    return null;
  }
}
