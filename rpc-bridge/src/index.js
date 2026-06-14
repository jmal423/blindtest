import 'dotenv/config';
import RPC from 'discord-rpc';

const clientId = process.env.DISCORD_CLIENT_ID;
const apiUrl = process.env.BLINDTEST_API_URL || 'http://localhost:3001';
const token = process.env.BLINDTEST_TOKEN;
const pollInterval = parseInt(process.env.POLL_INTERVAL_MS || '5000', 10);

if (!clientId) {
  console.error('DISCORD_CLIENT_ID is required. Set it in .env');
  process.exit(1);
}

if (!token) {
  console.error('BLINDTEST_TOKEN is required. Run `node src/login.js` to get one.');
  process.exit(1);
}

const startTime = Date.now();
let rpc;
let connected = false;
let lastActivity = null;

async function fetchCurrentRoom() {
  try {
    const res = await fetch(`${apiUrl}/api/users/me/current-room`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      if (res.status === 401) {
        console.error('[Bridge] Token expired. Get a new one with `node src/login.js`');
        process.exit(1);
      }
      return null;
    }
    const data = await res.json();
    return data.room;
  } catch (err) {
    console.error('[Bridge] Failed to fetch room:', err.message);
    return null;
  }
}

function buildActivity(room) {
  if (!room) {
    return {
      details: 'Idle',
      state: 'Browsing',
      startTimestamp: startTime,
      largeImageKey: 'blindtest_logo',
      largeImageText: 'BlindTest',
      instance: false,
    };
  }

  const stateLabels = {
    waiting: 'In Lobby',
    round_preparing: 'Get Ready...',
    playing: 'Playing',
    round_result: 'Round Over',
    game_over: 'Game Over',
  };

  const label = stateLabels[room.state] || room.state;
  const playerInfo = `${room.playerCount} player${room.playerCount !== 1 ? 's' : ''}`;
  const roundInfo = room.state === 'game_over'
    ? `Final score: ${room.playerScore}`
    : room.state === 'playing'
      ? `Round ${room.currentRound}/${room.totalRounds}`
      : room.state === 'waiting'
        ? `Room: ${room.code}`
        : `Room: ${room.code} | Round ${room.currentRound}/${room.totalRounds}`;

  return {
    details: `${label} — ${playerInfo}`,
    state: roundInfo,
    startTimestamp: startTime,
    largeImageKey: 'blindtest_logo',
    largeImageText: 'BlindTest',
    smallImageKey: room.state === 'playing' ? 'playing' : room.state === 'game_over' ? 'game_over' : 'waiting',
    smallImageText: label,
    partySize: room.playerCount,
    partyMax: Math.max(room.playerCount, 10),
    instance: true,
  };
}

function activityChanged(a, b) {
  if (!a || !b) return true;
  return a.details !== b.details
    || a.state !== b.state
    || a.partySize !== b.partySize
    || a.smallImageKey !== b.smallImageKey;
}

async function poll() {
  const room = await fetchCurrentRoom();
  const activity = buildActivity(room);

  if (activityChanged(lastActivity, activity) && connected) {
    try {
      await rpc.setActivity(activity);
      lastActivity = activity;
      const label = room ? `${room.code} — ${room.state} (${room.playerCount} players)` : 'Idle';
      console.log(`[Bridge] Presence updated: ${label}`);
    } catch (err) {
      console.error('[Bridge] Failed to set activity:', err.message);
    }
  }
}

async function main() {
  console.log('[Bridge] BlindTest Discord Rich Presence Bridge');
  console.log(`[Bridge] API: ${apiUrl}`);
  console.log(`[Bridge] Poll interval: ${pollInterval}ms`);

  rpc = new RPC.Client({ transport: 'ipc' });

  rpc.on('ready', () => {
    connected = true;
    console.log('[Bridge] Connected to Discord!');
    poll();
  });

  rpc.on('disconnected', () => {
    connected = false;
    console.log('[Bridge] Disconnected from Discord. Reconnecting in 10s...');
    setTimeout(connect, 10000);
  });

  async function connect() {
    try {
      await rpc.connect(clientId);
    } catch (err) {
      console.error('[Bridge] Failed to connect to Discord:', err.message);
      console.log('[Bridge] Is Discord running? Retrying in 15s...');
      setTimeout(connect, 15000);
    }
  }

  await connect();
  setInterval(poll, pollInterval);
}

main().catch(err => {
  console.error('[Bridge] Fatal error:', err);
  process.exit(1);
});
