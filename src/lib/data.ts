import type { Category, Dataset } from './types';
import { sources } from '../sources';

const files = import.meta.glob<Dataset>('../../data/notices.json', { eager: true, import: 'default' });

export const dataset: Dataset =
  Object.values(files)[0] ?? { generatedAt: new Date(0).toISOString(), sources: [], notices: [] };

export const sourceMeta = (id: string) => sources.find((s) => s.id === id);

export const categoryLabels: Record<Category, string> = {
  job: 'Job',
  'admit-card': 'Admit card',
  result: 'Result',
  exam: 'Exam',
  other: 'Other',
};

/** Days until deadline (negative = closed); undefined when no deadline. Deadline is end-of-day. */
export function daysLeft(deadline?: string, today = new Date()): number | undefined {
  if (!deadline) return undefined;
  const end = Date.parse(deadline) + 86_400_000;
  return Math.ceil((end - today.getTime()) / 86_400_000) - 1;
}

export function formatDate(iso?: string): string {
  if (!iso) return '';
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
