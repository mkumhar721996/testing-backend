import type { JobOpening, NewOpening, OpeningEdit } from './domain.js';

export interface HiringManager {
  id: string;
  name: string;
}

export interface OpeningsRepository {
  list(): Promise<JobOpening[]>;
  /** Returns null when the hiring manager does not exist. */
  create(n: NewOpening): Promise<JobOpening | null>;
  publish(id: string): Promise<JobOpening | 'not_found' | 'already_published'>;
  update(id: string, e: OpeningEdit): Promise<JobOpening | 'not_found' | 'vacancies_locked'>;
  listPublished(): Promise<JobOpening[]>;
  listHiringManagers(): Promise<HiringManager[]>;
}
