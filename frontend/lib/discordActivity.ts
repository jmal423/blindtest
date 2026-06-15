'use client';

import { API_URL } from './api';
import { IS_MOCK, IS_MOCK_DISCORD, MOCK_TOKEN, MOCK_USER, MOCK_DISCORD_PARTICIPANTS, MOCK_CHANNEL_NAME, MOCK_DISCORD_RELATIONSHIPS } from './mock';

let _sdk: any = null;
let _identity: any = null;
let _error: string | null = null;
let _instanceId: string | null = null;
let _channelId: string | null = null;
let _guildId: string | null = null;

// Returns true if we're inside Discord's in-app browser or embedded activity
// Used for initial detection BEFORE SDK init
export function isDiscordEmbedded(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.parent !== window;
  } catch {
    return true;
  }
}

// Returns true only after SDK is fully initialized (real Discord activity)
export function isDiscordActivity(): boolean {
  if (typeof window === 'undefined') return false;
  if (IS_MOCK_DISCORD) return true;
  return _sdk !== null;
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

export interface DiscordRelationship {
  type: number;
  user: {
    id: string;
    username: string;
    global_name?: string | null;
    avatar?: string | null;
    discriminator?: string;
    bot?: boolean;
  };
  presence?: {
    status: string;
  } | null;
}

export async function getDiscordRelationships(): Promise<DiscordRelationship[]> {
  if (IS_MOCK_DISCORD) return MOCK_DISCORD_RELATIONSHIPS as any;
  if (!_sdk) return [];
  try {
    const result = await _sdk.commands.getRelationships();
    return result?.relationships?.filter((r: any) => r.type === 1) ?? [];
  } catch {
    return [];
  }
}

export async function inviteDiscordUser(userId: string, content?: string): Promise<boolean> {
  if (IS_MOCK_DISCORD) return true;
  if (!_sdk) return false;
  try {
    await _sdk.commands.inviteUserEmbedded({ user_id: userId, content });
    return true;
  } catch {
    return false;
  }
}

export async function openDiscordInviteDialog(): Promise<boolean> {
  if (IS_MOCK_DISCORD) return true;
  if (!_sdk) return false;
  try {
    await _sdk.commands.openInviteDialog();
    return true;
  } catch {
    return false;
  }
}

export async function getConnectedParticipants(): Promise<DiscordParticipant[]> {
  if (IS_MOCK_DISCORD) return MOCK_DISCORD_PARTICIPANTS;
  if (!_sdk) return [];
  try {
    const result = await _sdk.commands.getActivityInstanceConnectedParticipants();
    return result?.participants ?? [];
  } catch {
    return [];
  }
}

let _channelType: number | null = null;

export function getChannelType(): number | null {
  return _channelType;
}

export async function isVoiceChannel(): Promise<boolean> {
  if (IS_MOCK_DISCORD) return true;
  if (_channelType !== null) return _channelType === 2;
  await getChannelInfo();
  return _channelType === 2;
}

export async function getChannelName(): Promise<string | null> {
  if (IS_MOCK_DISCORD) return MOCK_CHANNEL_NAME;
  if (!_sdk || !_channelId) return null;
  try {
    const result = await _sdk.commands.getChannel({ channel_id: _channelId });
    _channelType = result?.type ?? null;
    return result?.name ?? null;
  } catch {
    return null;
  }
}

export async function getChannelInfo(): Promise<{ name: string | null; type: number | null } | null> {
  if (!_sdk || !_channelId) return null;
  try {
    const result = await _sdk.commands.getChannel({ channel_id: _channelId });
    _channelType = result?.type ?? null;
    return { name: result?.name ?? null, type: result?.type ?? null };
  } catch {
    return null;
  }
}

export function subscribeToParticipants(callback: ParticipantUpdateCallback): () => void {
  if (!_sdk) return () => {};
  try {
    const handler = (data: any) => {
      callback(data?.participants ?? []);
    };
    _sdk.subscribe('ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE', handler);
    return () => {
      try {
        _sdk.unsubscribe('ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE', handler);
      } catch {
        // ignore unsubscribe errors
      }
    };
  } catch {
    return () => {};
  }
}

const SCOPES = ['identify', 'rpc.activities.write', 'activities.write', 'relationships.read'] as const;

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
    await sdk.ready();
    _sdk = sdk;
    _instanceId = sdk.instanceId ?? null;
    _channelId = sdk.channelId ?? null;
    _guildId = sdk.guildId ?? null;

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

    await sdk.commands.authenticate({ access_token: data.access_token });

    _sdk = sdk;
    _identity = data.user;

    return { token: data.token, user: data.user };
  } catch (e) {
    _error = e instanceof Error ? e.message : 'Auth failed';
    return null;
  }
}

export async function isDiscordMobile(): Promise<boolean> {
  if (IS_MOCK_DISCORD) return false;
  if (_sdk) return _sdk.platform === 'mobile';
  return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

export type LayoutMode = -1 | 0 | 1 | 2;

export function subscribeToLayoutMode(callback: (mode: LayoutMode) => void): () => void {
  if (IS_MOCK_DISCORD) {
    callback(0);
    return () => {};
  }
  if (!_sdk) {
    callback(-1);
    return () => {};
  }

  let unsubscribed = false;

  _sdk.subscribe('ACTIVITY_LAYOUT_MODE_UPDATE', (data: any) => {
    if (!unsubscribed) {
      callback(data.layout_mode ?? -1);
    }
  }).catch(() => {});

  return () => {
    unsubscribed = true;
  };
}
