import type pg from 'pg';
import { canAcceptApplications, type OpeningStatus } from '../openings/domain.js';
import { normaliseEmail, type Application, type CreateApplicationResult, type NewApplication } from './domain.js';
import type { ApplicationsRepository } from './repository.js';

const SELECT = `select a.id, a.opening_id, o.title as opening_title, a.candidate_name, a.candidate_email, a.created_at
  from applications a join job_openings o on o.id = a.opening_id`;

interface Row {
  id: string;
  opening_id: string;
  opening_title: string;
  candidate_name: string;
  candidate_email: string;
  created_at: Date;
}

const toApplication = (r: Row): Application => ({
  id: r.id,
  openingId: r.opening_id,
  openingTitle: r.opening_title,
  candidateName: r.candidate_name,
  candidateEmail: r.candidate_email,
  createdAt: r.created_at.toISOString(),
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class PgApplicationsRepository implements ApplicationsRepository {
  constructor(private pool: pg.Pool) {}

  async create(n: NewApplication): Promise<CreateApplicationResult> {
    if (!UUID.test(n.openingId)) return 'opening_not_found';
    const email = normaliseEmail(n.candidateEmail);
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      // Locking the opening serialises concurrent applications to it; the check below reads other openings.
      const opening = await client.query<{ status: OpeningStatus }>(
        'select status from job_openings where id = $1 for update',
        [n.openingId],
      );
      if (opening.rows.length === 0) {
        await client.query('rollback');
        return 'opening_not_found';
      }
      if (!canAcceptApplications(opening.rows[0])) {
        await client.query('rollback');
        return 'opening_not_published';
      }
      if (!n.confirmAdditionalOpening) {
        const others = await client.query(
          'select 1 from applications where candidate_email = $1 and opening_id <> $2 limit 1',
          [email, n.openingId],
        );
        if (others.rows.length > 0) {
          await client.query('rollback');
          return 'confirmation_required';
        }
      }
      const inserted = await client.query<{ id: string }>(
        'insert into applications (opening_id, candidate_name, candidate_email) values ($1, $2, $3) returning id',
        [n.openingId, n.candidateName.trim(), email],
      );
      const { rows } = await client.query<Row>(`${SELECT} where a.id = $1`, [inserted.rows[0].id]);
      await client.query('commit');
      return toApplication(rows[0]);
    } catch (err) {
      await client.query('rollback').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  async list(): Promise<Application[]> {
    const { rows } = await this.pool.query<Row>(`${SELECT} order by a.created_at, a.id`);
    return rows.map(toApplication);
  }

  async get(id: string): Promise<Application | null> {
    if (!UUID.test(id)) return null;
    const { rows } = await this.pool.query<Row>(`${SELECT} where a.id = $1`, [id]);
    return rows[0] ? toApplication(rows[0]) : null;
  }
}
