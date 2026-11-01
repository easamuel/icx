import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, withTransaction } from './index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../migrations');

export async function runMigrations(): Promise<void> {
  console.log('[ICX-DB] Starting native PostgreSQL migration runner...');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const files = (await fs.readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const { rowCount } = await pool.query(
      'SELECT 1 FROM schema_migrations WHERE version = $1',
      [file]
    );

    if (rowCount && rowCount > 0) {
      console.log(`[ICX-DB] Migration already applied: ${file}`);
      continue;
    }

    const sqlPath = path.join(MIGRATIONS_DIR, file);
    const sqlContent = await fs.readFile(sqlPath, 'utf-8');

    console.log(`[ICX-DB] Applying migration: ${file}...`);
    await withTransaction(async (client) => {
      await client.query(sqlContent);
      await client.query(
        'INSERT INTO schema_migrations (version) VALUES ($1)',
        [file]
      );
    });
    console.log(`[ICX-DB] Successfully applied: ${file}`);
  }

  console.log('[ICX-DB] All PostgreSQL migrations are up to date.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(() => pool.end())
    .catch((err) => {
      console.error('[ICX-DB] Migration failed:', err);
      process.exit(1);
    });
}

