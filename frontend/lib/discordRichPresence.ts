'use client';

import type { GameState } from '@/lib/api';

type DiscordSDK = any;

interface ActivityPayload {
  type: number;
  state?: string;
  details?: string;
  timestamps?: { start?: number; end?: number };
  assets?: { large_image?: string; large_text?: string };
  party?: { size: [number, number]; id?: string };
  instance?: boolean;
}

export function updateRichPresence(sdk: DiscordSDK | null, gameState: GameState | null, playerId?: string) {
  if (!sdk || !gameState) return;

  const payload: ActivityPayload = {
    type: 2,
    instance: true,
    assets: {
      large_image: 'blindtest_logo',
      large_text: 'BlindTest',
    },
  };

  const partySize = gameState.players?.length ?? 0;
  payload.party = {
    size: [partySize, 8],
  };

  const players = gameState.players ?? [];

  switch (gameState.state) {
    case 'waiting':
      payload.state = 'In Lobby';
      payload.details = partySize > 0 ? `${partySize} player${partySize !== 1 ? 's' : ''} ready` : 'Waiting for players';
      break;
    case 'round_preparing':
      payload.state = `Round ${gameState.currentRound}/${gameState.totalRounds}`;
      payload.details = 'Getting ready...';
      break;
    case 'playing':
      payload.state = `Round ${gameState.currentRound}/${gameState.totalRounds}`;
      payload.details = getGenreSummary(gameState);
      payload.timestamps = { start: Date.now() };
      break;
    case 'round_result':
      payload.state = `Round ${gameState.currentRound}/${gameState.totalRounds}`;
      payload.details = 'Viewing results';
      break;
    case 'game_over':
      payload.state = 'Game Over';
      if (playerId) {
        const me = players.find(p => p.id === playerId);
        payload.details = me ? `Score: ${me.score} pts` : 'Final results';
      } else {
        payload.details = 'Final results';
      }
      break;
  }

  try {
    sdk.commands.setActivity(payload);
  } catch {
    // Rich Presence is non-critical
  }
}

export function clearRichPresence(sdk: DiscordSDK | null) {
  if (!sdk) return;
  try {
    sdk.commands.setActivity({});
  } catch {
    // Rich Presence is non-critical
  }
}

function getGenreSummary(gameState: GameState): string {
  const genres = (gameState as any).genres;
  if (genres && Array.isArray(genres) && genres.length > 0) {
    const shown = genres.slice(0, 2).join(', ');
    return genres.length > 2 ? `${shown} +${genres.length - 2}` : shown;
  }
  return 'Playing...';
}
