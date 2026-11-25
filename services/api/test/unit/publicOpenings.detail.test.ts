import { describe, expect, it } from 'vitest';
import { setup, valid } from './helpers.js';

describe('GET /public/openings/:id', () => {
  it('shows a published opening with only public fields (AC2, AC8)', async () => {
    const { app, repo } = setup();
    const o = (await repo.create({
      ...valid,
      location: 'Berlin',
      employmentType: 'Full-time',
      closingDate: '2027-01-15',
      description: 'Full text',
    }))!;
    await repo.publish(o.id);
    const res = await app.inject({ method: 'GET', url: `/public/openings/${o.id}` });
    expect(res.statusCode).toBe(200);
    expect(Object.keys(res.json()).sort()).toEqual(['closingDate', 'description', 'employmentType', 'id', 'location', 'title']);
    expect(res.json().description).toBe('Full text');
  });

  it('returns 404 for draft, closed and unknown ids (AC5)', async () => {
    const { app, repo } = setup();
    const draft = (await repo.create(valid))!;
    const closed = (await repo.create(valid))!;
    await repo.publish(closed.id);
    await repo.close(closed.id);
    for (const id of [draft.id, closed.id, '22222222-2222-4222-8222-222222222222', 'not-a-uuid']) {
      const res = await app.inject({ method: 'GET', url: `/public/openings/${id}` });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ error: 'Job not found.' });
    }
  });
});
