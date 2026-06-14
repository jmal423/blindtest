import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const rl = createInterface({ input: stdin, output: stdout });

const apiUrl = process.env.BLINDTEST_API_URL || 'http://localhost:3001';

async function loginWithToken(token) {
  const res = await fetch(`${apiUrl}/api/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Invalid token: ${res.status}`);
  return res.json();
}

const token = await rl.question('Paste your BlindTest token (from browser localStorage -> blindtest_token): ');
const trimmed = token.trim();

try {
  const user = await loginWithToken(trimmed);
  console.log(`\nLogged in as: ${user.username}`);
  console.log(`\nAdd this to your .env file:\nBLINDTEST_TOKEN=${trimmed}\n`);
} catch (err) {
  console.error(`Login failed: ${err.message}`);
}

rl.close();
