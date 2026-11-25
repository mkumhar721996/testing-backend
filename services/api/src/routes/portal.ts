import type { FastifyInstance } from 'fastify';
import type { OpeningsRepository } from '../openings/repository.js';

// Public: no authentication. Exposes only what candidates may see.
export function portalRoutes(deps: { repository: OpeningsRepository }) {
  return async function register(app: FastifyInstance): Promise<void> {
    app.get('/portal/openings', async () =>
      (await deps.repository.listPublished()).map(({ id, title, description, vacancies }) => ({
        id,
        title,
        description,
        vacancies,
      })),
    );
  };
}
