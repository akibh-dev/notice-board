import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';
import { buildSavedDataset, readSourceData, saveSourceData } from './source-data';
import type { Notice } from './types';

const temporaryDirectories: string[] = [];
async function workspace() {
  const directory = await mkdtemp(join(tmpdir(), 'notice-board-data-'));
  temporaryDirectories.push(directory);
  return { directory, outputFile: join(directory, 'notices.json') };
}
const notice: Omit<Notice, 'id' | 'sourceId'> = {
  title: 'Example notice', url: 'https://erecruitment.bb.org.bd/career/example.pdf',
  publishedAt: '2026-10-26', deadline: '2026-10-29', category: 'job',
};
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

test('saving BB updates only its source file and uses the versioned format', async () => {
  const options = await workspace();
  await saveSourceData('teletalk-alljobs', [notice], { ...options, fetchedAt: '2026-10-25T10:00:00Z' });
  const teletalkFile = join(options.directory, 'teletalk-alljobs.json');
  const before = await readFile(teletalkFile, 'utf8');
  await saveSourceData('bb-erecruitment', [notice], { ...options, fetchedAt: '2026-10-26T10:00:00Z' });
  expect(await readFile(teletalkFile, 'utf8')).toBe(before);
  expect(await readSourceData('bb-erecruitment', options.directory)).toEqual({
    schemaVersion: 1, sourceId: 'bb-erecruitment', fetchedAt: '2026-10-26T10:00:00Z', notices: [notice],
  });
});

test('invalid refreshed data leaves the prior source capture unchanged', async () => {
  const options = await workspace();
  await saveSourceData('bb-erecruitment', [notice], options);
  const file = join(options.directory, 'bb-erecruitment.json');
  const before = await readFile(file, 'utf8');
  await expect(saveSourceData('bb-erecruitment', [{ ...notice, deadline: '2026-02-30' }], options))
    .rejects.toThrow('invalid fields');
  expect(await readFile(file, 'utf8')).toBe(before);
});

test('assembles saved sources offline, preserving capture times and stable notice IDs', async () => {
  const options = await workspace();
  await saveSourceData('bb-erecruitment', [notice], { ...options, fetchedAt: '2026-10-26T10:00:00Z' });
  await saveSourceData('teletalk-alljobs', [{ ...notice, title: 'Teletalk notice' }], {
    ...options, fetchedAt: '2026-10-25T10:00:00Z',
  });
  const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network disabled'));
  const first = await buildSavedDataset(['bb-erecruitment', 'teletalk-alljobs'], options);
  const second = await buildSavedDataset(['bb-erecruitment', 'teletalk-alljobs'], options);
  expect(network).not.toHaveBeenCalled();
  expect(second).toEqual(first);
  expect(first.generatedAt).toBe('2026-10-26T10:00:00.000Z');
  expect(first.notices).toHaveLength(2);
  expect(first.notices.every((n) => n.id.startsWith(`${n.sourceId}:`))).toBe(true);
  expect(first.sources[1]).toMatchObject({ ok: true, stale: false, fetchedAt: '2026-10-25T10:00:00Z' });
});

test('missing source data fails without overwriting the generated dataset or fetching remotely', async () => {
  const options = await workspace();
  await saveSourceData('bb-erecruitment', [notice], options);
  await writeFile(options.outputFile, 'previous dataset');
  const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network disabled'));
  await expect(buildSavedDataset(['bb-erecruitment', 'teletalk-alljobs'], options))
    .rejects.toThrow('Refresh locally');
  expect(await readFile(options.outputFile, 'utf8')).toBe('previous dataset');
  expect(network).not.toHaveBeenCalled();
});

test('rejects wrong schema versions and mismatched source IDs in committed files', async () => {
  const options = await workspace();
  await writeFile(join(options.directory, 'bb-erecruitment.json'), JSON.stringify({
    schemaVersion: 2, sourceId: 'another-source', fetchedAt: '2026-10-26T10:00:00Z', notices: [notice],
  }));
  await expect(readSourceData('bb-erecruitment', options.directory)).rejects.toThrow('expected schemaVersion 1');
});
