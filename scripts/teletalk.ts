/**
 * scripts/teletalk.ts — fetch ALL live government jobs from Teletalk Alljobs.
 *
 * alljobs.teletalk.com.bd is a React SPA; its data comes from:
 *   GET /api/v1/published-jobs/search?searchKeyword=&page=N&limit=50
 * An empty searchKeyword returns every published job. Pages are fetched in
 * order until one comes back empty — that is the API's "no more results"
 * signal. Every job whose application deadline has already passed is dropped,
 * the rest are returned as board-ready notices.
 *
 * Used two ways:
 *   1. Deploy pipeline — src/sources/teletalk-alljobs.ts adapts this file into
 *      the Source interface, so `bun run fetch` (in the GitHub Action) merges
 *      these jobs into data/notices.json with failure isolation.
 *   2. Standalone — `bunx tsx scripts/teletalk.ts` writes data/teletalk.json
 *      so you can inspect exactly what this source produced.
 *
 * Adding another source later: copy this file under a new name
 * (scripts/<source>.ts), swap the endpoint + mapping, register an adapter in
 * src/sources/.
 */

import type { Notice } from '../src/lib/types';

const API_URL = 'https://alljobs.teletalk.com.bd/api/v1/published-jobs/search';
const PAGE_SIZE = 50;
const MAX_PAGES = 100; // safety net; the loop normally ends on the first empty page

/** The API fields we read (the response has more — see docs in PLAN.md). */
interface TeletalkJob {
  job_primary_id: number;
  job_title: string;
  org_name?: string;
  application_site_url?: string;
  published_date?: string; // ISO datetime
  deadline_date?: string; // ISO datetime
  vacancy?: string | number;
}

type Get = (url: string, init?: RequestInit) => Promise<Response>;

/** fetch() with UA, timeout and 3 retries — mirrors the ctx in scripts/fetch.ts. */
async function defaultGet(url: string, init?: RequestInit): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(20_000),
        headers: { 'user-agent': 'Mozilla/5.0 (notice-board; +https://board.akibh.dev)', ...init?.headers },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return res;
    } catch (e) {
      if (attempt >= 3) throw e;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

/**
 * Fetch every page until one returns empty, drop expired jobs, return
 * board-ready notices. `get` is injectable so src/sources can hand in the
 * shared retrying fetch context.
 */
export async function fetchTeletalkJobs(get: Get = defaultGet): Promise<Omit<Notice, 'id' | 'sourceId'>[]> {
  const now = Date.now();
  const all: TeletalkJob[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `${API_URL}?searchKeyword=&page=${page}&limit=${PAGE_SIZE}`;
    const json = (await (await get(url)).json()) as {
      govtJobs?: TeletalkJob[];
      privateJobs?: TeletalkJob[];
    };
    const jobs = [...(json.govtJobs ?? []), ...(json.privateJobs ?? [])];
    console.log(`[teletalk] page ${page}: ${jobs.length} job(s)`);
    if (jobs.length === 0) break; // ← "each page until it returns empty"
    all.push(...jobs);
  }

  // Keep only jobs whose application deadline has not expired.
  // (NaN from a missing/bad date fails the >= check, so those are dropped too.)
  const live = all.filter((j) => Date.parse(j.deadline_date ?? '') >= now);
  console.log(`[teletalk] ${all.length} fetched, ${all.length - live.length} expired dropped, ${live.length} live`);

  return live.map((j) => ({
    title: j.job_title,
    organization: j.org_name,
    url: j.application_site_url ?? 'https://alljobs.teletalk.com.bd/jobs/government',
    publishedAt: j.published_date?.slice(0, 10),
    deadline: j.deadline_date?.slice(0, 10),
    vacancies: Number(j.vacancy) || undefined,
    category: 'job' as const,
  }));
}

/* ---------- standalone runner: `bunx tsx scripts/teletalk.ts` ---------- */
const invokedDirectly = typeof process !== 'undefined' && /teletalk\.ts$/.test(process.argv[1] ?? '');
if (invokedDirectly) {
  const jobs = await fetchTeletalkJobs();
  const { mkdir, writeFile } = await import('node:fs/promises');
  await mkdir('data', { recursive: true });
  await writeFile(
    'data/teletalk.json',
    JSON.stringify({ generatedAt: new Date().toISOString(), count: jobs.length, jobs }, null, 2),
  );
  console.log(`wrote data/teletalk.json (${jobs.length} live jobs)`);
}
