import 'dotenv/config';
import { Client, GatewayIntentBits, REST, Routes, EmbedBuilder, ChannelType } from 'discord.js';
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN || !CLIENT_ID) {
  console.error('Missing BOT_TOKEN or CLIENT_ID in environment');
  process.exit(1);
}

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

// ────────────────────────────────────────
//  Channel layout for /setup
// ────────────────────────────────────────

const RECOMMENDED_CHANNELS = [
  {
    name: '📢 INFORMATION',
    channels: [
      { name: 'roles', type: ChannelType.GuildText, topic: 'React to get roles! 🎵' },
      { name: 'faq', type: ChannelType.GuildText, topic: 'Frequently asked questions about BlindTest.' },
    ],
  },
  {
    name: '🎮 GAMEPLAY',
    channels: [
      { name: 'matchmaking', type: ChannelType.GuildText, topic: 'Find players and schedule games here!' },
    ],
  },
  {
    name: '🏆 COMMUNITY',
    channels: [
      { name: 'off-topic', type: ChannelType.GuildText, topic: 'Chat about music, movies, memes, and anything else.' },
      { name: 'music-share', type: ChannelType.GuildText, topic: 'Share what you\'re listening to! 🎶' },
    ],
  },
  {
    name: '🛠 STAFF',
    channels: [
      { name: 'mod-chat', type: ChannelType.GuildText, topic: 'Staff discussions.' },
      { name: 'mod-logs', type: ChannelType.GuildText, topic: 'Moderation logs.' },
    ],
  },
];

// ────────────────────────────────────────
//  Slash Command Definitions
// ────────────────────────────────────────

const commands = [
  {
    name: 'leaderboard',
    description: 'Show the top players on BlindTest',
    options: [{
      name: 'top',
      description: 'Number of players to show (default 10)',
      type: 4,
      min_value: 1,
      max_value: 50,
      required: false,
    }],
  },
  {
    name: 'stats',
    description: 'Show stats for a player',
    options: [{
      name: 'user',
      description: 'Discord user (leave empty for your own stats)',
      type: 6,
      required: false,
    }],
  },
  {
    name: 'setup',
    description: 'Create recommended server channels (admin only)',
  },
  {
    name: 'help',
    description: 'Show BlindTest bot commands and info',
  },
];

// ────────────────────────────────────────
//  Register Commands
// ────────────────────────────────────────

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    if (GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
      console.log(`Registered guild commands in ${GUILD_ID}`);
    } else {
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
      console.log('Registered global commands');
    }
  } catch (e) {
    console.error('Failed to register commands:', e.message);
  }
})();

// ────────────────────────────────────────
//  Events
// ────────────────────────────────────────

// Welcome messages disabled — enable Server Members Intent in Developer Portal
// to use this feature, then add GatewayIntentBits.GuildMembers and uncomment below:
/*
client.on('guildMemberAdd', async (member) => {
  ...
});
*/

