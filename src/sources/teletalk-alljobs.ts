import type { Source } from '../lib/types';
import { fetchTeletalkJobs } from '../../scripts/teletalk';

/**
 * alljobs.teletalk.com.bd is a React SPA — the JSON endpoint was found via
 * DevTools > Network: /api/v1/published-jobs/search (empty keyword = all jobs).
 * Fetch/pagination/expiry logic lives in scripts/teletalk.ts so it can also be
 * run locally (`npm run fetch:teletalk` → data/sources/teletalk-alljobs.json).
 */
export const teletalkAlljobs: Source = {
  id: 'teletalk-alljobs',
  name: 'Teletalk Alljobs (Government)',
  homepage: 'https://alljobs.teletalk.com.bd/jobs/government',
  fetch: ({ get }) => fetchTeletalkJobs(get),
};
