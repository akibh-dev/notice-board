/** CI source check. Keep response bodies as artifacts when a runner gets a different page. */
import { mkdir, writeFile } from 'node:fs/promises';
import { fetchBangladeshBankJobs, BangladeshBankBlockedError } from './bb-erecruitment';
import { bbErecruitment } from '../src/sources/bb-erecruitment';
import { selectSourceFallback } from '../src/lib/source-fallback';
import type { Notice } from '../src/lib/types';

await mkdir('data/bb-debug', { recursive: true });
let notices: Omit<Notice, 'id' | 'sourceId'>[];
let capture: { live: boolean; fetchedAt: string };
try {
  notices = await fetchBangladeshBankJobs(async (url, init) => {
    const response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(20_000),
      headers: {
        'user-agent': 'notice-board-bot/0.1 (+aggregator; links to originals)',
        ...init?.headers,
      },
    });
    const body = await response.text();
    const name = new URL(url).pathname.split('/').pop()!.replace('.php', '');
    await writeFile(`data/bb-debug/${name}.html`, body);
    const metadata = {
      requestedUrl: url,
      finalUrl: response.url,
      status: response.status,
      contentType: response.headers.get('content-type'),
      bytes: Buffer.byteLength(body),
      title: body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? null,
    };
    console.log(JSON.stringify(metadata));
    await writeFile(`data/bb-debug/${name}.json`, JSON.stringify(metadata, null, 2));
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    return new Response(body, { status: response.status });
  });
  capture = { live: true, fetchedAt: new Date().toISOString() };
} catch (error) {
  // A known network block is distinct from a changed/broken parser. Unexpected
  // response formats still fail this check and keep their HTML as artifacts.
  if (!(error instanceof BangladeshBankBlockedError)) throw error;
  const saved = selectSourceFallback(bbErecruitment, null);
  if (!saved?.notices.length) throw error;
  notices = saved.notices;
  capture = { live: false, fetchedAt: saved.fetchedAt };
  console.log(`[bb-check] live requests blocked; using saved capture from ${saved.fetchedAt}`);
}
if (notices.some((notice) => !notice.publishedAt || !notice.deadline)) {
  throw new Error('Bangladesh Bank notices are missing publish dates or close dates');
}
await writeFile('data/bb-debug/notices.json', JSON.stringify(notices, null, 2));
await writeFile('data/bb-debug/capture.json', JSON.stringify(capture, null, 2));
console.log(`[bb-check] ${notices.length} notices with publish dates and close dates`);
