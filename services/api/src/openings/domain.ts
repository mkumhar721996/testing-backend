export type OpeningStatus = 'Draft' | 'Published' | 'Closed';

export interface JobOpening {
  id: string;
  title: string;
  hiringManager: { id: string; name: string };
  vacancies: number;
  status: OpeningStatus;
  createdAt: string;
  location?: string | null;
  employmentType?: string | null;
  /** YYYY-MM-DD */
  closingDate?: string | null;
  description?: string | null;
}

export interface NewOpening {
  title: string;
  hiringManagerId: string;
  vacancies: number;
  location?: string;
  employmentType?: string;
  closingDate?: string;
  description?: string;
}

// What a visitor may see; deliberately omits hiringManager, vacancies, status and createdAt.
export interface PublicOpening {
  id: string;
  title: string;
  location: string | null;
  employmentType: string | null;
  closingDate: string | null;
  description: string | null;
}

export function toPublicOpening(o: JobOpening): PublicOpening {
  return {
    id: o.id,
    title: o.title,
    location: o.location ?? null,
    employmentType: o.employmentType ?? null,
    closingDate: o.closingDate ?? null,
    description: o.description ?? null,
  };
}

export class OpeningAlreadyPublishedError extends Error {
  constructor() {
    super('Opening is already published');
    this.name = 'OpeningAlreadyPublishedError';
  }
}

export class OpeningNotPublishedError extends Error {
  constructor() {
    super('Opening is not published');
    this.name = 'OpeningNotPublishedError';
  }
}

// The single guard the future application story must call to refuse applications against a Draft or Closed opening.
export function canAcceptApplications(o: Pick<JobOpening, 'status'>): boolean {
  return o.status === 'Published';
}

// An opening is shown to the public exactly when it can accept applications.
export function isOpenToPublic(o: Pick<JobOpening, 'status'>): boolean {
  return canAcceptApplications(o);
}

// Closing changes only the opening; applications already in progress are left alone.
export function close(o: JobOpening): JobOpening {
  if (o.status !== 'Published') throw new OpeningNotPublishedError();
  return { ...o, status: 'Closed' };
}

export function publish(o: JobOpening): JobOpening {
  if (o.status !== 'Draft') throw new OpeningAlreadyPublishedError();
  return { ...o, status: 'Published' };
}
