/**
 * Fetches the two Bangladesh Bank career notice boards. The pages are PHP
 * rendered, so there is no client-side API to call: the useful notice data is
 * in the HTML tables/lists and links returned by the pages.
 *
 * Used by src/sources/bb-erecruitment.ts in the normal fetch pipeline. Run
 * `bunx tsx scripts/bb-erecruitment.ts` to write data/bb-erecruitment.json.
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

const genericLinkText = /^\[?\s*(home|about|contact|login|log ?in|register|apply online|apply now|details|view|download|বাংলা|english)\s*\]?$/i;

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

function rowTitle(cells: string[], linkText: string): string {
  if (linkText && !genericLinkText.test(linkText)) return linkText;
  const candidates = cells
    .map((cell) => cell.replace(/\s+/g, ' ').trim())
    .filter((cell) => cell.length >= 8)
    .filter((cell) => !genericLinkText.test(cell))
    .filter((cell) => !findDate(cell))
    .filter((cell) => !/^\d+$/.test(cell))
    .filter((cell) => !/^(job\s*id|serial|sl\.?\s*no\.?)\s*[:#-]?\s*\d+$/i.test(cell));
  // The notice title is usually the longest non-date cell in the row; the
  // other cells tend to be a serial, job ID, date, or download action.
  return candidates.sort((a, b) => b.length - a.length)[0] ?? '';
}

function columnIndex(headers: string[], pattern: RegExp, fallback: number): number {
  const index = headers.findIndex((header) => pattern.test(header));
  return index >= 0 ? index : fallback;
}

function parsePage(html: string, page: (typeof BB_PAGES)[number]): Omit<Notice, 'id' | 'sourceId'>[] {
  const $ = cheerio.load(html);
  const found = new Map<string, Omit<Notice, 'id' | 'sourceId'>>();

  // The two career pages link their actual circulars as PDFs in /career/.
  // Restrict to those links so footer/navigation links can never become jobs.
  const links = $('a[href]').filter((_, anchor) => {
    const href = $(anchor).attr('href') ?? '';
    const url = resolveUrl(href, page.url);
    return !!url && new URL(url).pathname.startsWith('/career/') && /\.pdf$/i.test(new URL(url).pathname);
  });
  const add = (
    anchor: { attr(name: string): string | undefined },
    text: string,
    rowText: string,
    circularFor: string,
    publishedAt?: string,
    deadline?: string,
  ) => {
    const title = cleanTitle(text);
    const href = anchor.attr('href');
    const url = href ? resolveUrl(href, page.url) : undefined;
    if (!title || title.length < 5 || genericLinkText.test(title) || !url || href?.startsWith('#')) return;
    if (url === page.url || url === 'https://erecruitment.bb.org.bd/') return;
    if (/javascript:|mailto:/i.test(href ?? '')) return;
    const parsedUrl = new URL(url);
    if (!parsedUrl.pathname.startsWith('/career/') || !/\.pdf$/i.test(parsedUrl.pathname)) return;

    // The table/list usually labels the publication date alongside its link.
    const category = categoryFor(title, circularFor);
    const notice = {
      title,
      organization: page.name === 'Bangladesh Bank' ? 'Bangladesh Bank' : undefined,
      url,
      publishedAt: publishedAt ?? findDate(rowText),
      deadline,
      category,
    };
    // Keep the most informative duplicate if a responsive/mobile template
    // repeats the same notice in a second table or list.
    const key = `${url}|${title}`;
    const previous = found.get(key);
    if (!previous || (!previous.publishedAt && notice.publishedAt)) found.set(key, notice);
  };

  links.each((_, anchor) => {
    const link = $(anchor);
    const row = link.closest('tr, li, article, .notice, .news-item');
    const context = row.length ? row : link.parent();
    const rowText = context.text().replace(/\s+/g, ' ').trim();
    const linkText = link.text().replace(/\s+/g, ' ').trim() || link.attr('title') || '';
    const cells = row.children('td').map((__, cell) => $(cell).text().replace(/\s+/g, ' ').trim()).get();
    const headerRow = row.closest('table').find('tr').filter((__, tr) => {
      const values = $(tr).find('th, td').map((___, cell) => $(cell).text().replace(/\s+/g, ' ').trim()).get();
      return /job\s*id/i.test(values.join(' ')) && /circular\s*title/i.test(values.join(' '));
    }).first();
    const headers = headerRow.find('th, td').map((__, cell) => $(cell).text().replace(/\s+/g, ' ').trim()).get();
    const titleIndex = columnIndex(headers, /circular\s*title/i, 2);
    const typeIndex = columnIndex(headers, /circular\s*for/i, 1);
    const publishIndex = columnIndex(headers, /publish\s*date/i, 4);
    const closeIndex = columnIndex(headers, /close\s*date|deadline/i, 5);
    const titleFromColumn = cells[titleIndex] ?? '';
    const title = titleFromColumn || rowTitle(cells, linkText);
    const circularFor = cells[typeIndex] ?? '';
    add(
      link,
      title,
      rowText,
      circularFor,
      findDate(cells[publishIndex] ?? ''),
      findDate(cells[closeIndex] ?? ''),
    );
  });

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
  for (const result of results) {
    if (result.status === 'fulfilled') {
      for (const notice of result.value) unique.set(`${notice.url}|${notice.title}`, notice);
    } else {
      errors.push(String(result.reason?.message ?? result.reason));
    }
  }
  if (unique.size === 0) throw new Error(errors.join('; ') || 'no Bangladesh Bank notices found');
  if (errors.length) console.warn(`[bb-erecruitment] partial fetch: ${errors.join('; ')}`);
  return [...unique.values()];
}

async function defaultGet(url: string, init?: RequestInit): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(20_000),
        headers: {
          'user-agent': 'Mozilla/5.0 (compatible; notice-board/0.1; +https://board.akibh.dev)',
          ...init?.headers,
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
      return response;
    } catch (error) {
      if (attempt >= 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
}

const invokedDirectly = /bb-erecruitment\.ts$/.test(process.argv[1] ?? '');
if (invokedDirectly) {
  const notices = await fetchBangladeshBankJobs(defaultGet);
  const { mkdir, writeFile } = await import('node:fs/promises');
  await mkdir('data', { recursive: true });
  await writeFile('data/bb-erecruitment.json', JSON.stringify({
    generatedAt: new Date().toISOString(),
    count: notices.length,
    notices,
  }, null, 2));
  console.log(`wrote data/bb-erecruitment.json (${notices.length} notices)`);
}
