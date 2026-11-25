import { describe, expect, it } from 'vitest';
import {
  applyEdit,
  canAcceptApplications,
  OpeningAlreadyPublishedError,
  VacanciesLockedError,
  publish,
  type JobOpening,
} from '../../src/openings/domain.js';

const draft: JobOpening = {
  id: 'o1',
  title: 'Designer',
  description: '',
  hiringManager: { id: 'm1', name: 'Ada' },
  vacancies: 1,
  status: 'Draft',
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('opening domain', () => {
  it('refuses applications against a Draft and accepts them once Published', () => {
    expect(canAcceptApplications({ status: 'Draft' })).toBe(false);
    expect(canAcceptApplications({ status: 'Published' })).toBe(true);
  });

  it('publishes a Draft', () => {
    expect(publish(draft).status).toBe('Published');
  });

  it('applies an edit to a Draft including vacancies', () => {
    expect(applyEdit(draft, { title: 'X', vacancies: 4 })).toMatchObject({ title: 'X', vacancies: 4 });
  });

  it('refuses a vacancy change on a Published opening (AC4)', () => {
    const published = { ...publish(draft), vacancies: 3 };
    expect(() => applyEdit(published, { vacancies: 5 })).toThrow(VacanciesLockedError);
    expect(applyEdit(published, { title: 'Y' }).title).toBe('Y');
  });

  it('throws when publishing a Published opening', () => {
    const published = publish(draft);
    expect(() => publish({ ...published })).toThrow(OpeningAlreadyPublishedError);
  });
});
