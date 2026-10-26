# Notice Board — Plan

Static Astro 7 site (Node 24, Tailwind v4) at **board.akibh.dev** listing Bangladesh government recruitment notices (Teletalk Alljobs, BB e-Recruitment, …), deployed to Cloudflare.

## Architecture
```
sources (src/sources/*.ts)  →  scripts/fetch.ts  →  data/notices.json  →  astro build  →  dist/  →  Cloudflare
```
- **Source adapter** = one file exporting `{id, name, homepage, fetch()}`; register in `src/sources/index.ts`.
- **Fetch step** runs in CI before build (and locally via `npm run fetch`). Sources run in parallel, 20s timeout, 3 retries.
- **Failure isolation:** if a source fails, keep the newest successful capture from the previous deploy (`$SITE_URL/notices.json`) or the source's checked-in snapshot. Preserve the original capture timestamp and flag it stale. Build only fails if zero notices total.
- **Output:** one page `/` (a single table: Notice · Source · Posted · Deadline · Link → official URL), `404.html`, plus `/notices.json` (also the fallback cache) and `/feed.xml`. Search, source/type filters, hide-closed, sortable headers and live "days left" chips are vanilla TS (state kept in the URL). No framework.
- **Design:** tokens, fonts, watermark, segmented rail, theme switch and the rustc-style 404 are copied from `../akiblog/apps/blog` (global.css §1–7) so it matches akibh.dev / blog.akibh.dev. Board-only styles are §8 of `src/styles/global.css`.
- **Hosting:** Cloudflare Pages — static `dist/` uploaded by `wrangler pages deploy`. No server code.

## Deploy
`.github/workflows/deploy.yml`: push to `main` or manual (Actions → Deploy → Run workflow). Builds in CI with bun (test → fetch → build), then `wrangler pages deploy dist --branch=main`; the Pages project `notice-board` is auto-created on first run.
Secrets: `CLOUDFLARE_API_TOKEN` (Cloudflare Pages: Edit), `CLOUDFLARE_ACCOUNT_ID`. Custom domain `board.akibh.dev` is attached once in the dashboard (Pages → notice-board → Custom domains); zone is on the same account so SSL is automatic.

## Open risks (verified while scaffolding)
1. ~~**Teletalk Alljobs is a React SPA**~~ **SOLVED:** JSON endpoint found via DevTools → Network: `GET /api/v1/published-jobs/search?searchKeyword=&page=N&limit=50`. Implemented in `scripts/teletalk.ts` (paginates until an empty page, drops expired deadlines); `src/sources/teletalk-alljobs.ts` is a thin adapter over it. Run standalone: `bunx tsx scripts/teletalk.ts` → `data/teletalk.json`.
2. **Bangladesh Bank blocks GitHub-hosted runners.** Confirmed by downloading the runner response: HTTP 200, 246 bytes, `<title>Request Rejected</title>`. Local requests return real tables, and recorded-response tests cover the actual markup and block page. A saved capture in `src/sources/snapshots/bb-erecruitment.json` keeps BB notices available during deploys, with `ok: false`, `stale: true`, and its original `fetchedAt`. A snapshot is not a fresh live fetch.
3. Respect each site's ToS/robots; always link to the original and never rehost PDFs.

## Roadmap
1. Automate BB snapshot refreshes on a machine/network that can reach the site.
2. Add sources: other bank/commission/BPSC/DPE circulars, one file each.
3. UI: category + source filters, "closing soon", Bangla labels, dark mode (already via `color-scheme`).
4. Dedupe notices across sources; archive expired items after N days.
5. Optional: Cloudflare cron Worker to trigger the GitHub dispatch for more frequent refresh.

## Commands
`npm run fetch` · `npm run fetch:bb:snapshot` · `npm run fetch:fixtures` (fake data) · `npm run dev` · `npm run build` · `npm test` · `npm run deploy`

## Refreshing Bangladesh Bank data
Run `npm run fetch:bb:snapshot` from a network that can load the official career pages. It fetches both boards, checks publish/close dates, and atomically updates the tracked snapshot only after both succeed. Commit that JSON change through a PR to `main` for the next deployment. If the command fails, the previous snapshot is kept. CI cannot refresh this snapshot while its network is blocked; fresh automated captures require a local scheduled job or a runner on a reachable network.

`.github/workflows/bb-source-check.yml` runs on feature pushes and PRs before merging. It records the runner's response, checks the parser and fallback tests, verifies BB notices and dates in the final dataset, and builds the site without deploying. Response artifacts expire after three days. An explicitly recognized block may use the dated snapshot; other parser errors fail the source check.
