# Saved notice data

Refresh sources locally, review the resulting JSON, then commit and push.
Builds and deployments read committed source files without fetching recruitment sites.

```text
data/
  sources/                       # committed source captures
    bb-erecruitment.json
    teletalk-alljobs.json
  notices.json                   # generated combined dataset; ignored by Git
```

Every source file follows this versioned format:

```json
{
  "schemaVersion": 1,
  "sourceId": "bb-erecruitment",
  "fetchedAt": "2026-10-26T10:45:20.510Z",
  "notices": [
    {
      "title": "Notice title",
      "url": "https://erecruitment.bb.org.bd/career/circular.pdf",
      "publishedAt": "2026-10-26",
      "deadline": "2026-10-29",
      "category": "job"
    }
  ]
}
```

`sourceId` matches the filename and its registered source ID in `src/sources/index.ts`.
`fetchedAt` records the successful local capture time. Notice dates use `YYYY-MM-DD`.
Notices omit generated `id` and `sourceId` fields; the dataset builder supplies them.
Optional notice fields are `organization`, `vacancies`, and `positions`.
Categories are `job`, `admit-card`, `result`, `exam`, and `other`.
Sources that do not publish dates may omit them; BB refreshes require both dates.

## Refresh before committing

```sh
npm run fetch:bb         # update only BB; fetch both official BB/BSCS pages
npm run fetch:teletalk   # update only Teletalk, when needed
npm run fetch            # update every source
git diff -- data/sources/
git add data/sources/
git commit -m "data: refresh saved notices"
git push
```

BB refreshes must run on a network that can reach Bangladesh Bank. A rejected request,
incomplete BB response, or invalid data exits with an error and leaves the previous
source file intact. Each successful source is saved with an atomic file replacement.
Updating BB does not fetch or modify the Teletalk source file.

## Build and deploy

`npm run data:build` validates every registered source file and creates `data/notices.json`.
It generates stable notice IDs, sorts notices, and preserves capture timestamps.
`generatedAt` is the latest capture time; rebuilding alone does not make the data newer.
Saved sources are healthy inputs, so intentional local captures do not show a failed-refresh warning.

`npm run build` assembles the data and builds Astro. Deployment runs this same command.
Missing or invalid source files fail the build with an actionable error; deployment never
falls back to a network fetch. Commit the source JSON files, not `data/notices.json`.
