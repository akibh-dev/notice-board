import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Dataset, Notice, SavedSourceData } from './types';

const categories = new Set(['job', 'admit-card', 'result', 'exam', 'other']);
const defaultDirectory = 'data/sources';
type SourceNotice = Omit<Notice, 'id' | 'sourceId'>;

function sourcePath(sourceId: string, directory: string): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(sourceId)) throw new Error(`Invalid source ID: ${sourceId}`);
  return join(directory, `${sourceId}.json`);
}

function validDay(value: unknown): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value;
}

/** Validate before replacing saved data or using edited files in a deployment. */
export function validateSourceData(value: unknown, sourceId: string): SavedSourceData {
  if (!value || typeof value !== 'object') throw new Error(`${sourceId}: invalid saved data`);
  const data = value as Record<string, unknown>;
  if (data.schemaVersion !== 1 || data.sourceId !== sourceId ||
      typeof data.fetchedAt !== 'string' || !Number.isFinite(Date.parse(data.fetchedAt)) ||
      !Array.isArray(data.notices)) {
    throw new Error(`${sourceId}: expected schemaVersion 1, matching sourceId, fetchedAt, and notices`);
  }
  for (const [index, notice] of data.notices.entries()) {
    if (!notice || typeof notice !== 'object') throw new Error(`${sourceId}: invalid notice ${index}`);
    const n = notice as Record<string, unknown>;
    let url: URL;
    try {
      url = new URL(String(n.url));
    } catch {
      throw new Error(`${sourceId}: invalid URL in notice ${index}`);
    }
    if (typeof n.title !== 'string' || !n.title.trim() ||
        !['http:', 'https:'].includes(url.protocol) || !categories.has(String(n.category)) ||
        (n.organization !== undefined && typeof n.organization !== 'string') ||
        (n.publishedAt !== undefined && !validDay(n.publishedAt)) ||
        (n.deadline !== undefined && !validDay(n.deadline)) ||
        ['positions', 'vacancies'].some((field) => n[field] !== undefined &&
          (typeof n[field] !== 'number' || !Number.isSafeInteger(n[field]) || (n[field] as number) < 0))) {
      throw new Error(`${sourceId}: invalid fields in notice ${index}`);
    }
  }
  return value as SavedSourceData;
}

async function writeJsonAtomic(file: string, data: unknown): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(data, null, 2) + '\n');
    await rename(temporary, file);
  } finally {
    await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
}

export async function saveSourceData(
  sourceId: string,
  notices: SourceNotice[],
  options: { directory?: string; fetchedAt?: string } = {},
): Promise<SavedSourceData> {
  const data = validateSourceData({
    schemaVersion: 1,
    sourceId,
    fetchedAt: options.fetchedAt ?? new Date().toISOString(),
    notices,
  }, sourceId);
  await writeJsonAtomic(sourcePath(sourceId, options.directory ?? defaultDirectory), data);
  return data;
}

export async function readSourceData(sourceId: string, directory = defaultDirectory): Promise<SavedSourceData> {
  const file = sourcePath(sourceId, directory);
  try {
    return validateSourceData(JSON.parse(await readFile(file, 'utf8')), sourceId);
  } catch (error) {
    throw new Error(`Cannot use ${file}: ${(error as Error).message}. Refresh locally with npm run fetch before committing.`);
  }
}

/** Assemble only committed local files. This function never makes network requests. */
export async function buildSavedDataset(
  sourceIds: string[],
  options: { directory?: string; outputFile?: string } = {},
): Promise<Dataset> {
  if (!sourceIds.length) throw new Error('No sources configured');
  const saved = await Promise.all(sourceIds.map((id) => readSourceData(id, options.directory)));
  const dataset: Dataset = {
    generatedAt: new Date(Math.max(...saved.map((data) => Date.parse(data.fetchedAt)))).toISOString(),
    sources: saved.map((data) => ({
      id: data.sourceId, ok: true, stale: false, count: data.notices.length, fetchedAt: data.fetchedAt,
    })),
    notices: saved.flatMap((data) => data.notices.map((notice) => ({
      ...notice,
      sourceId: data.sourceId,
      id: `${data.sourceId}:${createHash('sha1').update(notice.url + notice.title).digest('hex').slice(0, 12)}`,
    }))),
  };
  dataset.notices.sort((a, b) =>
    (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '') || a.id.localeCompare(b.id),
  );
  await writeJsonAtomic(options.outputFile ?? 'data/notices.json', dataset);
  return dataset;
}
