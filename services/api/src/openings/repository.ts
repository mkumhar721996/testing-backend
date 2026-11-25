import type { JobOpening, NewOpening, PublicOpening } from './domain.js';

export interface HiringManager {
  id: string;
  name: string;
}

export interface OpeningsRepository {
  list(): Promise<JobOpening[]>;
  /** Published openings only, public fields only. */
  listOpen(): Promise<PublicOpening[]>;
  /** Null for a missing, malformed, Draft or Closed opening. */
  getOpen(id: string): Promise<PublicOpening | null>;
  /** Returns null when the hiring manager does not exist. */
  create(n: NewOpening): Promise<JobOpening | null>;
  publish(id: string): Promise<JobOpening | 'not_found' | 'already_published'>;
  close(id: string): Promise<JobOpening | 'not_found' | 'not_published'>;
  listHiringManagers(): Promise<HiringManager[]>;
}
