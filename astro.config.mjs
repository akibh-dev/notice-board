/**
 * Static Astro site for board.akibh.dev (Cloudflare Workers Static Assets).
 * Same stack as akibh.dev / blog.akibh.dev: Tailwind v4 via @tailwindcss/vite,
 * hashed CSP <meta> written by Astro (no 'unsafe-inline' scripts).
 */
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'static',
  site: process.env.SITE_URL ?? 'https://board.akibh.dev',
  trailingSlash: 'always',
  // dist/404.html is served with HTTP 404 for unknown paths (wrangler `not_found_handling`)
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self' https://cloudflareinsights.com",
        "form-action 'self'",
        "base-uri 'self'",
        "object-src 'none'",
      ],
      scriptDirective: { resources: ["'self'", 'https://static.cloudflareinsights.com'] },
    },
  },
  vite: { plugins: [tailwindcss()] },
});
