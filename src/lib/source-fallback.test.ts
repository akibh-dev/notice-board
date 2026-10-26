import { expect, test } from 'vitest';
import { selectSourceFallback } from './source-fallback';
import type { Dataset, Source } from './types';

const source: Source = {
  id: 'bb-erecruitment', name: 'BB', homepage: 'https://erecruitment.bb.org.bd/',
  fetch: async () => [],
  snapshot: {
    fetchedAt: '2026-10-26T10:00:00Z',
    notices: [{ title: 'Saved notice', url: 'https://erecruitment.bb.org.bd/career/saved.pdf', category: 'job' }],
  },
};

const previous = (fetchedAt: string): Dataset => ({
  generatedAt: '2026-10-26T12:00:00Z',
  sources: [{ id: source.id, fetchedAt, ok: true, stale: false, count: 1 }],
  notices: [{ id: 'old', sourceId: source.id, title: 'Deployed notice', url: 'https://erecruitment.bb.org.bd/career/deployed.pdf', category: 'job' }],
});

test('uses the checked-in snapshot when a deploy has no BB notices', () => {
  expect(selectSourceFallback(source, { generatedAt: '', notices: [], sources: [] })).toEqual(source.snapshot);
});

test('keeps a newer deployed capture instead of overwriting it with an older snapshot', () => {
  const fallback = selectSourceFallback(source, previous('2026-10-26T11:00:00Z'));
  expect(fallback?.notices[0].title).toBe('Deployed notice');
  expect(fallback?.fetchedAt).toBe('2026-10-26T11:00:00Z');
});

test('uses a newly refreshed snapshot instead of stale deployment data', () => {
  expect(selectSourceFallback(source, previous('2026-10-25T11:00:00Z'))).toEqual(source.snapshot);
});

test('does not invent fallback notices for a source without any saved data', () => {
  expect(selectSourceFallback({ ...source, snapshot: undefined }, null)).toBeUndefined();
});
