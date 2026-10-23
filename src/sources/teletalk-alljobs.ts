import type { Source } from '../lib/types';

/**
 * alljobs.teletalk.com.bd is a React SPA — there is no job HTML to scrape.
 * TODO: open DevTools > Network on /jobs/government, find the JSON endpoint
 * (XHR/fetch), put it in API_URL, then map the response in `fetch` below.
 */
const API_URL = '';

export const teletalkAlljobs: Source = {
  id: 'teletalk-alljobs',
  name: 'Teletalk Alljobs (Government)',
  homepage: 'https://alljobs.teletalk.com.bd/jobs/government',
  async fetch({ get }) {
    if (!API_URL) throw new Error('API endpoint not configured yet');
    const json = (await (await get(API_URL)).json()) as any;
    return (json.data ?? []).map((j: any) => ({
      title: j.title,
      organization: j.organization?.name,
      url: `https://alljobs.teletalk.com.bd/jobs/government/${j.organization_id}`,
      publishedAt: j.published_at?.slice(0, 10),
      deadline: j.deadline?.slice(0, 10),
      category: 'job' as const,
    }));
  },
};
