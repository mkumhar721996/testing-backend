import { describe, expect, it } from 'vitest';
import { hr, mgr, setup } from './helpers.js';

describe('GET /portal/openings', () => {
  it('shows the edited title of a published opening without a token (AC5)', async () => {
    const { app, repo } = setup();
    const o = await repo.create({ title: 'Staff Engineer', hiringManagerId: mgr.id, vacancies: 2 });
    await repo.publish(o!.id);
    await app.inject({ method: 'PATCH', url: `/openings/${o!.id}`, headers: hr, payload: { title: 'Principal Engineer' } });
    const portal = await app.inject({ method: 'GET', url: '/portal/openings' });
    expect(portal.statusCode).toBe(200);
    expect(portal.json()).toEqual([expect.objectContaining({ title: 'Principal Engineer' })]);
    expect(portal.json()[0]).not.toHaveProperty('hiringManager');
    expect(portal.json()[0]).not.toHaveProperty('status');
  });

  it('leaves out Drafts', async () => {
    const { app, repo } = setup();
    await repo.create({ title: 'Draft', hiringManagerId: mgr.id, vacancies: 1 });
    expect((await app.inject({ method: 'GET', url: '/portal/openings' })).json()).toEqual([]);
  });
});
