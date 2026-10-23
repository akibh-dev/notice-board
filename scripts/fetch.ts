/**
 * Pulls every source, merges with last deploy's data on failure, writes data/notices.json.
 * A failing source never fails the build: its previous notices are kept and flagged stale.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { sources } from '../src/sources';
import { fixtureNotices } from '../src/sources/fixtures';
import type { Dataset, FetchContext, Notice, SourceStatus } from '../src/lib/types';

const useFixtures = process.argv.includes('--fixtures');
const SITE_URL = process.env.SITE_URL;

const ctx: FetchContext = {
  async get(url, init) {
    for (let attempt = 1; ; attempt++) {
      try {
        const res = await fetch(url, {
          ...init,
          signal: AbortSignal.timeout(20_000),
          headers: { 'user-agent': 'notice-board-bot/0.1 (+aggregator; links to originals)', ...init?.headers },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
        return res;
      } catch (e) {
        if (attempt >= 3) throw e;
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  },
};

const mkId = (sourceId: string, n: { url: string; title: string }) =>
  `${sourceId}:${createHash('sha1').update(n.url + n.title).digest('hex').slice(0, 12)}`;

async function loadPrevious(): Promise<Dataset | null> {
  if (!SITE_URL) return null;
  try {
    const res = await fetch(new URL('/notices.json', SITE_URL), { signal: AbortSignal.timeout(10_000) });
    return res.ok ? ((await res.json()) as Dataset) : null;
  } catch {
    return null;
  }
}

async function main() {
  const now = new Date().toISOString();
  const statuses: SourceStatus[] = [];
  let notices: Notice[] = [];

  if (useFixtures) {
    notices = fixtureNotices.map((n) => ({ ...n, id: mkId(n.sourceId, n) }));
    sources.forEach((s) => statuses.push({ id: s.id, ok: true, stale: false, count: notices.filter((n) => n.sourceId === s.id).length, fetchedAt: now }));
  } else {
    const previous = await loadPrevious();
    const results = await Promise.allSettled(sources.map((s) => s.fetch(ctx)));
    results.forEach((r, i) => {
      const s = sources[i];
      if (r.status === 'fulfilled') {
        const list = r.value.map((n) => ({ ...n, sourceId: s.id, id: mkId(s.id, n) }));
        notices.push(...list);
        statuses.push({ id: s.id, ok: true, stale: false, count: list.length, fetchedAt: now });
      } else {
        const old = previous?.notices.filter((n) => n.sourceId === s.id) ?? [];
        notices.push(...old);
        const prevStatus = previous?.sources.find((x) => x.id === s.id);
        statuses.push({ id: s.id, ok: false, stale: old.length > 0, count: old.length, error: String(r.reason?.message ?? r.reason), fetchedAt: prevStatus?.fetchedAt ?? now });
        console.error(`[${s.id}] failed: ${r.reason?.message ?? r.reason}`);
      }
    });
  }

  notices.sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));
  const dataset: Dataset = { generatedAt: now, sources: statuses, notices };
  await mkdir('data', { recursive: true });
  await writeFile('data/notices.json', JSON.stringify(dataset, null, 2));
  console.log(`wrote ${notices.length} notices; ${statuses.filter((s) => !s.ok).length} source(s) failed`);
  // Fail only if nothing at all could be produced.
  if (notices.length === 0 && !useFixtures) process.exitCode = 1;
}

main();
