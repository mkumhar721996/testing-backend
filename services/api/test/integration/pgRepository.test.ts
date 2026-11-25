import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPool } from '../../src/db.js';
import { migrate } from '../../src/migrate.js';
import { PgOpeningsRepository } from '../../src/openings/pgRepository.js';

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('PgOpeningsRepository', () => {
  const pool = createPool(url ?? '');
  const repo = new PgOpeningsRepository(pool);
  let managerId = '';

  beforeAll(async () => {
    await migrate(pool);
    const { rows } = await pool.query("insert into hiring_managers (name) values ('Test Manager') returning id");
    managerId = rows[0].id;
  });
  afterAll(async () => {
    await pool.query('delete from job_openings');
    await pool.query('delete from hiring_managers');
    await pool.end();
  });

  it('creates a Draft, lists it, and publishes once', async () => {
    const created = await repo.create({ title: 'Designer', hiringManagerId: managerId, vacancies: 2 });
    expect(created?.status).toBe('Draft');
    expect((await repo.list()).map((o) => o.id)).toContain(created!.id);
    expect(await repo.publish(created!.id)).toMatchObject({ status: 'Published' });
    expect(await repo.publish(created!.id)).toBe('already_published');
  });

  it('updates a Draft, locks vacancies once Published, and rejects a malformed id', async () => {
    const draft = await repo.create({ title: 'Old', hiringManagerId: managerId, vacancies: 2 });
    expect(await repo.update(draft!.id, { title: 'New', description: 'D', vacancies: 4 })).toMatchObject({
      title: 'New',
      description: 'D',
      vacancies: 4,
    });
    await repo.publish(draft!.id);
    expect(await repo.update(draft!.id, { title: 'Other', vacancies: 9 })).toBe('vacancies_locked');
    expect((await repo.list()).find((o) => o.id === draft!.id)).toMatchObject({ title: 'New', vacancies: 4 });
    expect(await repo.update('not-a-uuid', { title: 'X' })).toBe('not_found');
    expect((await repo.listPublished()).map((o) => o.id)).toContain(draft!.id);
  });

  it('keeps an opening created before migration 002 listed with an empty description', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mig-'));
    const src = fileURLToPath(new URL('../../migrations/', import.meta.url));
    const schema = `m${Date.now()}`;
    await pool.query(`create schema ${schema}`);
    const scoped = new URL(url ?? '');
    scoped.searchParams.set('options', `-c search_path=${schema}`);
    const p = createPool(scoped.toString());
    try {
      await copyFile(`${src}001_job_openings.sql`, `${dir}/001_job_openings.sql`);
      await migrate(p, `${dir}/`);
      const m = await p.query("insert into hiring_managers (name) values ('M') returning id");
      await p.query('insert into job_openings (title, hiring_manager_id, vacancies) values ($1, $2, 1)', ['Old', m.rows[0].id]);
      await copyFile(`${src}002_opening_description.sql`, `${dir}/002_opening_description.sql`);
      await migrate(p, `${dir}/`);
      const { rows } = await p.query('select description from job_openings');
      expect(rows).toEqual([{ description: '' }]);
    } finally {
      await p.end();
      await pool.query(`drop schema ${schema} cascade`);
      await rm(dir, { recursive: true });
    }
  });
});
