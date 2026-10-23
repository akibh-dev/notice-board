import * as cheerio from 'cheerio';
import type { Source } from '../lib/types';

/**
 * Bangladesh Bank e-recruitment. Returned 403 from some networks during
 * scaffolding, so verify it is reachable from GitHub Actions runners.
 * TODO: confirm the notice list page and fill in selectors.
 */
const LIST_URL = 'https://erecruitment.bb.org.bd/';

export const bbErecruitment: Source = {
  id: 'bb-erecruitment',
  name: 'Bangladesh Bank e-Recruitment',
  homepage: LIST_URL,
  async fetch({ get }) {
    const $ = cheerio.load(await (await get(LIST_URL)).text());
    const rows = $('table tbody tr'); // TODO: real selector
    if (rows.length === 0) throw new Error('no rows matched — selector stale or site blocked');
    return rows
      .map((_, tr) => {
        const a = $(tr).find('a').first();
        return {
          title: a.text().trim(),
          organization: 'Bangladesh Bank',
          url: new URL(a.attr('href') ?? '', LIST_URL).href,
          category: 'job' as const,
        };
      })
      .get();
  },
};
