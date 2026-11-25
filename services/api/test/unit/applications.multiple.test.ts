import { describe, expect, it } from 'vitest';
import { createPublishedOpening, nonHr, setup } from './helpers.js';

async function seed() {
  const ctx = setup();
  const openingA = await createPublishedOpening(ctx.app, 'Opening A');
  const openingB = await createPublishedOpening(ctx.app, 'Opening B');
  const first = (
    await ctx.app.inject({
      method: 'POST',
      url: '/applications',
      payload: { openingId: openingA.id, candidateName: 'Ada', candidateEmail: 'ada@example.com' },
    })
  ).json();
  const second = { openingId: openingB.id, candidateName: 'Ada', candidateEmail: 'ADA@example.com' };
  return { ...ctx, openingA, openingB, first, second };
}

describe('a candidate applying to a second opening', () => {
  it('creates a separate application when staff confirm', async () => {
    const { app, applications, openingA, openingB, first, second } = await seed();
    const res = await app.inject({
      method: 'POST',
      url: '/applications',
      headers: nonHr,
      payload: { ...second, confirmAdditionalOpening: true },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().id).not.toBe(first.id);
    expect((await applications.list()).map((a) => a.openingId).sort()).toEqual([openingA.id, openingB.id].sort());
  });

  it('refuses without confirmation, and anonymous callers cannot confirm', async () => {
    const { app, applications, second } = await seed();
    const res = await app.inject({ method: 'POST', url: '/applications', payload: second });
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('confirmation_required');
    expect(await applications.list()).toHaveLength(1);
    const anon = await app.inject({
      method: 'POST',
      url: '/applications',
      payload: { ...second, confirmAdditionalOpening: true },
    });
    expect(anon.statusCode).toBe(401);
    expect(await applications.list()).toHaveLength(1);
  });
});
