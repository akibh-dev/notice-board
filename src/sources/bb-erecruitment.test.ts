import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { BangladeshBankBlockedError, BB_PAGES, fetchBangladeshBankJobs } from '../../scripts/bb-erecruitment';

const fixture = (name: string) => readFileSync(new URL(`./__fixtures__/${name}.html`, import.meta.url), 'utf8');
const bb = fixture('bb-career');
const bscs = fixture('bb-bscs');
const rejected = fixture('bb-rejected');

test('parses both recorded tables, including dates after unclosed download anchors', async () => {
  const notices = await fetchBangladeshBankJobs(async (url) =>
    new Response(url === BB_PAGES[0].url ? bb : bscs),
  );
  expect(notices).toHaveLength(19);
  expect(notices.every((notice) => notice.publishedAt && notice.deadline)).toBe(true);
  expect(notices.find((notice) => notice.title.includes('Job ID-26102'))).toMatchObject({
    title: 'Download Admit Card for the post of Officer (General) (Job ID-26102) of 07 Banks and 2 FIs',
    publishedAt: '2026-10-26',
    deadline: '2026-10-29',
    category: 'admit-card',
    url: 'https://erecruitment.bb.org.bd/career/20261026_bscs_346_1793006823.pdf',
  });
  expect(notices.some((notice) => notice.title.includes('Site Map') || notice.title === '[download]')).toBe(false);
});

test('recognizes the HTTP 200 Request Rejected response captured on GitHub', async () => {
  await expect(fetchBangladeshBankJobs(async () => new Response(rejected)))
    .rejects.toBeInstanceOf(BangladeshBankBlockedError);
});

test('rejects a partial capture so it cannot erase the other board from a snapshot', async () => {
  await expect(fetchBangladeshBankJobs(async (url) =>
    new Response(url === BB_PAGES[0].url ? bb : rejected),
  )).rejects.toBeInstanceOf(BangladeshBankBlockedError);
});

test('a changed page is a parser failure rather than a known network block', async () => {
  try {
    await fetchBangladeshBankJobs(async () => new Response('<title>Career Opportunity</title><p>Changed layout</p>'));
    expect.fail('expected the parser to reject the missing table');
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(BangladeshBankBlockedError);
    expect((error as Error).message).toContain('no circular table');
  }
});
