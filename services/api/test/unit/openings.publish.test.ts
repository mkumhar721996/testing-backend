import { describe, expect, it } from 'vitest';
import { canAcceptApplications } from '../../src/openings/domain.js';
import { hr, mgr, setup } from './helpers.js';

async function draftIn(repo: ReturnType<typeof setup>['repo']) {
  const draft = await repo.create({ title: 'Designer', hiringManagerId: mgr.id, vacancies: 1 });
  if (!draft) throw new Error('setup failed');
  return draft;
}

describe('POST /openings/:id/publish', () => {
  it('publishes a Draft so it can accept applications (AC2, AC7)', async () => {
    const { app, repo } = setup();
    const draft = await draftIn(repo);
    const res = await app.inject({ method: 'POST', url: `/openings/${draft.id}/publish`, headers: hr });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('Published');
    expect(canAcceptApplications(res.json())).toBe(true);
  });

  it('returns 409 on a second publish', async () => {
    const { app, repo } = setup();
    const draft = await draftIn(repo);
    await app.inject({ method: 'POST', url: `/openings/${draft.id}/publish`, headers: hr });
    const res = await app.inject({ method: 'POST', url: `/openings/${draft.id}/publish`, headers: hr });
    expect(res.statusCode).toBe(409);
  });

  it('returns 404 for an unknown id', async () => {
    const { app } = setup();
    const res = await app.inject({ method: 'POST', url: '/openings/missing/publish', headers: hr });
    expect(res.statusCode).toBe(404);
  });
});
