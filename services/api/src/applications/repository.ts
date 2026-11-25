import type { Application, CreateApplicationResult, NewApplication } from './domain.js';

export interface ApplicationsRepository {
  create(n: NewApplication): Promise<CreateApplicationResult>;
  list(): Promise<Application[]>;
  get(id: string): Promise<Application | null>;
}
