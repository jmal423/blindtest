import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { pool, rawPool } from './connection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function runMigrations() {
  const migrationsDir = path.join(__dirname, '..', 'migrations');

  async function migratePool(targetPool, label) {
    await targetPool.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    const { rows: appliedRows } = await targetPool.query('SELECT name FROM _migrations ORDER BY name');
    const applied = new Set(appliedRows.map(r => r.name));

    if (!fs.existsSync(migrationsDir)) {
      console.warn(`[DB] Migrations directory not found at ${migrationsDir}`);
      return;
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.js'))
      .sort();

    for (const file of files) {
      const mod = await import(`../migrations/${file}`);
      const migration = mod.default;

      if (applied.has(migration.name)) {
        continue;
      }

      console.log(`[DB] [${label}] Running migration: ${migration.name}`);

      const stmts = migration.up.split(';').map(s => s.trim()).filter(Boolean);
      for (const stmt of stmts) {
        await targetPool.query(stmt);
      }

      await targetPool.query('INSERT INTO _migrations (name) VALUES ($1)', [migration.name]);
      console.log(`[DB] [${label}] Migration ${migration.name} applied`);
    }
  }

  await migratePool(pool, 'Main');
  if (rawPool) {
    await migratePool(rawPool, 'Raw');
  }
}
