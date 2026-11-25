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

  it('lets a non-HR user view the list', async () => {
    const { app } = setup();
    expect((await app.inject({ method: 'GET', url: '/openings', headers: nonHr })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/openings', headers: hr })).statusCode).toBe(200);
  });
});

describe('close authorisation', () => {
  it('refuses close for a non-HR user and without a token (AC2)', async () => {
    const { app, repo } = setup();
    const draft = await repo.create({ title: 'Designer', hiringManagerId: mgr.id, vacancies: 1 });
    await repo.publish(draft!.id);
    const url = `/openings/${draft!.id}/close`;
    expect((await app.inject({ method: 'POST', url, headers: nonHr })).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url })).statusCode).toBe(401);
    expect((await repo.list())[0].status).toBe('Published');
  });
});
