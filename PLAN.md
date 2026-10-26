# Notice Board — Plan

Static Astro 7 site (Node 24, Tailwind v4) at **board.akibh.dev** listing Bangladesh government recruitment notices (Teletalk Alljobs, BB e-Recruitment, …), deployed to Cloudflare.

## Architecture
```
local refresh → data/sources/*.json (committed) → scripts/build-data.ts (offline) → data/notices.json → Astro → dist/ → Cloudflare
```
- **Source adapter** = one file exporting `{id, name, homepage, fetch()}`; register in `src/sources/index.ts`.
- **Local refresh:** `npm run fetch:bb` refreshes only BB. `npm run fetch:teletalk` refreshes only Teletalk; `npm run fetch` refreshes both in parallel. Requests have a 20s timeout and 3 retries.
- **Saved source format:** `data/sources/<source-id>.json` contains `schemaVersion`, `sourceId`, `fetchedAt`, and normalized `notices`. Successful captures replace their files atomically. Failed refreshes exit nonzero and keep the previous file. See [data/README.md](data/README.md).
- **Offline build:** `npm run build` validates saved sources, generates stable notice IDs, assembles `data/notices.json`, and builds Astro. Missing or invalid saved files fail the build; no recruitment-site or previous-deployment requests are made. Capture times remain unchanged across builds, and the dataset's `generatedAt` is the latest source capture time.
- **Output:** one page `/` (a single table: Notice · Source · Posted · Deadline · Link → official URL), `404.html`, plus `/notices.json` (also the fallback cache) and `/feed.xml`. Search, source/type filters, hide-closed, sortable headers and live "days left" chips are vanilla TS (state kept in the URL). No framework.
- **Design:** tokens, fonts, watermark, segmented rail, theme switch and the rustc-style 404 are copied from `../akiblog/apps/blog` (global.css §1–7) so it matches akibh.dev / blog.akibh.dev. Board-only styles are §8 of `src/styles/global.css`.
- **Hosting:** Cloudflare Pages — static `dist/` uploaded by `wrangler pages deploy`. No server code.

## Deploy
`.github/workflows/deploy.yml`: push to `main` or manual (Actions → Deploy → Run workflow). Builds in CI with bun (tests → offline data assembly and build), then `wrangler pages deploy dist --branch=main`; the Pages project `notice-board` is auto-created on first run. Refresh and commit source JSON locally before pushing data updates.
Secrets: `CLOUDFLARE_API_TOKEN` (Cloudflare Pages: Edit), `CLOUDFLARE_ACCOUNT_ID`. Custom domain `board.akibh.dev` is attached once in the dashboard (Pages → notice-board → Custom domains); zone is on the same account so SSL is automatic.

## Open risks (verified while scaffolding)
1. **Teletalk Alljobs is a React SPA:** local refresh uses `GET /api/v1/published-jobs/search?searchKeyword=&page=N&limit=50` via `scripts/teletalk.ts`, paginating until an empty page and dropping expired deadlines. Saved data is `data/sources/teletalk-alljobs.json`.
2. **Bangladesh Bank blocks GitHub-hosted runners:** confirmed HTTP 200, 246 bytes, `<title>Request Rejected</title>`. Local requests return real tables. `npm run fetch:bb` saves both boards to `data/sources/bb-erecruitment.json`; deployment uses that committed capture directly. Recorded-response tests cover the real markup and block page. Both pages and their dates must validate before the BB file is replaced.
3. Respect each site's ToS/robots; always link to the original and never rehost PDFs.

## Roadmap
1. Add recorded-response coverage for Teletalk parsing.
2. Add sources: other bank/commission/BPSC/DPE circulars, one file each.
3. UI: category + source filters, "closing soon", Bangla labels, dark mode (already via `color-scheme`).
4. Dedupe notices across sources; archive expired items after N days.

## Commands
`npm run fetch:bb` · `npm run fetch:teletalk` · `npm run fetch` · `npm run data:build` · `npm run dev` · `npm run build` · `npm test` · `npm run deploy`

## Refreshing Bangladesh Bank data
Run `npm run fetch:bb` from a network that can load the official career pages. Review and commit `data/sources/bb-erecruitment.json`, then push. This command does not request or change Teletalk data. Use `npm run fetch` when both sources need refreshing. Full instructions and the saved format are in [data/README.md](data/README.md).

`.github/workflows/data-check.yml` runs tests, Astro checks, and the offline build on feature pushes and PRs. It validates committed source data without fetching either recruitment website or deploying.
