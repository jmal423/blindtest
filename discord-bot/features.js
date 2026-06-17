import { EmbedBuilder, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } from '@discordjs/voice';
import play from 'play-dl';

// ── Music Queue ──
export const queues = new Map();

function createPlayer(guildId) {
  const player = createAudioPlayer();
  player.on(AudioPlayerStatus.Idle, () => {
    const q = queues.get(guildId);
    if (!q) return;
    q.songs.shift();
    if (q.songs.length > 0) playNextMusic(guildId);
    else {
      q.connection?.destroy();
      queues.delete(guildId);
      q.textChannel?.send('🎵 Queue finished! Use `/play` to add more songs.').catch(() => {});
    }
  });
  player.on('error', () => {
    const q = queues.get(guildId);
    if (q) { q.songs.shift(); if (q.songs.length > 0) playNextMusic(guildId); }
  });
  return player;
}

export async function playNextMusic(guildId) {
  const q = queues.get(guildId);
  if (!q || q.songs.length === 0) return;
  const song = q.songs[0];
  try {
    const stream = await play.stream(song.url);
    const resource = createAudioResource(stream.stream, { inputType: stream.type });
    q.player.play(resource);
    q.textChannel?.send(`🎵 Now playing: **${song.title}**`).catch(() => {});
  } catch {
    q.songs.shift();
    q.textChannel?.send(`❌ Could not play **${song.title}**. Skipping.`).catch(() => {});
    if (q.songs.length > 0) playNextMusic(guildId);
  }
}

export async function handlePlay(interaction, pool) {
  await interaction.deferReply();
  const member = interaction.member;
  if (!member) return interaction.editReply('❌ Use this in a server.');
  const vc = member.voice.channel;
  if (!vc) return interaction.editReply('❌ You must be in a voice channel.');

  const query = interaction.options.getString('query');
  let url = query;
  if (!query.startsWith('http')) {
    const results = await play.search(query, { limit: 1 });
    if (results.length === 0) return interaction.editReply('❌ No results found.');
    url = results[0].url;
  }

  const info = await play.video_info(url);
  const title = info.video_details?.title || query;

  let q = queues.get(interaction.guildId);
  if (!q) {
    const connection = joinVoiceChannel({ channelId: vc.id, guildId: vc.guild.id, adapterCreator: vc.guild.voiceAdapterCreator });
    const player = createPlayer(interaction.guildId);
    connection.subscribe(player);
    q = { songs: [], player, connection, textChannel: interaction.channel, voiceChannel: vc };
    queues.set(interaction.guildId, q);
  }

  q.songs.push({ url, title });
  if (q.songs.length === 1) playNextMusic(interaction.guildId);
  await interaction.editReply(`✅ Added **${title}** to the queue.`);
}

export async function handleSkip(interaction) {
  const q = queues.get(interaction.guildId);
  if (!q || q.songs.length === 0) return interaction.reply({ content: '❌ Nothing is playing.', ephemeral: true });
  q.player.stop();
  await interaction.reply({ content: '⏭ Skipped!', ephemeral: true });
}

export async function handleStop(interaction) {
  const q = queues.get(interaction.guildId);
  if (!q) return interaction.reply({ content: '❌ Nothing is playing.', ephemeral: true });
  q.songs = [];
  q.player.stop();
  q.connection?.destroy();
  queues.delete(interaction.guildId);
  await interaction.reply({ content: '⏹ Stopped and left the voice channel.', ephemeral: true });
}

