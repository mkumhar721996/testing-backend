import { describe, expect, it } from 'vitest';
import {
  canAcceptApplications,
  close,
  OpeningAlreadyPublishedError,
  OpeningNotPublishedError,
  publish,
  type JobOpening,
} from '../../src/openings/domain.js';

const draft: JobOpening = {
  id: 'o1',
  title: 'Designer',
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

  it('throws when publishing a Published opening', () => {
    const published = publish(draft);
    expect(() => publish({ ...published })).toThrow(OpeningAlreadyPublishedError);
  });
});

describe('closing an opening', () => {
  it('refuses applications once Closed and only closes a Published opening', () => {
    const published = publish(draft);
    expect(canAcceptApplications(close(published))).toBe(false);
    expect(close(published).status).toBe('Closed');
    expect(() => close(draft)).toThrow(OpeningNotPublishedError);
    expect(() => close(close(published))).toThrow(OpeningNotPublishedError);
  });
});
