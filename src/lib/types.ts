export type Category = 'job' | 'admit-card' | 'result' | 'exam' | 'other';

export interface Notice {
  /** Stable id: `${sourceId}:${hash(url|title)}` */
  id: string;
  sourceId: string;
  title: string;
  /** Hiring organization, if the source exposes it */
  organization?: string;
  /** Link to the original notice/circular — always points to the official site */
  url: string;
  /** ISO date (YYYY-MM-DD) */
  publishedAt?: string;
  /** Application deadline, ISO date */
  deadline?: string;
  /** Total posts/vacancies across the whole notice */
  vacancies?: number;
  /** Distinct job positions in the notice (when the source lists per-position) */
  positions?: number;
  category: Category;
}

export interface SourceMeta {
  id: string;
  name: string;
  homepage: string;
}

export interface Source extends SourceMeta {
  /** Used only by local refresh commands. Deployments read saved files. */
  fetch(ctx: FetchContext): Promise<Omit<Notice, 'id' | 'sourceId'>[]>;
}

/** Versioned, committed data/sources/<sourceId>.json file. */
export interface SavedSourceData {
  schemaVersion: 1;
  sourceId: string;
  fetchedAt: string;
  notices: Omit<Notice, 'id' | 'sourceId'>[];
}

export interface FetchContext {
  /** fetch() with timeout, UA and retry already applied */
  get(url: string, init?: RequestInit): Promise<Response>;
}

export interface SourceStatus {
  id: string;
  ok: boolean;
  /** Whether an attempted refresh failed; normal saved-data builds are healthy. */
  stale: boolean;
  count: number;
  error?: string;
  fetchedAt: string;
}

export interface Dataset {
  /** Most recent source capture, preserved across builds until data changes. */
  generatedAt: string;
  sources: SourceStatus[];
  notices: Notice[];
}
