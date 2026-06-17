const TOKEN = process.argv[2];
const API = 'https://discord.com/api/v10';
const GUILD_ID = '1516023623016775690';

async function main() {
  const me = await fetch(API + '/users/@me', { headers: { Authorization: 'Bot ' + TOKEN } }).then(r => r.json());
  const roles = await fetch(API + '/guilds/' + GUILD_ID + '/roles', { headers: { Authorization: 'Bot ' + TOKEN } }).then(r => r.json());
  const channels = await fetch(API + '/guilds/' + GUILD_ID + '/channels', { headers: { Authorization: 'Bot ' + TOKEN } }).then(r => r.json());

  const modRole = roles.find(r => r.name.includes('Moderator'));
  const adminRole = roles.find(r => r.name.includes('Owner'));

  // Assign bot the moderator role
  if (modRole) {
    await fetch(API + '/guilds/' + GUILD_ID + '/members/' + me.id + '/roles/' + modRole.id, { method: 'PUT', headers: { Authorization: 'Bot ' + TOKEN } });
    console.log('Bot assigned Moderator role');

    // Give mod role proper permissions
    const perms = (2n | 4n | 1099511627776n | 8192n | 16n | 65536n | 268435456n).toString();
    await fetch(API + '/guilds/' + GUILD_ID + '/roles/' + modRole.id, {
      method: 'PATCH',
      headers: { Authorization: 'Bot ' + TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ permissions: perms })
    });
    console.log('Moderator role permissions updated');

    // Give mod role access to STAFF category
    const staffCat = channels.find(c => c.name.includes('STAFF') && c.type === 4);
    if (staffCat && adminRole) {
      await fetch(API + '/channels/' + staffCat.id + '/permissions/' + modRole.id, {
        method: 'PUT',
        headers: { Authorization: 'Bot ' + TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 0, allow: String(1024 | 2048) })
      });
      console.log('Moderator role can access STAFF category');
    }
  }

  // Post rules
  const rulesCh = channels.find(c => c.name === 'rules');
  if (rulesCh) {
    const msgs = await fetch(API + '/channels/' + rulesCh.id + '/messages?limit=5', { headers: { Authorization: 'Bot ' + TOKEN } }).then(r => r.json());
    for (const m of msgs) {
      if (m.author?.id === me.id) {
        await fetch(API + '/channels/' + rulesCh.id + '/messages/' + m.id, { method: 'DELETE', headers: { Authorization: 'Bot ' + TOKEN } });
      }
    }

    await fetch(API + '/channels/' + rulesCh.id + '/messages', {
      method: 'POST',
      headers: { Authorization: 'Bot ' + TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [{
        title: '📜 BlindTest Server Rules',
        color: 0x6c5ce7,
        fields: [
          { name: '1. Be Respectful', value: 'Treat everyone with respect. Harassment, hate speech, discrimination, or personal attacks will not be tolerated.' },
          { name: '2. No Cheating', value: 'Using external tools like Shazam or SoundHound during BlindTest rounds is not allowed. Fair play only.' },
          { name: '3. No Spam', value: "Don't spam messages, reactions, mentions, or voice join/leave. Keep channels on-topic." },
          { name: '4. No NSFW Content', value: 'No explicit, violent, or inappropriate content in any channel or in DMs via the bot.' },
          { name: '5. Listen to Moderators', value: 'Moderators have the final say. If you disagree, contact the Owner.' },
          { name: '6. No Exploits', value: "Don't abuse bugs or glitches in BlindTest. Report them in #feedback." },
          { name: '7. Have Fun!', value: "This is a music guessing game — enjoy it, make friends, and don't take it too seriously!" },
        ],
        footer: { text: 'BlindTest Server — Violations may result in warnings, kicks, or bans.' },
      }]})
    });
    console.log('Rules posted in #rules');
  }
}

main().catch(e => console.error('Error:', e.message));
