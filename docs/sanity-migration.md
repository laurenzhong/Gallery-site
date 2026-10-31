# Sanity Migration

This guide migrates the current static gallery content into Sanity documents.

## Current Migration Output

Run:

```bash
npm run cms:seed
```

Generated files are written to:

```text
sanity/seed/generated/
```

The generated folder is ignored by Git because it can be rebuilt from the current source data.

| File | Purpose |
| --- | --- |
| `all.ndjson` | All importable Sanity documents |
| `categories.ndjson` | Category documents only |
| `photos.ndjson` | Photo documents with legacy image paths and metadata |
| `stories.ndjson` | Journal/story documents |
| `site-settings.ndjson` | Site settings document |
| `page-layouts.ndjson` | Homepage and Photobalcony draggable section layouts |
| `site-copy.ndjson` | Global navigation, labels, controls, metadata, and footer copy |
| `assets-manifest.json` | Local image path manifest for the later upload step |
| `summary.json` | Generation counts and timestamp |

## Import Documents

After creating the Sanity project and filling `.env.local`, log in:

```bash
npm run cms:login
```

Generate seed data:

```bash
npm run cms:seed
```

Import into the configured dataset:

```bash
npx sanity dataset import sanity/seed/generated/all.ndjson production --replace
```

Use the dataset name from `SANITY_STUDIO_DATASET` if it is not `production`.

For an existing dataset, create the new draggable page layouts and global copy
without replacing the existing photo, story, or category documents:

```bash
npm run cms:page-content
```

The command is safe to rerun because it creates `pageLayout-home`,
`pageLayout-photobalcony`, and `siteCopy-main` only when they do not already
exist. Use `npm run cms:page-content -- --force` only when intentionally
re-seeding those three documents from the current layout baseline.

Check the remote document counts:

```bash
npm run cms:status
```

Alternatively, run the import, upload, and status checks together:

```bash
npm run cms:sync -- --limit 2
```

Remove `--limit 2` after confirming the first two uploaded images look correct.

## Image Asset Status

The seed import does not upload image binaries yet. Photo documents include:

- `legacyPublicPath`
- `legacyLocalPath`
- `dimensions`
- `sourceFilename`

This lets the frontend and Studio keep a stable migration reference before Sanity image assets are attached.

The next migration step should upload the files listed in `assets-manifest.json`, then patch each `photo.image` field with the uploaded Sanity asset reference.

## Upload Image Assets

Create a Sanity API token with write access, then add it to `.env.local`:

```bash
SANITY_WRITE_TOKEN=your_sanity_write_token
```

Validate the local files first:

```bash
npm run cms:upload-assets -- --dry-run
```

Run a small real upload first:

```bash
npm run cms:upload-assets -- --limit 2
```

If the first two photos look correct in Studio, upload the rest:

```bash
npm run cms:upload-assets
```

Check status again:

```bash
npm run cms:status
```

The script skips photos that already have `image.asset` unless `--force` is passed:

```bash
npm run cms:upload-assets -- --force
```

After each real run, a local report is written to:

```text
sanity/seed/generated/asset-upload-report.json
```

## Verification

After import:

```bash
npm run cms:dev
```

Check that the Studio contains the expected content for the current dataset:

- at least 1 category
- at least 1 photo, with every public photo having an image asset
- at least 1 story when journal content is enabled
- exactly 1 site settings document
- one `pageLayout` document for `home` and one for `photobalcony`
- one `siteCopy` singleton document

The remote counts are available from `npm run cms:status`; the generated seed
counts are only the baseline migration snapshot and should not be treated as a
live content limit.

The Studio navigation pins `Site Settings` to a single document with `_id = siteSettings-main`, the global copy to `siteCopy-main`, and the two draggable page layouts to `pageLayout-home` and `pageLayout-photobalcony`.
