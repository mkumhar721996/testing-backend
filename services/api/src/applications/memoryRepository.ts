import { randomUUID } from 'node:crypto';
import { canAcceptApplications } from '../openings/domain.js';
import type { OpeningsRepository } from '../openings/repository.js';
import { normaliseEmail, type Application, type CreateApplicationResult, type NewApplication } from './domain.js';
import type { ApplicationsRepository } from './repository.js';

export class MemoryApplicationsRepository implements ApplicationsRepository {
  private applications: Application[] = [];

  constructor(private openings: OpeningsRepository) {}

  async create(n: NewApplication): Promise<CreateApplicationResult> {
    const opening = (await this.openings.list()).find((o) => o.id === n.openingId);
    if (!opening) return 'opening_not_found';
    if (!canAcceptApplications(opening)) return 'opening_not_published';
    const email = normaliseEmail(n.candidateEmail);
    const hasOther = this.applications.some((a) => a.candidateEmail === email && a.openingId !== opening.id);
    if (hasOther && !n.confirmAdditionalOpening) return 'confirmation_required';
    const application: Application = {
      id: randomUUID(),
      openingId: opening.id,
      openingTitle: opening.title,
      candidateName: n.candidateName.trim(),
      candidateEmail: email,
      createdAt: new Date().toISOString(),
    };
    this.applications.push(application);
    return application;
  }

  async list(): Promise<Application[]> {
    return [...this.applications];
  }

  async get(id: string): Promise<Application | null> {
    return this.applications.find((a) => a.id === id) ?? null;
  }
}
