import type { Source, SourceSnapshot } from '../lib/types';
import { fetchBangladeshBankJobs, BB_PAGES } from '../../scripts/bb-erecruitment';
import snapshot from './snapshots/bb-erecruitment.json';

/** Bangladesh Bank and BSCS career notice boards, merged into one source. */
export const bbErecruitment: Source = {
  id: 'bb-erecruitment',
  name: 'Bangladesh Bank e-Recruitment',
  homepage: BB_PAGES[0].url,
  fetch: ({ get }) => fetchBangladeshBankJobs(get),
  snapshot: snapshot as SourceSnapshot,
};
