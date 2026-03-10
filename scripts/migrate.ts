import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, '..', 'server', 'src', 'db', 'migrations');

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://rezervacije:rezervacije_dev@localhost:5432/rezervacije',
});

async function ensureMigrationsTable(client: pg.PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getAppliedMigrations(client: pg.PoolClient): Promise<string[]> {
  const result = await client.query('SELECT name FROM migrations ORDER BY name');
  return result.rows.map((r) => r.name);
}

async function migrateUp() {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const applied = await getAppliedMigrations(client);

    const files = fs.readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (applied.includes(file)) {
        console.log(`  Skipping ${file} (already applied)`);
        continue;
      }
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      console.log(`  Applying ${file}...`);
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`  ✓ ${file} applied`);
    }
    console.log('Migrations complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

async function migrateDown() {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const applied = await getAppliedMigrations(client);

    if (applied.length === 0) {
      console.log('No migrations to roll back.');
      return;
    }

    const lastMigration = applied[applied.length - 1];
    const downFile = path.join(migrationsDir, 'down', lastMigration);

    if (!fs.existsSync(downFile)) {
      console.error(`No down migration found: ${downFile}`);
      process.exit(1);
    }

    const sql = fs.readFileSync(downFile, 'utf-8');
    console.log(`  Rolling back ${lastMigration}...`);
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('DELETE FROM migrations WHERE name = $1', [lastMigration]);
    await client.query('COMMIT');
    console.log(`  ✓ ${lastMigration} rolled back`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Rollback failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

const direction = process.argv[2];
if (direction === 'down') {
  migrateDown();
} else {
  migrateUp();
}
