import type { Source } from '../lib/types';
import { teletalkAlljobs } from './teletalk-alljobs';
import { bbErecruitment } from './bb-erecruitment';

/** Add a new source = write one file + list it here. */
export const sources: Source[] = [teletalkAlljobs, bbErecruitment];
