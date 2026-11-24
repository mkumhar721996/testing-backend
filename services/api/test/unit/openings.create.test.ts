import { describe, expect, it } from 'vitest';
import { hr, mgr, setup, valid } from './helpers.js';

describe('POST /openings', () => {
  it('creates an opening that appears in the list (AC1, AC6)', async () => {
    const { app } = setup();
    const created = await app.inject({ method: 'POST', url: '/openings', headers: hr, payload: valid });
    expect(created.statusCode).toBe(201);
    expect(created.json().status).toBe('Draft');
    const list = await app.inject({ method: 'GET', url: '/openings', headers: hr });
    expect(list.json().map((o: { id: string }) => o.id)).toContain(created.json().id);
  });

  it('shows the hiring manager (AC4)', async () => {
    const { app } = setup();
    const created = await app.inject({ method: 'POST', url: '/openings', headers: hr, payload: valid });
    expect(created.json().hiringManager).toEqual({ id: mgr.id, name: mgr.name });
  });

  it('shows the vacancy count (AC5)', async () => {
    const { app } = setup();
    const res = await app.inject({
      method: 'POST',
      url: '/openings',
      headers: hr,
      payload: { title: 'T', hiringManagerId: mgr.id, vacancies: 3 },
    });
    expect(res.json().vacancies).toBe(3);
  });

  it.each([
    ['no title', { hiringManagerId: mgr.id, vacancies: 1 }],
    ['blank title', { title: '   ', hiringManagerId: mgr.id, vacancies: 1 }],
    ['no hiring manager', { title: 'T', vacancies: 1 }],
    ['no vacancies', { title: 'T', hiringManagerId: mgr.id }],
    ['zero vacancies', { title: 'T', hiringManagerId: mgr.id, vacancies: 0 }],
    ['fractional vacancies', { title: 'T', hiringManagerId: mgr.id, vacancies: 1.5 }],
    ['unknown hiring manager', { title: 'T', hiringManagerId: 'nope', vacancies: 1 }],
  ])('rejects %s and creates nothing (AC3, AC4)', async (_name, payload) => {
    const { app, repo } = setup();
    const res = await app.inject({ method: 'POST', url: '/openings', headers: hr, payload });
    expect(res.statusCode).toBe(400);
    expect(await repo.list()).toHaveLength(0);
  });
});

describe('GET /hiring-managers and /me', () => {
  it('lists hiring managers', async () => {
    const { app } = setup();
    const res = await app.inject({ method: 'GET', url: '/hiring-managers', headers: hr });
    expect(res.json()).toEqual([mgr]);
  });

  it('reports the HR flag', async () => {
    const { app } = setup();
    const res = await app.inject({ method: 'GET', url: '/me', headers: hr });
    expect(res.json()).toEqual({ isHrAdmin: true });
  });
});
