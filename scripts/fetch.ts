/** Local refresh only. Save each successful source atomically, then assemble the site data. */
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { sources } from '../src/sources';
import { fixtureNotices } from '../src/sources/fixtures';
import { buildSavedDataset, saveSourceData } from '../src/lib/source-data';
import type { Dataset, FetchContext } from '../src/lib/types';

const ctx: FetchContext = {
  async get(url, init) {
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
  },
};

async function main() {
  if (process.argv.includes('--fixtures')) {
    // Preview fixtures never overwrite committed source files.
    const now = new Date().toISOString();
    const notices = fixtureNotices.map((notice) => ({
      ...notice,
      id: `${notice.sourceId}:${createHash('sha1').update(notice.url + notice.title).digest('hex').slice(0, 12)}`,
    }));
    const dataset: Dataset = {
      generatedAt: now,
      sources: sources.map((source) => ({
        id: source.id, ok: true, stale: false, fetchedAt: now,
        count: notices.filter((notice) => notice.sourceId === source.id).length,
      })),
      notices,
    };
    await mkdir('data', { recursive: true });
    await writeFile('data/notices.json', JSON.stringify(dataset, null, 2) + '\n');
    console.log(`wrote ${notices.length} fixture notices (saved source files unchanged)`);
    return;
  }

  const flag = process.argv.indexOf('--source');
  const sourceId = flag >= 0 ? process.argv[flag + 1] : undefined;
  if (flag >= 0 && !sourceId) throw new Error('--source requires a registered source ID');
  const selected = sourceId ? sources.filter((source) => source.id === sourceId) : sources;
  if (!selected.length) throw new Error(`Unknown source: ${sourceId}`);

  const results = await Promise.allSettled(selected.map(async (source) => {
    const notices = await source.fetch(ctx);
    const saved = await saveSourceData(source.id, notices);
    console.log(`[${source.id}] saved ${notices.length} notices to data/sources/${source.id}.json at ${saved.fetchedAt}`);
  }));
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error(`[${selected[index].id}] refresh failed; previous saved file unchanged: ${result.reason?.message ?? result.reason}`);
      process.exitCode = 1;
    }
  });

  const dataset = await buildSavedDataset(sources.map((source) => source.id));
  console.log(`assembled ${dataset.notices.length} notices from saved source files`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});