export async function handleQueue(interaction) {
  const q = queues.get(interaction.guildId);
  if (!q || q.songs.length === 0) return interaction.reply({ content: '❌ Queue is empty.', ephemeral: true });
  const list = q.songs.map((s, i) => `${i === 0 ? '▶' : i + 1}. **${s.title}**`).join('\n');
  const embed = new EmbedBuilder().setTitle('🎵 Music Queue').setColor(0x6c5ce7).setDescription(list);
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

// ── Poll ──
export async function handlePoll(interaction) {
  const question = interaction.options.getString('question');
  const options = [1, 2, 3, 4].map(i => interaction.options.getString(`option${i}`)).filter(Boolean);
  const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];

  const desc = options.map((opt, i) => `${emojis[i]} ${opt}`).join('\n');
  const embed = new EmbedBuilder()
    .setTitle(`📊 ${question}`)
    .setColor(0x6c5ce7)
    .setDescription(desc)
    .setFooter({ text: `Poll by ${interaction.user.displayName}` })
    .setTimestamp();

  const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
  for (let i = 0; i < options.length; i++) await msg.react(emojis[i]);
}

// ── Server Info ──
export async function handleServerInfo(interaction, pool) {
  await interaction.deferReply();
  const guild = interaction.guild;
  if (!guild) return;

  const totalMembers = guild.memberCount;
  const bots = guild.members.cache.filter(m => m.user.bot).size;
  const humans = totalMembers - bots;

  let gamesToday = 0;
  try {
    const { rows } = await pool.query(
      'SELECT COUNT(*) as c FROM games WHERE created_at >= NOW() - INTERVAL \'24 hours\''
    );
    gamesToday = parseInt(rows[0]?.c) || 0;
  } catch {}

  const embed = new EmbedBuilder()
    .setTitle(`📊 ${guild.name}`)
    .setColor(0x6c5ce7)
    .setThumbnail(guild.iconURL())
    .addFields(
      { name: 'Members', value: `👤 ${humans} humans\n🤖 ${bots} bots\n📦 **${totalMembers}** total`, inline: true },
      { name: 'Games Today', value: String(gamesToday), inline: true },
      { name: 'Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

// ── Birthday ──
export async function handleSetBirthday(interaction, pool) {
  const dateStr = interaction.options.getString('date');
  const match = dateStr.match(/^(\d{1,2})-(\d{1,2})$/);
  if (!match) return interaction.reply({ content: '❌ Invalid format. Use DD-MM (e.g. 25-12).', ephemeral: true });
  const day = match[1].padStart(2, '0');
  const month = match[2].padStart(2, '0');
  const birthday = `${month}-${day}`;

  try {
    await pool.query(
      'UPDATE users SET birthday = $1 WHERE discord_id = $2',
      [birthday, interaction.user.id]
    );
    await interaction.reply({ content: `🎂 Birthday set to **${day}-${month}**! I'll wish you happy birthday 🎉`, ephemeral: true });
  } catch {
    await interaction.reply({ content: '❌ Failed to save birthday.', ephemeral: true });
  }
}

export async function checkBirthdays(client, pool) {
  const today = new Date();
  const monthDay = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const guild = client.guilds.cache.get(process.env.GUILD_ID);
  if (!guild) return;

  try {
    const { rows } = await pool.query(
      'SELECT discord_id, username FROM users WHERE birthday = $1',
      [monthDay]
    );
    const role = guild.roles.cache.find(r => r.name.includes('🎂'));
    if (!role) {
      // Create birthday role if it doesn't exist
      const newRole = await guild.roles.create({ name: '🎂 Birthday', color: 0xff69b4, hoist: false });
      rows.forEach(r => {
        const member = guild.members.cache.get(r.discord_id);
        if (member) member.roles.add(newRole).catch(() => {});
      });
    } else {
      // Remove from everyone first, then add to today's birthdays
      guild.members.cache.forEach(m => { if (m.roles.cache.has(role.id)) m.roles.remove(role).catch(() => {}); });
      rows.forEach(r => {
        const member = guild.members.cache.get(r.discord_id);
        if (member) member.roles.add(role).catch(() => {});
      });
    }

    if (rows.length > 0) {
      const names = rows.map(r => r.username).join(', ');
      const channel = guild.channels.cache.find(c => c.name === 'general');
      if (channel) channel.send(`🎂 **Happy Birthday to ${names}!** 🎉🎈`).catch(() => {});
    }
  } catch (e) { console.error('Birthday check failed:', e.message); }
}

// ── Custom Commands ──
export async function handleCustomCommand(interaction, pool) {
  await interaction.deferReply({ ephemeral: true });
  const action = interaction.options.getString('action');
  const trigger = interaction.options.getString('trigger');
  const response = interaction.options.getString('response');

  if (action === 'list') {
    const { rows } = await pool.query('SELECT trigger, response FROM custom_commands ORDER BY trigger');
    if (rows.length === 0) return interaction.editReply('No custom commands yet.');
    const desc = rows.map(r => `**\`/${r.trigger}\`** → ${r.response}`).join('\n');
    const embed = new EmbedBuilder().setTitle('📝 Custom Commands').setColor(0x6c5ce7).setDescription(desc);
    return interaction.editReply({ embeds: [embed] });
  }

  if (!trigger) return interaction.editReply('❌ Trigger is required.');

  if (action === 'create') {
    if (!response) return interaction.editReply('❌ Response is required.');
    await pool.query(
      'INSERT INTO custom_commands (trigger, response) VALUES ($1, $2) ON CONFLICT (trigger) DO UPDATE SET response = $2',
      [trigger.toLowerCase(), response]
    );
    return interaction.editReply(`✅ Command **/${trigger}** created!`);
  }

  if (action === 'delete') {
    await pool.query('DELETE FROM custom_commands WHERE trigger = $1', [trigger.toLowerCase()]);
    return interaction.editReply(`🗑 Deleted **/${trigger}**.`);
  }
}

// ── Weekly Leaderboard ──
export async function checkWeeklyLeaderboard(client, pool) {
  const guild = client.guilds.cache.get(process.env.GUILD_ID);
  if (!guild) return;
  const channel = guild.channels.cache.find(c => c.name === 'game-results' || c.name === 'announcements');
  if (!channel) return;

  try {
    const { rows } = await pool.query(`
      SELECT u.username, u.discord_id,
        COALESCE(SUM(gp.score), 0) as weekly_score,
        COUNT(gp.*) as games
      FROM game_players gp
      JOIN users u ON u.id = gp.player_id
      WHERE gp.created_at >= NOW() - INTERVAL '7 days'
      GROUP BY u.username, u.discord_id
      ORDER BY weekly_score DESC
      LIMIT 5
    `);

    if (rows.length === 0) return;

    const medals = ['🥇', '🥈', '🥉'];
    const desc = rows.map((r, i) =>
      `${medals[i] || `#${i + 1}`} **${r.username}** — ${r.weekly_score} pts (${r.games} games)`
    ).join('\n');

    const embed = new EmbedBuilder()
      .setTitle('🏆 Weekly Leaderboard')
      .setColor(0xf59e0b)
      .setDescription(`Top players this week!\n\n${desc}`)
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  } catch (e) { console.error('Weekly leaderboard failed:', e.message); }
}

// ── Social Alerts (YouTube) ──
export async function checkSocialAlerts(client, pool) {
  const guild = client.guilds.cache.get(process.env.GUILD_ID);
  if (!guild) return;
  const channel = guild.channels.cache.find(c => c.name === 'announcements');
  if (!channel) return;

  try {
    const { rows: channels } = await pool.query('SELECT * FROM social_channels');
    for (const sc of channels) {
      if (sc.platform === 'youtube') {
        const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${sc.channel_id}`);
        const text = await res.text();
        const match = text.match(/<entry>.*?<yt:videoId>(.*?)<\/yt:videoId>.*?<title>(.*?)<\/title>.*?<\/entry>/s);
        if (match) {
          const videoId = match[1];
          if (videoId !== sc.last_video_id) {
            await pool.query('UPDATE social_channels SET last_video_id = $1 WHERE id = $2', [videoId, sc.id]);
            await channel.send(`🎬 **${sc.name}** uploaded: https://youtu.be/${videoId}`);
          }
        }
      }
    }
  } catch (e) { console.error('Social alert check failed:', e.message); }
}
