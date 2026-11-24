import { randomUUID } from 'node:crypto';
import { OpeningAlreadyPublishedError, publish, type JobOpening, type NewOpening } from './domain.js';
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

  async listHiringManagers(): Promise<HiringManager[]> {
    return [...this.managers];
  }
}
