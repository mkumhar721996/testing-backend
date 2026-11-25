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

  it('closes a Published opening once; Drafts and unknown ids are refused', async () => {
    const created = await repo.create({ title: 'Analyst', hiringManagerId: managerId, vacancies: 3 });
    expect(await repo.close(created!.id)).toBe('not_published');
    await repo.publish(created!.id);
    expect(await repo.close(created!.id)).toMatchObject({ status: 'Closed' });
    expect(await repo.close(created!.id)).toBe('not_published');
    expect(await repo.close('00000000-0000-4000-8000-000000000000')).toBe('not_found');
    expect(await repo.close('not-a-uuid')).toBe('not_found');
  });
});
