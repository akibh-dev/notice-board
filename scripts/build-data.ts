/** Offline: validate committed source files and generate the site's combined dataset. */
import { buildSavedDataset } from '../src/lib/source-data';
import { sources } from '../src/sources';

const dataset = await buildSavedDataset(sources.map((source) => source.id));
console.log(`assembled ${dataset.notices.length} notices from ${dataset.sources.length} saved source files (no network requests)`);
