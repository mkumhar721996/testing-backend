import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PgApplicationsRepository } from '../../src/applications/pgRepository.js';
import { createPool } from '../../src/db.js';
import { migrate } from '../../src/migrate.js';
import { PgOpeningsRepository } from '../../src/openings/pgRepository.js';

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('PgApplicationsRepository', () => {
  const pool = createPool(url ?? '');
  const openings = new PgOpeningsRepository(pool);
  const repo = new PgApplicationsRepository(pool);
  let managerId = '';

  async function published(title: string) {
    const created = await openings.create({ title, hiringManagerId: managerId, vacancies: 1 });
    await openings.publish(created!.id);
    return created!;
  }

  beforeAll(async () => {
    await migrate(pool);
    const { rows } = await pool.query("insert into hiring_managers (name) values ('Test Manager') returning id");
    managerId = rows[0].id;
  });
  afterAll(async () => {
    await pool.query('delete from applications');
    await pool.query('delete from job_openings');
    await pool.query('delete from hiring_managers');
    await pool.end();
  });

  it('links to a published opening and shows its title', async () => {
    const opening = await published('Designer');
    const created = await repo.create({ openingId: opening.id, candidateName: 'Ada', candidateEmail: 'Ada@Example.com ' });
    expect(created).toMatchObject({ openingId: opening.id, openingTitle: 'Designer', candidateEmail: 'ada@example.com' });
    expect(await repo.get((created as { id: string }).id)).toMatchObject({ openingTitle: 'Designer' });
  });

  it('refuses a Draft or unknown opening and a missing opening in storage', async () => {
    const draft = await openings.create({ title: 'Draft', hiringManagerId: managerId, vacancies: 1 });
    const n = { candidateName: 'Bo', candidateEmail: 'bo@example.com' };
    expect(await repo.create({ ...n, openingId: draft!.id })).toBe('opening_not_published');
    expect(await repo.create({ ...n, openingId: '22222222-2222-4222-8222-222222222222' })).toBe('opening_not_found');
    await expect(
      pool.query('insert into applications (opening_id, candidate_name, candidate_email) values (null, $1, $2)', [
        'Ada',
        'a@b.c',
      ]),
    ).rejects.toThrow();
  });

  it('needs confirmation for a second opening', async () => {
    const a = await published('A');
    const b = await published('B');
    const n = { candidateName: 'Cy', candidateEmail: 'cy@example.com' };
    const first = await repo.create({ ...n, openingId: a.id });
    expect(await repo.create({ ...n, openingId: b.id })).toBe('confirmation_required');
    const second = await repo.create({ ...n, openingId: b.id, candidateEmail: 'CY@example.com', confirmAdditionalOpening: true });
    expect(second).toMatchObject({ openingId: b.id });
    expect((second as { id: string }).id).not.toBe((first as { id: string }).id);
  });

  it('keeps existing job_openings readable', async () => {
    expect((await openings.list()).length).toBeGreaterThan(0);
  });
});
