import { describe, expect, it } from 'vitest';
import { MemoryApplicationsRepository } from '../../src/applications/memoryRepository.js';
import { buildApp } from '../../src/app.js';
import { MemoryOpeningsRepository } from '../../src/openings/memoryRepository.js';

const origin = 'http://localhost:5173';
const build = (webOrigin?: string) =>
{
  const repository = new MemoryOpeningsRepository([]);
  return buildApp({
    repository,
    applications: new MemoryApplicationsRepository(repository),
    authenticate: async () => null,
    webOrigin,
  });
};

describe('CORS', () => {
  it('answers a preflight from the allowed origin', async () => {
    const app = build(origin);
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/openings',
      headers: { origin, 'access-control-request-method': 'POST', 'access-control-request-headers': 'authorization' },
    });
    expect(res.statusCode).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(origin);
    expect(res.headers['access-control-allow-headers']).toMatch(/authorization/i);
    expect(res.headers['access-control-allow-methods']).toMatch(/POST/);
    await app.close();
  });

  it('adds the allow-origin header to normal responses', async () => {
    const app = build(origin);
    const res = await app.inject({ method: 'GET', url: '/health', headers: { origin } });
    expect(res.headers['access-control-allow-origin']).toBe(origin);
    await app.close();
  });

  it('does not allow other origins', async () => {
    const app = build(origin);
    const res = await app.inject({ method: 'GET', url: '/health', headers: { origin: 'http://evil.example' } });
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    await app.close();
  });

  it('allows no origin when none is configured', async () => {
    const app = build();
    const res = await app.inject({ method: 'GET', url: '/health', headers: { origin } });
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    await app.close();
  });
});
