import { describe, expect, it } from 'vitest';
import { canAcceptApplications } from '../../src/openings/domain.js';
import { hr, mgr, nonHr, setup } from './helpers.js';

async function publishedIn(repo: ReturnType<typeof setup>['repo']) {
  const draft = await repo.create({ title: 'Designer', hiringManagerId: mgr.id, vacancies: 3 });
  if (!draft) throw new Error('setup failed');
  const published = await repo.publish(draft.id);
  if (typeof published === 'string') throw new Error('setup failed');
  return published;
}

describe('POST /openings/:id/close', () => {
  it('closes a published opening (AC1)', async () => {
    const { app, repo } = setup();
    const opening = await publishedIn(repo);
    const res = await app.inject({ method: 'POST', url: `/openings/${opening.id}/close`, headers: hr });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('Closed');
    expect((await repo.list())[0].status).toBe('Closed');
  });

  it('changes only the status; the future application story must not touch applications on close (AC3)', async () => {
    const { app, repo } = setup();
    const published = await publishedIn(repo);
    const res = await app.inject({ method: 'POST', url: `/openings/${published.id}/close`, headers: hr });
    const { status: _closed, ...rest } = res.json();
    const { status: _published, ...before } = published;
    expect(rest).toEqual(before);
  });

  it('refuses applications once closed (AC4)', async () => {
    const { app, repo } = setup();
    const opening = await publishedIn(repo);
    const res = await app.inject({ method: 'POST', url: `/openings/${opening.id}/close`, headers: hr });
    expect(canAcceptApplications(res.json())).toBe(false);
  });

  it('keeps a closed opening in the list marked Closed (AC5)', async () => {
    const { app, repo } = setup();
    const opening = await publishedIn(repo);
    await app.inject({ method: 'POST', url: `/openings/${opening.id}/close`, headers: hr });
    const list = await app.inject({ method: 'GET', url: '/openings', headers: nonHr });
    expect(list.json()).toEqual([expect.objectContaining({ id: opening.id, status: 'Closed' })]);
  });

  it('leaves an opening Published when nobody closes it (AC6)', async () => {
    const { app, repo } = setup();
    const opening = await publishedIn(repo);
    await app.inject({ method: 'POST', url: `/openings/${opening.id}/close`, headers: nonHr });
    expect(opening.vacancies).toBe(3);
    expect((await repo.list())[0].status).toBe('Published');
    expect(canAcceptApplications((await repo.list())[0])).toBe(true);
  });

  it('returns 409 on a second close and for a Draft', async () => {
    const { app, repo } = setup();
    const opening = await publishedIn(repo);
    await app.inject({ method: 'POST', url: `/openings/${opening.id}/close`, headers: hr });
    const again = await app.inject({ method: 'POST', url: `/openings/${opening.id}/close`, headers: hr });
    expect(again.statusCode).toBe(409);
  });

  it('returns 404 for an unknown id', async () => {
    const { app } = setup();
    const res = await app.inject({ method: 'POST', url: '/openings/missing/close', headers: hr });
    expect(res.statusCode).toBe(404);
  });
});
