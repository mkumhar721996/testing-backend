import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { ApplicationsRepository } from '../applications/repository.js';
import type { Authenticator } from '../auth.js';
import './openings.js';

interface CreateBody {
  openingId?: string;
  candidateName: string;
  candidateEmail: string;
  confirmAdditionalOpening?: boolean;
}

// openingId is checked in the handler so its absence gets the friendly message, not a schema error.
const createSchema = {
  body: {
    type: 'object',
    required: ['candidateName', 'candidateEmail'],
    properties: {
      openingId: { type: 'string' },
      candidateName: { type: 'string', minLength: 1 },
      candidateEmail: { type: 'string', minLength: 1 },
      confirmAdditionalOpening: { type: 'boolean' },
    },
  },
} as const;

export function applicationsRoutes(deps: { applications: ApplicationsRepository; authenticate: Authenticator }) {
  const { applications, authenticate } = deps;

  async function requireSignedIn(req: FastifyRequest, reply: FastifyReply) {
    const principal = await authenticate(req.headers.authorization);
    if (!principal) return reply.code(401).send({ error: 'Sign in to continue.' });
    req.principal = principal;
  }

  return async function register(app: FastifyInstance): Promise<void> {
    app.get('/applications', { onRequest: requireSignedIn }, () => applications.list());

    app.get<{ Params: { id: string } }>('/applications/:id', { onRequest: requireSignedIn }, async (req, reply) => {
      const found = await applications.get(req.params.id);
      return found ?? reply.code(404).send({ error: 'Application not found.' });
    });

    app.post<{ Body: CreateBody }>('/applications', { schema: createSchema }, async (req, reply) => {
      const { openingId, candidateName, candidateEmail, confirmAdditionalOpening } = req.body;
      // Only signed-in staff may confirm; candidates cannot confirm for themselves.
      if (confirmAdditionalOpening) {
        await requireSignedIn(req, reply);
        // A sent reply is thenable and awaits to undefined, so check the principal rather than the return value.
        if (!req.principal) return reply;
      }
      if (!openingId) return reply.code(400).send({ error: 'Choose an opening.' });
      if (candidateName.trim() === '') return reply.code(400).send({ error: 'Enter the candidate name.' });
      if (candidateEmail.trim() === '') return reply.code(400).send({ error: 'Enter the candidate email.' });
      const result = await applications.create({ openingId, candidateName, candidateEmail, confirmAdditionalOpening });
      if (result === 'opening_not_found') return reply.code(404).send({ error: 'Opening not found.' });
      if (result === 'opening_not_published') {
        return reply.code(409).send({ error: 'This opening is not accepting applications.' });
      }
      if (result === 'confirmation_required') {
        return reply.code(409).send({
          code: 'confirmation_required',
          error: 'This candidate already applied to another opening. Staff must confirm a new application.',
        });
      }
      return reply.code(201).send(result);
    });
  };
}
