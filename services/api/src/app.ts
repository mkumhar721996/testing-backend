import Fastify, { type FastifyInstance } from 'fastify';
import type { Authenticator } from './auth.js';
import type { OpeningsRepository } from './openings/repository.js';
import { healthRoutes } from './routes/health.js';
import { openingsRoutes } from './routes/openings.js';

export interface AppDeps {
  repository: OpeningsRepository;
  authenticate: Authenticator;
}

export function buildApp(deps: AppDeps): FastifyInstance {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });
  app.register(healthRoutes);
  app.register(openingsRoutes(deps));
  return app;
}
