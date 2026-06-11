import jwt from 'jsonwebtoken';
import { generateId, get, run } from './db.js';

// JWT_SECRET must remain stable across deploys so existing sessions stay valid.
// If you change JWT_SECRET, all issued tokens become invalid and users must re-login via Discord.
const JWT_SECRET = process.env.JWT_SECRET || 'blindtest-dev-secret-change-in-production';

function getRedirectUri(host) {
  if (process.env.BACKEND_URL) {
    const base = process.env.BACKEND_URL.replace(/\/$/, '');
    return `${base}/api/auth/discord/callback`;
  }
  const isLocal = host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.startsWith('192.168.') || host.startsWith('10.');
  const protocol = isLocal ? 'http' : 'https';
  return `${protocol}://${host}/api/auth/discord/callback`;
}

function getAuthUrl(host, redirectUrl) {
  const url = new URL('https://discord.com/api/oauth2/authorize');
  url.searchParams.set('client_id', process.env.DISCORD_CLIENT_ID || '');
  url.searchParams.set('redirect_uri', getRedirectUri(host));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'identify');
  if (redirectUrl) {
    url.searchParams.set('state', redirectUrl);
  }
  return url.toString();
}

async function handleDiscordCallback(code, host, state) {
  const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID || '',
      client_secret: process.env.DISCORD_CLIENT_SECRET || '',
      grant_type: 'authorization_code',
      code,
      redirect_uri: getRedirectUri(host),
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Discord token exchange failed: ${err}`);
  }

  const tokenData = await tokenRes.json();
  const userRes = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!userRes.ok) throw new Error('Failed to fetch Discord user');

  const discordUser = await userRes.json();

  // Guild gating — check user is in allowed server
  const allowedGuildId = process.env.DISCORD_ALLOWED_GUILD_ID;
  if (allowedGuildId) {
    const guildsRes = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (guildsRes.ok) {
      const guilds = await guildsRes.json();
      const member = guilds.find(g => g.id === allowedGuildId);
      if (!member) {
        throw new Error('Access denied. You must be in the private Discord server to play.');
      }
    }
  }

  let fullAvatarUrl = null;
  if (discordUser.avatar) {
    const ext = discordUser.avatar.startsWith('a_') ? 'gif' : 'png';
    fullAvatarUrl = `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.${ext}`;
  } else {
    const defaultIndex = (BigInt(discordUser.id) >> 22n) % 6n;
    fullAvatarUrl = `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
  }

  let user = await get('SELECT * FROM users WHERE discord_id = ?', [discordUser.id]);

  if (user) {
    await run('UPDATE users SET username = ?, avatar_url = ? WHERE id = ?', [discordUser.global_name || discordUser.username, fullAvatarUrl, user.id]);
  } else {
    const id = generateId();
    const adminIds = (process.env.ADMIN_DISCORD_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
    const role = adminIds.includes(discordUser.id) ? 'admin' : 'user';
    await run(
      'INSERT INTO users (id, discord_id, username, avatar_url, role) VALUES (?, ?, ?, ?, ?)',
      [id, discordUser.id, discordUser.global_name || discordUser.username, fullAvatarUrl, role]
    );
    user = await get('SELECT * FROM users WHERE id = ?', [id]);
  }

  const token = jwt.sign(
    { userId: user.id, role: user.role },
    JWT_SECRET,
    { expiresIn: '365d' }
  );

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      avatarUrl: user.avatar_url,
      role: user.role,
    },
    redirectUrl: state || null,
  };
}

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(header.slice(7), JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  authenticate(req, res, () => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  });
}

function tryDecodeToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export { getAuthUrl, handleDiscordCallback, authenticate, requireAdmin, tryDecodeToken };
