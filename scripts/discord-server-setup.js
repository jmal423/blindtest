/**
 * BlindTest — Discord Server Setup Script
 *
 * Run once to scaffold the Discord server with channels, roles, and a webhook.
 *
 * Usage:
 *   node scripts/discord-server-setup.js <BOT_TOKEN> <GUILD_ID>
 *
 * You need a Discord Bot Token from https://discord.com/developers/applications
 * The bot needs "Manage Channels", "Manage Roles", "Manage Webhooks" permissions.
 *
 * Invite the bot with:
 *   https://discord.com/api/oauth2/authorize?client_id=<CLIENT_ID>&permissions=268446726&scope=bot
 */

const TOKEN = process.argv[2];
const GUILD_ID = process.argv[3];

if (!TOKEN || !GUILD_ID) {
  console.error('Usage: node scripts/discord-server-setup.js <BOT_TOKEN> <GUILD_ID>');
  process.exit(1);
}

const API = 'https://discord.com/api/v10';

async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bot ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  return res.status === 204 ? null : res.json();
}

function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ────────────────────────────────────────
//  Layout
// ────────────────────────────────────────

const CATEGORIES = [
  {
    name: '📢 INFORMATION',
    channels: [
      { name: 'welcome', type: 0, topic: 'Welcome to BlindTest! 🎵\n\nJoin a voice channel and launch BlindTest to start playing.\n\n**Quick Links:**\n• Play: https://blindtest.jl423.xyz\n• Leaderboard: /leaderboard' },
      { name: 'rules', type: 0, topic: '1. Be respectful\n2. No cheating (external tools during rounds)\n3. Have fun! 🎵' },
      { name: 'announcements', type: 0, topic: 'Game updates, new features, and important notices.' },
    ],
  },
  {
    name: '🎮 GAMEPLAY',
    channels: [
      { name: 'Create Voice', type: 2 },
      { name: 'game-results', type: 0, topic: 'Recent game results are posted here automatically.' },
      { name: 'looking-to-play', type: 0, topic: 'Ping @here when you want to find players for a game.' },
      { name: 'suggest-songs', type: 0, topic: 'Suggest songs to add to the game library!' },
    ],
  },
  {
    name: '🏆 COMMUNITY',
    channels: [
      { name: 'general', type: 0, topic: 'Chat about music, games, and anything else.' },
      { name: 'scores-brag', type: 0, topic: 'Post your best scores and achievements!' },
      { name: 'feedback', type: 0, topic: 'Suggestions, bug reports, and feature requests.' },
    ],
  },
];

const ROLES = [
  { name: '🎵 Player', color: 0x6c5ce7, hoist: false, mentionable: false },
  { name: '🏆 VIP', color: 0xf59e0b, hoist: true, mentionable: false },
  { name: '🛠 Moderator', color: 0xef4444, hoist: true, mentionable: true, permissions: '268446726' },
];

// ────────────────────────────────────────
//  Run
// ────────────────────────────────────────

async function setup() {
  console.log(`\n🔧 Setting up guild ${GUILD_ID}...\n`);

  // 1. Create roles
  const createdRoles = [];
  for (const role of ROLES) {
    console.log(`  Creating role "${role.name}"...`);
    const r = await api('POST', `/guilds/${GUILD_ID}/roles`, role);
    createdRoles.push(r);
    console.log(`    ✓ ${r.id}`);
    await wait(500);
  }

  // 2. Create categories + channels
  for (const cat of CATEGORIES) {
    console.log(`\n  Creating category "${cat.name}"...`);
    const category = await api('POST', `/guilds/${GUILD_ID}/channels`, {
      name: cat.name,
      type: 4,
    });
    console.log(`    ✓ ${category.id}`);
    await wait(500);

    for (const ch of cat.channels) {
      console.log(`    Creating channel "#${ch.name}"...`);
      const channel = await api('POST', `/guilds/${GUILD_ID}/channels`, {
        name: ch.name,
        type: ch.type,
        parent_id: category.id,
        topic: ch.topic,
      });
      console.log(`      ✓ ${channel.id}`);
      await wait(500);
    }
  }

  // 3. Create webhook in game-results
  console.log(`\n  Creating webhook in #game-results...`);
  try {
    const resultsChannel = await api('GET', `/guilds/${GUILD_ID}/channels`);
    const target = resultsChannel.find(c => c.name === 'game-results' && c.type === 0);
    if (target) {
      const webhook = await api('POST', `/channels/${target.id}/webhooks`, {
        name: 'BlindTest Results',
      });
      console.log(`    ✓ Webhook URL: https://discord.com/api/webhooks/${webhook.id}/${webhook.token}`);
      console.log(`\n  📋 Add this to your backend .env:\n`);
      console.log(`    GAME_WEBHOOK_URL=https://discord.com/api/webhooks/${webhook.id}/${webhook.token}\n`);
    } else {
      console.log(`    ⚠ #game-results not found, skipping webhook creation`);
    }
  } catch (e) {
    console.log(`    ⚠ Could not create webhook: ${e.message}`);
  }

  console.log(`\n✅ Server setup complete!\n`);
  console.log(`Next steps:`);
  console.log(`  1. Add the webhook URL to your backend .env`);
  console.log(`  2. Restart the backend: sudo systemctl restart blindtest-backend.service`);
  console.log(`  3. Set up Discord Activity in your server:`);
  console.log(`     Server Settings → App Directory → BlindTest → Add to Server`);
  console.log(`  4. Create an invite link and share it!\n`);
}

setup().catch(err => {
  console.error('\n❌ Setup failed:', err.message);
  process.exit(1);
});
