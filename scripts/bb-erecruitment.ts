/**
 * Fetches the two Bangladesh Bank career notice boards. The pages are PHP
 * rendered, so there is no client-side API to call: the useful notice data is
 * in the HTML tables/lists and links returned by the pages.
 *
 * Run `npm run fetch:bb` locally before committing. The shared refresh script
 * writes data/sources/bb-erecruitment.json; deployment uses that saved file.
 */
import * as cheerio from 'cheerio';
import type { Category, Notice } from '../src/lib/types';

export const BB_PAGES = [
  {
    name: 'Bangladesh Bank',
    url: 'https://erecruitment.bb.org.bd/career/jobopportunity.php',
  },
  {
    name: "Bankers' Selection Committee Secretariat (BSCS)",
    url: 'https://erecruitment.bb.org.bd/career/jobopportunity_bscs.php',
  },
] as const;

type Get = (url: string, init?: RequestInit) => Promise<Response>;

export class BangladeshBankBlockedError extends Error {
  override name = 'BangladeshBankBlockedError';
}

function normalizeDigits(value: string): string {
  return value.replace(/[০-৯]/g, (digit) => String('০১২৩৪৫৬৭৮৯'.indexOf(digit)));
}

/** Find a date in the row/card text and normalize it to YYYY-MM-DD. */
function findDate(text: string): string | undefined {
  const normalized = normalizeDigits(text);
  const patterns = [
    /\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/,
    /\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/,
  ];
  const iso = normalized.match(patterns[0]);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  const local = normalized.match(patterns[1]);
  if (local) {
    // Bangladesh Bank notice tables conventionally use DD/MM/YYYY.
    return `${local[3]}-${local[2].padStart(2, '0')}-${local[1].padStart(2, '0')}`;
  }

  const monthNames: Record<string, string> = {
    jan: '01', january: '01', feb: '02', february: '02', mar: '03', march: '03',
    apr: '04', april: '04', may: '05', jun: '06', june: '06', jul: '07', july: '07',
    aug: '08', august: '08', sep: '09', sept: '09', september: '09', oct: '10',
    october: '10', nov: '11', november: '11', dec: '12', december: '12',
  };
  const dmy = normalized.match(/\b(\d{1,2})[-\s]+([a-z]{3,9})[-,\s]+(20\d{2})\b/i);
  if (dmy && monthNames[dmy[2].toLowerCase()]) {
    return `${dmy[3]}-${monthNames[dmy[2].toLowerCase()]}-${dmy[1].padStart(2, '0')}`;
  }
  const mdy = normalized.match(/\b([a-z]{3,9})\s+(\d{1,2}),?\s+(20\d{2})\b/i);
  if (mdy && monthNames[mdy[1].toLowerCase()]) {
    return `${mdy[3]}-${monthNames[mdy[1].toLowerCase()]}-${mdy[2].padStart(2, '0')}`;
  }
  return undefined;
}

function categoryFor(title: string, circularFor = ''): Category {
  const value = `${circularFor} ${title}`.toLowerCase();
  if (/admit[ -]?card|প্রবেশপত্র/.test(value)) return 'admit-card';
  if (/result|selected candidate|merit list|ফলাফল|নির্বাচিত প্রার্থী/.test(value)) return 'result';
  if (/exam|test|viva|interview|seat plan|পরীক্ষা|মৌখিক/.test(value)) return 'exam';
  // Titles on the official pages often contain only the position name (for
  // example, "Assistant Director"). Treat unmatched entries as job notices.
  return 'job';
}

function cleanTitle(value: string): string {
  return value.replace(/\s+/g, ' ').replace(/\s*[|–—-]\s*$/, '').trim();
}