// ────────────────────────────────────────
//  Command Handlers
// ────────────────────────────────────────

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'leaderboard') {
    await interaction.deferReply();
    const top = interaction.options.getInteger('top') || 10;
    try {
      const { rows } = await pool.query(`
        SELECT username, total_score, games_played, avatar_url
        FROM users
        WHERE total_score > 0
        ORDER BY total_score DESC
        LIMIT $1
      `, [top]);

      if (rows.length === 0) {
        return interaction.editReply('No scores yet. Play a game to get on the board! 🎵');
      }

      const medals = ['🥇', '🥈', '🥉'];
      const desc = rows.map((r, i) =>
        `${medals[i] || `${i + 1}.`} **${r.username}** — ${r.total_score.toLocaleString()} pts (${r.games_played} games)`
      ).join('\n');

      const embed = new EmbedBuilder()
        .setTitle('🏆 BlindTest Leaderboard')
        .setColor(0x6c5ce7)
        .setDescription(desc)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (e) {
      console.error('Leaderboard error:', e.message);
      await interaction.editReply('Failed to fetch leaderboard. Try again later.');
    }
  }

  else if (commandName === 'stats') {
    await interaction.deferReply();
    const target = interaction.options.getUser('user') || interaction.user;
    try {
      const { rows } = await pool.query(`
        SELECT username, total_score, games_played, avg_score, best_score, wins,
               perfects, total_rounds, best_genre, average_speed_ms
        FROM users
        WHERE discord_id = $1
      `, [target.id]);

      if (rows.length === 0) {
        return interaction.editReply(
          `${target.id === interaction.user.id ? "You haven't" : "This user hasn't"} linked their Discord to BlindTest yet.\n` +
          'Play a game at https://blindtest.jl423.xyz to get started!'
        );
      }

      const s = rows[0];
      const embed = new EmbedBuilder()
        .setTitle(`${target.displayName}'s Stats`)
        .setColor(0x6c5ce7)
        .setThumbnail(target.displayAvatarURL())
        .addFields(
          { name: 'Total Score', value: s.total_score.toLocaleString(), inline: true },
          { name: 'Games Played', value: String(s.games_played), inline: true },
          { name: 'Best Score', value: s.best_score.toLocaleString(), inline: true },
          { name: 'Avg Score/Game', value: Math.round(s.avg_score || 0).toLocaleString(), inline: true },
          { name: 'Wins', value: String(s.wins || 0), inline: true },
          { name: 'Perfect Rounds', value: String(s.perfects || 0), inline: true },
          { name: 'Best Genre', value: s.best_genre ? s.best_genre.replace(/_/g, ' ') : 'N/A', inline: true },
          { name: 'Avg Answer Speed', value: s.average_speed_ms ? `${(s.average_speed_ms / 1000).toFixed(1)}s` : 'N/A', inline: true },
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (e) {
      console.error('Stats error:', e.message);
      await interaction.editReply('Failed to fetch stats. Try again later.');
    }
  }

  else if (commandName === 'setup') {
    if (!interaction.memberPermissions?.has('Administrator')) {
      return interaction.reply({ content: '❌ You need **Administrator** permission to use this command.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });
    const guild = interaction.guild;
    if (!guild) return;

    let created = 0;

    for (const cat of RECOMMENDED_CHANNELS) {
      const existingCategory = guild.channels.cache.find(
        c => c.type === ChannelType.GuildCategory && c.name === cat.name
      );

      let category;
      if (existingCategory) {
        category = existingCategory;
      } else {
        category = await guild.channels.create({
          name: cat.name,
          type: ChannelType.GuildCategory,
        });
        await wait(400);
      }

      for (const ch of cat.channels) {
        const exists = guild.channels.cache.find(
          c => c.name === ch.name && c.parentId === category.id
        );
        if (exists) continue;

        await guild.channels.create({
          name: ch.name,
          type: ch.type,
          parent: category.id,
          topic: ch.topic,
        });
        created++;
        await wait(400);
      }
    }

    await interaction.editReply(
      created > 0
        ? `✅ Created **${created}** new channel${created !== 1 ? 's' : ''}!`
        : '✅ All recommended channels already exist.'
    );
  }

  else if (commandName === 'help') {
    const embed = new EmbedBuilder()
      .setTitle('🎵 BlindTest Bot')
      .setColor(0x6c5ce7)
      .setDescription(
        'A real-time multiplayer music guessing game.\n\n' +
        '**How to Play**\n' +
        '1. Join a voice channel in this server\n' +
        '2. Click the ⚡ Activities button (bottom left of VC)\n' +
        '3. Select **BlindTest**\n' +
        '4. Pick genres and start playing!\n\n' +
        '**Commands**\n' +
        '`/leaderboard` — Top players\n' +
        '`/stats` — Your stats\n' +
        '`/stats @user` — Someone else\'s stats\n' +
        '`/setup` — Create recommended channels (admin)\n' +
        '`/help` — This menu\n\n' +
        'Play at **https://blindtest.jl423.xyz**'
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
});

// ────────────────────────────────────────
//  Login
// ────────────────────────────────────────

client.login(TOKEN);
console.log('Bot starting...');
