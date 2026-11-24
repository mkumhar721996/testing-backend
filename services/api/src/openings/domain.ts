export type OpeningStatus = 'Draft' | 'Published';

export interface JobOpening {
  id: string;
  title: string;
  hiringManager: { id: string; name: string };
  vacancies: number;
  status: OpeningStatus;
  createdAt: string;
}

export interface NewOpening {
  title: string;
  hiringManagerId: string;
  vacancies: number;
}

export class OpeningAlreadyPublishedError extends Error {
  constructor() {
    super('Opening is already published');
    this.name = 'OpeningAlreadyPublishedError';
  }
}

// The single guard the future application story must call to refuse applications against a Draft.
export function canAcceptApplications(o: Pick<JobOpening, 'status'>): boolean {
  return o.status === 'Published';
}

export function publish(o: JobOpening): JobOpening {
  if (o.status !== 'Draft') throw new OpeningAlreadyPublishedError();
  return { ...o, status: 'Published' };
}
