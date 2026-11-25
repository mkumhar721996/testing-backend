import { describe, expect, it } from 'vitest';
import { createPublishedOpening, nonHr, setup } from './helpers.js';

describe('viewing applications', () => {
  it('shows the opening title with the application', async () => {
    const { app } = setup();
    const opening = await createPublishedOpening(app);
    const created = (
      await app.inject({
        method: 'POST',
        url: '/applications',
        payload: { openingId: opening.id, candidateName: 'Ada', candidateEmail: 'ada@example.com' },
      })
    ).json();
    const got = await app.inject({ method: 'GET', url: `/applications/${created.id}`, headers: nonHr });
    expect(got.json().openingTitle).toBe(opening.title);
    const list = await app.inject({ method: 'GET', url: '/applications', headers: nonHr });
    expect(list.json()[0].openingTitle).toBe(opening.title);
    expect((await app.inject({ method: 'GET', url: '/applications' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: `/applications/${created.id}` })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/applications/nope', headers: nonHr })).statusCode).toBe(404);
  });
});
