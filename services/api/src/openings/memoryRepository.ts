import { randomUUID } from 'node:crypto';
import {
  applyEdit,
  OpeningAlreadyPublishedError,
  publish,
  VacanciesLockedError,
  type JobOpening,
  type NewOpening,
  type OpeningEdit,
} from './domain.js';
import type { HiringManager, OpeningsRepository } from './repository.js';

export class MemoryOpeningsRepository implements OpeningsRepository {
  private openings: JobOpening[] = [];

  constructor(private managers: HiringManager[] = []) {}

  async list(): Promise<JobOpening[]> {
    return [...this.openings];
  }

  async create(n: NewOpening): Promise<JobOpening | null> {
    const manager = this.managers.find((m) => m.id === n.hiringManagerId);
    if (!manager) return null;
    const opening: JobOpening = {
      id: randomUUID(),
      title: n.title,
      description: '',
      hiringManager: { ...manager },
      vacancies: n.vacancies,
      status: 'Draft',
      createdAt: new Date().toISOString(),
    };
    this.openings.push(opening);
    return opening;
  }

  async publish(id: string): Promise<JobOpening | 'not_found' | 'already_published'> {
    const index = this.openings.findIndex((o) => o.id === id);
    if (index < 0) return 'not_found';
    try {
      this.openings[index] = publish(this.openings[index]);
    } catch (err) {
      if (err instanceof OpeningAlreadyPublishedError) return 'already_published';
      throw err;
    }
    return this.openings[index];
  }

  async update(id: string, e: OpeningEdit): Promise<JobOpening | 'not_found' | 'vacancies_locked'> {
    const index = this.openings.findIndex((o) => o.id === id);
    if (index < 0) return 'not_found';
    try {
      this.openings[index] = applyEdit(this.openings[index], e);
    } catch (err) {
      if (err instanceof VacanciesLockedError) return 'vacancies_locked';
      throw err;
    }
    return this.openings[index];
  }

  async listPublished(): Promise<JobOpening[]> {
    return this.openings.filter((o) => o.status === 'Published');
  }

  async listHiringManagers(): Promise<HiringManager[]> {
    return [...this.managers];
  }
}
