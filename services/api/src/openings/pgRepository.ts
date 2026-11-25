import type pg from 'pg';
import { toPublicOpening, type JobOpening, type NewOpening, type PublicOpening } from './domain.js';
import type { HiringManager, OpeningsRepository } from './repository.js';

const SELECT = `select o.id, o.title, o.vacancies, o.status, o.created_at,
  o.location, o.employment_type, to_char(o.closing_date, 'YYYY-MM-DD') as closing_date, o.description,
  m.id as manager_id, m.name as manager_name
  from job_openings o join hiring_managers m on m.id = o.hiring_manager_id`;

interface Row {
  id: string;
  title: string;
  vacancies: number;
  status: JobOpening['status'];
  created_at: Date;
  location: string | null;
  employment_type: string | null;
  closing_date: string | null;
  description: string | null;
  manager_id: string;
  manager_name: string;
}

const toOpening = (r: Row): JobOpening => ({
  id: r.id,
  title: r.title,
  hiringManager: { id: r.manager_id, name: r.manager_name },
  vacancies: r.vacancies,
  status: r.status,
  createdAt: r.created_at.toISOString(),
  location: r.location,
  employmentType: r.employment_type,
  closingDate: r.closing_date,
  description: r.description,
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class PgOpeningsRepository implements OpeningsRepository {
  constructor(private pool: pg.Pool) {}

  async list(): Promise<JobOpening[]> {
    const { rows } = await this.pool.query<Row>(`${SELECT} order by o.created_at, o.id`);
    return rows.map(toOpening);
  }

  async listOpen(): Promise<PublicOpening[]> {
    const { rows } = await this.pool.query<Row>(`${SELECT} where o.status = 'Published' order by o.created_at, o.id`);
    return rows.map((r) => toPublicOpening(toOpening(r)));
  }

  async getOpen(id: string): Promise<PublicOpening | null> {
    if (!UUID.test(id)) return null;
    const { rows } = await this.pool.query<Row>(`${SELECT} where o.id = $1 and o.status = 'Published'`, [id]);
    return rows[0] ? toPublicOpening(toOpening(rows[0])) : null;
  }

  async create(n: NewOpening): Promise<JobOpening | null> {
    if (!UUID.test(n.hiringManagerId)) return null;
    const { rows } = await this.pool.query<{ id: string }>(
      `insert into job_openings (title, hiring_manager_id, vacancies, location, employment_type, closing_date, description)
       select $1, m.id, $3, $4, $5, $6, $7 from hiring_managers m where m.id = $2 returning id`,
      [
        n.title,
        n.hiringManagerId,
        n.vacancies,
        n.location ?? null,
        n.employmentType ?? null,
        n.closingDate ?? null,
        n.description ?? null,
      ],
    );
    if (rows.length === 0) return null;
    return this.get(rows[0].id);
  }

  async publish(id: string): Promise<JobOpening | 'not_found' | 'already_published'> {
    if (!UUID.test(id)) return 'not_found';
    const { rows } = await this.pool.query<{ id: string }>(
      `update job_openings set status = 'Published' where id = $1 and status = 'Draft' returning id`,
      [id],
    );
    if (rows.length > 0) return (await this.get(id)) ?? 'not_found';
    const existing = await this.get(id);
    return existing ? 'already_published' : 'not_found';
  }

  async close(id: string): Promise<JobOpening | 'not_found' | 'not_published'> {
    if (!UUID.test(id)) return 'not_found';
    const { rows } = await this.pool.query<{ id: string }>(
      `update job_openings set status = 'Closed' where id = $1 and status = 'Published' returning id`,
      [id],
    );
    if (rows.length > 0) return (await this.get(id)) ?? 'not_found';
    const existing = await this.get(id);
    return existing ? 'not_published' : 'not_found';
  }

  async listHiringManagers(): Promise<HiringManager[]> {
    const { rows } = await this.pool.query<HiringManager>('select id, name from hiring_managers order by name');
    return rows;
  }

  private async get(id: string): Promise<JobOpening | null> {
    const { rows } = await this.pool.query<Row>(`${SELECT} where o.id = $1`, [id]);
    return rows[0] ? toOpening(rows[0]) : null;
  }
}
