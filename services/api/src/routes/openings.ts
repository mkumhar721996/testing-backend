import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Authenticator, Principal } from '../auth.js';
import type { NewOpening, OpeningEdit } from '../openings/domain.js';
import type { OpeningsRepository } from '../openings/repository.js';

declare module 'fastify' {
  interface FastifyRequest {
    principal?: Principal;
  }
}

const createSchema = {
  body: {
    type: 'object',
    required: ['title', 'hiringManagerId', 'vacancies'],
    properties: {
      title: { type: 'string', minLength: 1 },
      hiringManagerId: { type: 'string', minLength: 1 },
      vacancies: { type: 'integer', minimum: 1 },
    },
  },
} as const;

const editSchema = {
  body: {
    type: 'object',
    minProperties: 1,
    properties: {
      title: { type: 'string' },
      description: { type: 'string' },
      vacancies: { type: 'integer', minimum: 1 },
    },
  },
} as const;

export function openingsRoutes(deps: { repository: OpeningsRepository; authenticate: Authenticator }) {
  const { repository, authenticate } = deps;

  async function requireSignedIn(req: FastifyRequest, reply: FastifyReply) {
    const principal = await authenticate(req.headers.authorization);
    if (!principal) return reply.code(401).send({ error: 'Sign in to continue.' });
    req.principal = principal;
  }

  // Runs before body validation and before any repository call.
  async function requireHrAdmin(req: FastifyRequest, reply: FastifyReply) {
    const denied = await requireSignedIn(req, reply);
    if (denied) return denied;
    if (!req.principal?.isHrAdmin) return reply.code(403).send({ error: 'Only HR admins can do this.' });
  }

  return async function register(app: FastifyInstance): Promise<void> {
    app.get('/me', { onRequest: requireSignedIn }, async (req) => ({ isHrAdmin: req.principal!.isHrAdmin }));

    app.get('/hiring-managers', { onRequest: requireSignedIn }, () => repository.listHiringManagers());

    app.get('/openings', { onRequest: requireSignedIn }, () => repository.list());

    app.post<{ Body: NewOpening }>(
      '/openings',
      { onRequest: requireHrAdmin, schema: createSchema },
      async (req, reply) => {
        if (req.body.title.trim() === '') return reply.code(400).send({ error: 'Enter a job title.' });
        const created = await repository.create({ ...req.body, title: req.body.title.trim() });
        if (!created) return reply.code(400).send({ error: 'Choose a hiring manager.' });
        return reply.code(201).send(created);
      },
    );

    app.patch<{ Params: { id: string }; Body: OpeningEdit }>(
      '/openings/:id',
      { onRequest: requireHrAdmin, schema: editSchema },
      async (req, reply) => {
        const edit = { ...req.body };
        if (edit.title !== undefined) {
          edit.title = edit.title.trim();
          if (edit.title === '') return reply.code(400).send({ error: 'Enter a job title.' });
        }
        if (edit.description !== undefined) {
          edit.description = edit.description.trim();
          if (edit.description === '') {
            return reply.code(400).send({ error: 'Enter a description so candidates know what the role involves.' });
          }
        }
        const result = await repository.update(req.params.id, edit);
        if (result === 'not_found') return reply.code(404).send({ error: 'Opening not found.' });
        if (result === 'vacancies_locked') {
          return reply.code(409).send({ error: 'The vacancy count is locked once an opening is published.' });
        }
        return result;
      },
    );

    app.post<{ Params: { id: string } }>(
      '/openings/:id/publish',
      { onRequest: requireHrAdmin },
      async (req, reply) => {
        const result = await repository.publish(req.params.id);
        if (result === 'not_found') return reply.code(404).send({ error: 'Opening not found.' });
        if (result === 'already_published') return reply.code(409).send({ error: 'Opening is already published.' });
        return result;
      },
    );
  };
}
