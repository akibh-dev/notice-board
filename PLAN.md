# Notice Board — Plan

Static Astro 7 site (Node 24, Tailwind v4) at **board.akibh.dev** listing Bangladesh government recruitment notices (Teletalk Alljobs, BB e-Recruitment, …), deployed to Cloudflare.

## Architecture
```
sources (src/sources/*.ts)  →  scripts/fetch.ts  →  data/notices.json  →  astro build  →  dist/  →  Cloudflare
```
- **Source adapter** = one file exporting `{id, name, homepage, fetch()}`; register in `src/sources/index.ts`.
- **Fetch step** runs in CI before build (and locally via `npm run fetch`). Sources run in parallel, 20s timeout, 3 retries.
- **Failure isolation:** if a source fails, its notices from the *previous deploy* (downloaded from `$SITE_URL/notices.json`) are reused and flagged stale on the page. Build only fails if zero notices total.
- **Output:** one page `/` (a single table: Notice · Source · Posted · Deadline · Link → official URL), `404.html`, plus `/notices.json` (also the fallback cache) and `/feed.xml`. Search, source/type filters, hide-closed, sortable headers and live "days left" chips are vanilla TS (state kept in the URL). No framework.
- **Design:** tokens, fonts, watermark, segmented rail, theme switch and the rustc-style 404 are copied from `../akiblog/apps/blog` (global.css §1–7) so it matches akibh.dev / blog.akibh.dev. Board-only styles are §8 of `src/styles/global.css`.
- **Hosting:** Cloudflare Workers Static Assets (`wrangler.jsonc` → `./dist`). No server code.

## Deploy
`.github/workflows/deploy.yml`: **`workflow_dispatch` only** (Actions → Deploy → Run workflow). No push or schedule trigger.
Secrets: `CLOUDFLARE_API_TOKEN` (Workers edit + zone DNS/Workers routes for akibh.dev), `CLOUDFLARE_ACCOUNT_ID`. `wrangler.jsonc` attaches the `board.akibh.dev` custom domain on deploy.

## Open risks (verified while scaffolding)
1. **Teletalk Alljobs is a React SPA** — no HTML to scrape. Need to find its JSON endpoint via DevTools (Network tab on `/jobs/government`). Stub in `teletalk-alljobs.ts`.
2. **erecruitment.bb.org.bd returned 403 / "maintenance"** from my network. Check it works from GitHub runners; if geo-blocked, options: self-hosted runner, a Cloudflare Worker proxy, or a scheduled local fetch that commits data.
3. Respect each site's ToS/robots; always link to the original and never rehost PDFs.

## Roadmap
1. Implement the two sources (endpoint discovery) — add a recorded-response test per source in `src/sources/__fixtures__`.
2. Add sources: other bank/commission/BPSC/DPE circulars, one file each.
3. UI: category + source filters, "closing soon", Bangla labels, dark mode (already via `color-scheme`).
4. Dedupe notices across sources; archive expired items after N days.
5. Optional: Cloudflare cron Worker to trigger the GitHub dispatch for more frequent refresh.

## Commands
`npm run fetch` · `npm run fetch:fixtures` (fake data) · `npm run dev` · `npm run build` · `npm test` · `npm run deploy`
