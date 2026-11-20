// Applies migrations/*.sql in filename order, once each.
// Applied migrations are recorded in public.schema_migrations.
//
//   npm run migrate            apply pending migrations to the database in .env
//   npm run migrate -- --list  show which migrations are applied / pending
require('dotenv').config({ quiet: true });

const fs = require('node:fs');
const path = require('node:path');
const { pool } = require('../src/config/db');

const migrationsDir = path.resolve(__dirname, '../migrations');

async function main() {
  const listOnly = process.argv.includes('--list');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  const { rows } = await pool.query('SELECT filename FROM public.schema_migrations');
  const applied = new Set(rows.map((r) => r.filename));

  console.log(`Database: ${process.env.DB_NAME}`);

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`  applied  ${file}`);
      continue;
    }

    if (listOnly) {
      console.log(`  pending  ${file}`);
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO public.schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`  APPLIED  ${file}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`${file} failed: ${error.message}`);
    } finally {
      client.release();
    }
  }
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
