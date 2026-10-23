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
  vacancies?: number;
  category: Category;
}

export interface SourceMeta {
  id: string;
  name: string;
  homepage: string;
}

export interface Source extends SourceMeta {
  /** Return all currently-listed notices. Throw on failure; the runner handles fallback. */
  fetch(ctx: FetchContext): Promise<Omit<Notice, 'id' | 'sourceId'>[]>;
}

export interface FetchContext {
  /** fetch() with timeout, UA and retry already applied */
  get(url: string, init?: RequestInit): Promise<Response>;
}

export interface SourceStatus {
  id: string;
  ok: boolean;
  /** true when the notices shown came from the previous build */
  stale: boolean;
  count: number;
  error?: string;
  fetchedAt: string;
}

export interface Dataset {
  generatedAt: string;
  sources: SourceStatus[];
  notices: Notice[];
}
