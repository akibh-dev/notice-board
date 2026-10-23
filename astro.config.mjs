import { defineConfig } from 'astro/config';

export default defineConfig({
  site: process.env.SITE_URL ?? 'https://notice-board.example.workers.dev',
  output: 'static',
  trailingSlash: 'ignore',
});
