import type { FastifyInstance } from 'fastify';
import type { OpeningsRepository } from '../openings/repository.js';

// Unauthenticated on purpose: visitors browse open jobs without signing in.
export function publicOpeningsRoutes(deps: { repository: OpeningsRepository }) {
  const { repository } = deps;
  return async function register(app: FastifyInstance): Promise<void> {
    app.get('/public/openings', () => repository.listOpen());

    app.get<{ Params: { id: string } }>('/public/openings/:id', async (req, reply) => {
      const opening = await repository.getOpen(req.params.id);
      if (!opening) return reply.code(404).send({ error: 'Job not found.' });
      return opening;
    });
  };
}
