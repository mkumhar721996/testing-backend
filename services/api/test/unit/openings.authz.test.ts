import { describe, expect, it } from 'vitest';
import { hr, mgr, nonHr, setup, valid } from './helpers.js';

describe('authorisation', () => {
  it('refuses create for a non-HR user (AC9)', async () => {
    const { app, repo } = setup();
    const res = await app.inject({ method: 'POST', url: '/openings', headers: nonHr, payload: valid });
    expect(res.statusCode).toBe(403);
    expect(await repo.list()).toHaveLength(0);
  });

  it('answers 403 before validating the body', async () => {
    const { app } = setup();
    const res = await app.inject({ method: 'POST', url: '/openings', headers: nonHr, payload: {} });
    expect(res.statusCode).toBe(403);
  });

  it('answers 401 without a token', async () => {
    const { app } = setup();
    expect((await app.inject({ method: 'POST', url: '/openings', payload: valid })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/openings' })).statusCode).toBe(401);
  });

  it('refuses publish for a non-HR user (AC10)', async () => {
    const { app, repo } = setup();
    const draft = await repo.create({ title: 'Designer', hiringManagerId: mgr.id, vacancies: 1 });
    const res = await app.inject({ method: 'POST', url: `/openings/${draft!.id}/publish`, headers: nonHr });
    expect(res.statusCode).toBe(403);
    expect((await repo.list())[0].status).toBe('Draft');
  });

  it('refuses edit for a non-HR user (AC6)', async () => {
    const { app, repo } = setup();
    const o = await repo.create({ title: 'Senior Engineer', hiringManagerId: mgr.id, vacancies: 1 });
    await repo.publish(o!.id);
    const url = `/openings/${o!.id}`;
    const res = await app.inject({ method: 'PATCH', url, headers: nonHr, payload: { title: 'Staff Engineer' } });
    expect(res.statusCode).toBe(403);
    expect((await repo.list())[0].title).toBe('Senior Engineer');
    expect((await app.inject({ method: 'PATCH', url, payload: { title: 'X' } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'PATCH', url, headers: nonHr, payload: {} })).statusCode).toBe(403);
  });

  it('lets a non-HR user view the list', async () => {
    const { app } = setup();
    expect((await app.inject({ method: 'GET', url: '/openings', headers: nonHr })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/openings', headers: hr })).statusCode).toBe(200);
  });
});
