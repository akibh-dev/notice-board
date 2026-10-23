import { dataset } from '../lib/data';
const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!);
export const GET = ({ site }: { site?: URL }) =>
  new Response(
    `<?xml version="1.0"?><rss version="2.0"><channel><title>Notice Board</title><link>${site}</link><description>BD govt recruitment notices</description>` +
      dataset.notices.slice(0, 100).map((n) => `<item><title>${esc(n.title)}</title><link>${esc(n.url)}</link><guid>${n.id}</guid>${n.publishedAt ? `<pubDate>${new Date(n.publishedAt).toUTCString()}</pubDate>` : ''}</item>`).join('') +
      `</channel></rss>`,
    { headers: { 'content-type': 'application/rss+xml' } },
  );
