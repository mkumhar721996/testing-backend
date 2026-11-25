import Fastify, { type FastifyInstance } from 'fastify';
import type { Authenticator } from './auth.js';
import type { OpeningsRepository } from './openings/repository.js';
import { healthRoutes } from './routes/health.js';
import { openingsRoutes } from './routes/openings.js';
import { portalRoutes } from './routes/portal.js';

export interface AppDeps {
  repository: OpeningsRepository;
  authenticate: Authenticator;
  /** The single Web App origin allowed to call the API cross-origin; unset allows none. */
  webOrigin?: string;
}

export function buildApp(deps: AppDeps): FastifyInstance {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });
  const { webOrigin } = deps;
  if (webOrigin) {
    app.addHook('onRequest', async (req, reply) => {
      if (req.headers.origin !== webOrigin) return;
      reply.header('access-control-allow-origin', webOrigin).header('vary', 'Origin');
      if (req.method === 'OPTIONS' && req.headers['access-control-request-method']) {
        return reply
          .header('access-control-allow-methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
          .header('access-control-allow-headers', 'authorization, content-type')
          .header('access-control-max-age', '600')
          .code(204)
          .send();
      }
    });
  }
  app.register(healthRoutes);
  app.register(openingsRoutes(deps));
  app.register(portalRoutes(deps));
  return app;
}
