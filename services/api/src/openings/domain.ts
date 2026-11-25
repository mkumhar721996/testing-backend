export type OpeningStatus = 'Draft' | 'Published' | 'Closed';

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

// Closing changes only the opening; applications already in progress are left alone.
export function close(o: JobOpening): JobOpening {
  if (o.status !== 'Published') throw new OpeningNotPublishedError();
  return { ...o, status: 'Closed' };
}

export function publish(o: JobOpening): JobOpening {
  if (o.status !== 'Draft') throw new OpeningAlreadyPublishedError();
  return { ...o, status: 'Published' };
}
