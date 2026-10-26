import type { Source } from '../lib/types';
import { fetchBangladeshBankJobs, BB_PAGES } from '../../scripts/bb-erecruitment';

/** Bangladesh Bank and BSCS career notice boards, merged into one source. */
export const bbErecruitment: Source = {
  id: 'bb-erecruitment',
  name: 'Bangladesh Bank e-Recruitment',
  homepage: BB_PAGES[0].url,
  fetch: ({ get }) => fetchBangladeshBankJobs(get),
};
