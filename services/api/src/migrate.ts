import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type pg from 'pg';
import { loadConfig } from './config.js';
import { createPool } from './db.js';

const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations/', import.meta.url));

/** Applies migrations/*.sql in filename order, once each. */
export async function migrate(pool: pg.Pool, dir: string = MIGRATIONS_DIR): Promise<string[]> {
  await pool.query('create table if not exists schema_migrations (name text primary key)');
  const done = new Set((await pool.query('select name from schema_migrations')).rows.map((r) => r.name));
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  const applied: string[] = [];
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = await readFile(`${dir}${file}`, 'utf8');
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(sql);
      await client.query('insert into schema_migrations (name) values ($1)', [file]);
      await client.query('commit');
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
    applied.push(file);
  }
  return applied;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pool = createPool(loadConfig().databaseUrl);
  migrate(pool)
    .then((applied) => console.log(applied.length ? `applied: ${applied.join(', ')}` : 'up to date'))
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
