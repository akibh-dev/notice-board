import type { Dataset, Source, SourceSnapshot } from './types';

/** Keep the newest successful source capture when a live request fails. */
export function selectSourceFallback(source: Source, previous: Dataset | null): SourceSnapshot | undefined {
  const previousNotices = previous?.notices.filter((notice) => notice.sourceId === source.id) ?? [];
  const previousStatus = previous?.sources.find((status) => status.id === source.id);
  const saved = source.snapshot;
  if (previousNotices.length && previousStatus &&
      (!saved || Date.parse(previousStatus.fetchedAt) >= Date.parse(saved.fetchedAt))) {
    return { fetchedAt: previousStatus.fetchedAt, notices: previousNotices };
  }
  return saved;
}
