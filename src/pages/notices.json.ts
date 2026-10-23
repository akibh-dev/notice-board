import { dataset } from '../lib/data';
// Published so the next build can reuse it as a fallback when a source is down.
export const GET = () => new Response(JSON.stringify(dataset), { headers: { 'content-type': 'application/json' } });