function resolveUrl(href: string, base: string): string | undefined {
  try {
    const url = new URL(href, base);
    if (!['http:', 'https:'].includes(url.protocol)) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

function columnIndex(headers: string[], pattern: RegExp, fallback: number): number {
  const index = headers.findIndex((header) => pattern.test(header));
  return index >= 0 ? index : fallback;
}

function parsePage(html: string, page: (typeof BB_PAGES)[number]): Omit<Notice, 'id' | 'sourceId'>[] {
  const $ = cheerio.load(html);
  const pageTitle = $('title').first().text().trim();
  if (/request rejected|access denied|forbidden/i.test(pageTitle)) {
    throw new BangladeshBankBlockedError(`Bangladesh Bank blocked the request from this network (${pageTitle}); run npm run fetch:bb from a network that can reach the site`);
  }
  const found = new Map<string, Omit<Notice, 'id' | 'sourceId'>>();
  let matchingTables = 0;

  // Use the table's semantic columns instead of guessing from arbitrary page
  // links. This excludes navigation/footer links and works if the download
  // endpoint changes its URL format (or adds query parameters).
  $('table').each((_, table) => {
    const tableRows = $(table).find('tr').toArray();
    const headerRowIndex = tableRows.findIndex((tr) => {
      const values = $(tr).children('th, td').map((___, cell) =>
        $(cell).text().replace(/\s+/g, ' ').trim(),
      ).get();
      const joined = values.join(' ');
      return /job\s*id/i.test(joined) && /circular\s*title/i.test(joined) && /publish\s*date/i.test(joined);
    });
    if (headerRowIndex < 0) return;
    const headers = $(tableRows[headerRowIndex]).children('th, td').map((__, cell) =>
      $(cell).text().replace(/\s+/g, ' ').trim(),
    ).get();
    matchingTables++;

    const titleIndex = columnIndex(headers, /circular\s*title/i, 2);
    const typeIndex = columnIndex(headers, /circular\s*for/i, 1);
    const publishIndex = columnIndex(headers, /publish\s*date/i, 4);
    const closeIndex = columnIndex(headers, /close\s*date|deadline/i, 5);

    tableRows.forEach((tr, rowIndex) => {
      if (rowIndex === headerRowIndex) return;
      const row = $(tr);
      const cells = row.children('td').map((___, cell) =>
        $(cell).text().replace(/\s+/g, ' ').trim(),
      ).get();
      const title = cleanTitle(cells[titleIndex] ?? '');
      if (title.length < 5 || /^(circular\s*title|no record found)$/i.test(title)) return;

      const candidates = row.find('a[href]').toArray().map((anchor) => {
        const link = $(anchor);
        const href = link.attr('href') ?? '';
        return {
          href,
          text: link.text().replace(/\s+/g, ' ').trim(),
          url: resolveUrl(href, page.url),
        };
      }).filter((link) => link.url);
      const download = candidates.find((link) => /\.pdf(?:$|[?#])/i.test(link.href))
        ?? candidates.find((link) => /download/i.test(link.text) || /download/i.test(link.href))
        ?? candidates[0];
      if (!download?.url) return;

      const circularFor = cells[typeIndex] ?? '';
      const notice = {
        title,
        organization: page.name === 'Bangladesh Bank' ? 'Bangladesh Bank' : undefined,
        url: download.url,
        publishedAt: findDate(cells[publishIndex] ?? ''),
        deadline: findDate(cells[closeIndex] ?? ''),
        category: categoryFor(title, circularFor),
      } satisfies Omit<Notice, 'id' | 'sourceId'>;
      const key = `${notice.url}|${notice.title}`;
      const previous = found.get(key);
      if (!previous || (!previous.publishedAt && notice.publishedAt)) found.set(key, notice);
    });
  });

  if (matchingTables === 0) {
    throw new Error(`no circular table in response from ${page.url} (title: ${pageTitle || '(none)'}, ${html.length} characters)`);
  }

  return [...found.values()];
}

/** Fetch both official career pages and return board-ready notices. */
export async function fetchBangladeshBankJobs(get: Get): Promise<Omit<Notice, 'id' | 'sourceId'>[]> {
  const results = await Promise.allSettled(BB_PAGES.map(async (page) => {
    const response = await get(page.url, {
      headers: {
        accept: 'text/html,application/xhtml+xml',
        referer: 'https://erecruitment.bb.org.bd/',
      },
    });
    const html = await response.text();
    const notices = parsePage(html, page);
    if (notices.length === 0) throw new Error(`no notices parsed from ${page.url} (page structure may have changed)`);
    console.log(`[bb-erecruitment] ${page.url}: ${notices.length} notice(s)`);
    return notices;
  }));

  const unique = new Map<string, Omit<Notice, 'id' | 'sourceId'>>();
  const errors: string[] = [];
  let blockedOnly = true;
  for (const result of results) {
    if (result.status === 'fulfilled') {
      for (const notice of result.value) unique.set(`${notice.url}|${notice.title}`, notice);
    } else {
      errors.push(String(result.reason?.message ?? result.reason));
      if (!(result.reason instanceof BangladeshBankBlockedError)) blockedOnly = false;
    }
  }
  // Never replace a complete capture with a partial one when either board fails.
  if (errors.length) {
    if (blockedOnly) throw new BangladeshBankBlockedError(errors.join('; '));
    throw new Error(errors.join('; '));
  }
  if (unique.size === 0) throw new Error('no Bangladesh Bank notices found');
  if ([...unique.values()].some((notice) => !notice.publishedAt || !notice.deadline)) {
    throw new Error('Bangladesh Bank notices are missing publish dates or close dates; saved data will not be replaced');
  }
  return [...unique.values()];
}
