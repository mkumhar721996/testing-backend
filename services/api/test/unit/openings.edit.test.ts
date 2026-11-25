import { describe, expect, it } from 'vitest';
import { hr, mgr, setup } from './helpers.js';

async function opening(repo: ReturnType<typeof setup>['repo'], title = 'Designer', vacancies = 1) {
  const o = await repo.create({ title, hiringManagerId: mgr.id, vacancies });
  if (!o) throw new Error('setup failed');
  return o;
}

async function publishedOpening(repo: ReturnType<typeof setup>['repo'], title: string, vacancies = 3) {
  const o = await opening(repo, title, vacancies);
  await repo.publish(o.id);
  return o;
}

const patch = (app: ReturnType<typeof setup>['app'], id: string, payload: object) =>
  app.inject({ method: 'PATCH', url: `/openings/${id}`, headers: hr, payload });

describe('PATCH /openings/:id', () => {
  it('changes the title of a Draft (AC1)', async () => {
    const { app, repo } = setup();
    const draft = await opening(repo);
    const res = await patch(app, draft.id, { title: 'Senior Engineer' });
    expect(res.statusCode).toBe(200);
    expect((await repo.list())[0]).toMatchObject({ title: 'Senior Engineer', status: 'Draft' });
  });

  it('stores a trimmed title and refuses a blank one', async () => {
    const { app, repo } = setup();
    const draft = await opening(repo);
    await patch(app, draft.id, { title: '  Lead  ' });
    expect((await repo.list())[0].title).toBe('Lead');
    const res = await patch(app, draft.id, { title: '   ' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('Enter a job title.');
  });

  it('returns 404 for an unknown id', async () => {
    const { app } = setup();
    expect((await patch(app, 'missing', { title: 'X' })).statusCode).toBe(404);
  });

  it('changes the vacancies of a Draft', async () => {
    const { app, repo } = setup();
    const draft = await opening(repo);
    expect((await patch(app, draft.id, { vacancies: 4 })).statusCode).toBe(200);
    expect((await repo.list())[0].vacancies).toBe(4);
  });

  it('changes the title of a published opening (AC2)', async () => {
    const { app, repo } = setup();
    const o = await publishedOpening(repo, 'Senior Engineer');
    await patch(app, o.id, { title: 'Staff Engineer' });
    expect((await repo.list())[0].title).toBe('Staff Engineer');
  });

  it('defaults the description to empty and changes it (AC3)', async () => {
    const { app, repo } = setup();
    const o = await publishedOpening(repo, 'Backend');
    expect((await repo.list())[0].description).toBe('');
    await patch(app, o.id, { description: 'Backend platform role' });
    expect((await repo.list())[0].description).toBe('Backend platform role');
  });

  it('refuses a blank description', async () => {
    const { app, repo } = setup();
    const o = await opening(repo);
    const res = await patch(app, o.id, { description: '  ' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('Enter a description so candidates know what the role involves.');
  });

  it('refuses a vacancy change once published (AC4)', async () => {
    const { app, repo } = setup();
    const o = await publishedOpening(repo, 'Backend');
    const res = await patch(app, o.id, { vacancies: 5 });
    expect(res.statusCode).toBe(409);
    expect((await repo.list())[0].vacancies).toBe(3);
  });

  it('applies nothing when a published edit also changes vacancies', async () => {
    const { app, repo } = setup();
    const o = await publishedOpening(repo, 'Backend');
    expect((await patch(app, o.id, { title: 'X', vacancies: 5 })).statusCode).toBe(409);
    expect((await repo.list())[0].title).toBe('Backend');
  });
});
