import { describe, expect, it } from 'vitest';
import { setup, valid } from './helpers.js';

const full = { ...valid, location: 'Berlin', employmentType: 'Full-time', closingDate: '2027-01-15', description: 'Full text' };

describe('GET /public/openings', () => {
  it('lists a published opening without a token (AC1, AC7)', async () => {
    const { app, repo } = setup();
    const o = (await repo.create(full))!;
    await repo.publish(o.id);
    const res = await app.inject({ method: 'GET', url: '/public/openings' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([
      { id: o.id, title: valid.title, location: 'Berlin', employmentType: 'Full-time', closingDate: '2027-01-15', description: 'Full text' },
    ]);
  });

  it('omits draft and closed openings (AC3, AC4)', async () => {
    const { app, repo } = setup();
    await repo.create(valid);
    const closed = (await repo.create(valid))!;
    await repo.publish(closed.id);
    await repo.close(closed.id);
    const res = await app.inject({ method: 'GET', url: '/public/openings' });
    expect(res.json()).toEqual([]);
  });
});
