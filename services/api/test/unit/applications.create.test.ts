import { describe, expect, it } from 'vitest';
import { createPublishedOpening, hr, setup, valid } from './helpers.js';

const candidate = { candidateName: 'Ada', candidateEmail: 'ada@example.com' };

describe('POST /applications', () => {
  it('links the application to a published opening', async () => {
    const { app } = setup();
    const opening = await createPublishedOpening(app);
    const res = await app.inject({ method: 'POST', url: '/applications', payload: { openingId: opening.id, ...candidate } });
    expect(res.statusCode).toBe(201);
    expect(res.json().openingId).toBe(opening.id);
  });

  it('refuses a Draft opening', async () => {
    const { app, applications } = setup();
    const draft = (await app.inject({ method: 'POST', url: '/openings', headers: hr, payload: valid })).json();
    const res = await app.inject({ method: 'POST', url: '/applications', payload: { openingId: draft.id, ...candidate } });
    expect(res.statusCode).toBe(409);
    expect(await applications.list()).toHaveLength(0);
  });

  it('does not create an application without an opening', async () => {
    const { app, applications } = setup();
    const res = await app.inject({ method: 'POST', url: '/applications', payload: candidate });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('Choose an opening.');
    expect(await applications.list()).toHaveLength(0);
  });

  it('refuses an unknown opening', async () => {
    const { app, applications } = setup();
    const res = await app.inject({
      method: 'POST',
      url: '/applications',
      payload: { openingId: '22222222-2222-4222-8222-222222222222', ...candidate },
    });
    expect(res.statusCode).toBe(404);
    expect(await applications.list()).toHaveLength(0);
  });
});
