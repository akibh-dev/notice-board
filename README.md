# Notice Board

Bangladesh government recruitment notices from Bangladesh Bank/BSCS and Teletalk.

## Before committing data updates

```sh
npm install
npm run prepare:commit
git diff -- data/sources/
git add data/sources/
git commit -m "data: refresh saved notices"
git push
```

`prepare:commit` refreshes both sources locally, validates the files, runs checks and
tests, and builds the app. It does not run Git commands.

To refresh a single source, use `npm run fetch:bb` or `npm run fetch:teletalk`.
`npm run fetch` refreshes both without running the remaining checks.

## Saved data and deployment

```text
data/
  sources/
    bb-erecruitment.json     # commit this
    teletalk-alljobs.json    # commit this
  notices.json              # generated; do not commit
```

Every source file includes `schemaVersion`, `sourceId`, `fetchedAt`, and `notices`.
A failed refresh preserves its previous file. See [the saved-data format](data/README.md).

GitHub Actions runs tests and `npm run build`. The build validates and combines the
committed source files and generates the static site. It does not fetch either
recruitment website. New notices appear after you refresh and commit the source files.

## Local preview

```sh
npm run dev
# or preview a production build:
npm run build
npm run preview
```
