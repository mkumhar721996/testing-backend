import { randomUUID } from 'node:crypto';
import {
  close,
  isOpenToPublic,
  toPublicOpening,
  type PublicOpening,
  OpeningAlreadyPublishedError,
  OpeningNotPublishedError,
  publish,
  type JobOpening, type NewOpening } from './domain.js';
import type { HiringManager, OpeningsRepository } from './repository.js';

export class MemoryOpeningsRepository implements OpeningsRepository {
  private openings: JobOpening[] = [];

  constructor(private managers: HiringManager[] = []) {}

  async list(): Promise<JobOpening[]> {
    return [...this.openings];
  }

  async listOpen(): Promise<PublicOpening[]> {
    return this.openings.filter(isOpenToPublic).map(toPublicOpening);
  }

  async getOpen(id: string): Promise<PublicOpening | null> {
    const o = this.openings.find((x) => x.id === id);
    return o && isOpenToPublic(o) ? toPublicOpening(o) : null;
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
      location: n.location ?? null,
      employmentType: n.employmentType ?? null,
      closingDate: n.closingDate ?? null,
      description: n.description ?? null,
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

  async close(id: string): Promise<JobOpening | 'not_found' | 'not_published'> {
    const index = this.openings.findIndex((o) => o.id === id);
    if (index < 0) return 'not_found';
    try {
      this.openings[index] = close(this.openings[index]);
    } catch (err) {
      if (err instanceof OpeningNotPublishedError) return 'not_published';
      throw err;
    }
    return this.openings[index];
  }

  async listHiringManagers(): Promise<HiringManager[]> {
    return [...this.managers];
  }
}
