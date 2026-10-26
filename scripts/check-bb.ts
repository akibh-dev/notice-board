/** CI source check. Keep response bodies as artifacts when a runner gets a different page. */
import { mkdir, writeFile } from 'node:fs/promises';
import { fetchBangladeshBankJobs } from './bb-erecruitment';

await mkdir('data/bb-debug', { recursive: true });
const notices = await fetchBangladeshBankJobs(async (url, init) => {
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
if (notices.some((notice) => !notice.publishedAt || !notice.deadline)) {
  throw new Error('Bangladesh Bank notices are missing publish dates or close dates');
}
await writeFile('data/bb-debug/notices.json', JSON.stringify(notices, null, 2));
console.log(`[bb-check] ${notices.length} notices with publish dates and close dates`);
