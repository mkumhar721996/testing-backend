import type { FastifyInstance } from 'fastify';
import { MemoryApplicationsRepository } from '../../src/applications/memoryRepository.js';
import { buildApp } from '../../src/app.js';
import type { Authenticator } from '../../src/auth.js';
import { MemoryOpeningsRepository } from '../../src/openings/memoryRepository.js';

export const mgr = { id: '11111111-1111-4111-8111-111111111111', name: 'Test Manager' };

export const hr = { authorization: 'Bearer hr' };
export const nonHr = { authorization: 'Bearer staff' };

const authenticate: Authenticator = async (header) => {
  if (header === hr.authorization) return { sub: 'hr-user', isHrAdmin: true };
  if (header === nonHr.authorization) return { sub: 'staff-user', isHrAdmin: false };
  return null;
};

export function setup() {
  const repo = new MemoryOpeningsRepository([mgr]);
  const applications = new MemoryApplicationsRepository(repo);
  const app = buildApp({ repository: repo, applications, authenticate });
  return { app, repo, applications };
}

export const valid = { title: 'Senior backend engineer', hiringManagerId: mgr.id, vacancies: 2 };

export async function createPublishedOpening(app: FastifyInstance, title = valid.title) {
  const created = await app.inject({ method: 'POST', url: '/openings', headers: hr, payload: { ...valid, title } });
  const { id } = created.json();
  const published = await app.inject({ method: 'POST', url: `/openings/${id}/publish`, headers: hr });
  return published.json() as { id: string; title: string };
}
