export interface Application {
  id: string;
  openingId: string;
  openingTitle: string;
  candidateName: string;
  /** Trimmed and lower-cased; the candidate key until intake defines a candidate record. */
  candidateEmail: string;
  createdAt: string;
}

export interface NewApplication {
  openingId: string;
  candidateName: string;
  candidateEmail: string;
  confirmAdditionalOpening?: boolean;
}

export type CreateApplicationResult =
  | Application
  | 'opening_not_found'
  | 'opening_not_published'
  | 'confirmation_required';

export const normaliseEmail = (email: string): string => email.trim().toLowerCase();
