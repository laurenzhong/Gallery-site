# Queenstown.top Photography Archive

Personal photography archive built with React, TypeScript, and Vite. The site presents large-format galleries, a Balcony View series, an About page, a Journal page, and a preserved `/photostory` preview module for testing richer photo notes.

## Local Development

```bash
npm run dev
```

The dev script runs `sync:photos` first, then starts Vite.

## CMS Admin

This project uses Sanity Studio for the admin CMS. Create a Sanity project, copy `.env.example` to `.env.local`, and fill in:

```bash
SANITY_STUDIO_PROJECT_ID=your_sanity_project_id
SANITY_STUDIO_DATASET=production
VITE_SANITY_PROJECT_ID=your_sanity_project_id
VITE_SANITY_DATASET=production
```

Run the Studio locally:

```bash
npm run cms:dev
```

Build the Studio:

```bash
npm run cms:build
```

Generate Sanity seed data from the current static content:

```bash
npm run cms:seed
```

Validate the local image upload manifest:

```bash
npm run cms:upload-assets -- --dry-run
```

Check whether the configured Sanity dataset has the expected imported content:

```bash
npm run cms:status
```

If an older dataset has a hero flag but no `Site Settings → 首页主视觉照片`,
repair the singleton reference with a dry run first, then apply it:

```bash
npm run cms:backfill-hero
node scripts/backfill-site-settings-hero.mjs --apply
```

Run the full content sync after `.env.local` is configured:

```bash
npm run cms:sync -- --limit 2
```

See `docs/sanity-migration.md` for the import workflow.
See `docs/sanity-content-control-plan.md` for the homepage and Photobalcony content model. After the first migration, edit `页面内容` in Studio; adding or reordering a section does not require a code change or GitHub push.
See `docs/deployment.md` for the GitHub + Vercel deployment workflow.
See `docs/auto-deploy.md` for wiring Sanity to Vercel auto-rebuilds on CMS changes.

The public site uses local static data as a fallback. When `VITE_SANITY_PROJECT_ID` and `VITE_SANITY_DATASET` are configured, the browser loads published Sanity content and replaces the fallback data after startup.

## Build

```bash
npm run build
```

The build script syncs photos, runs TypeScript, and creates the production output in `dist/`.

## Photo Sync

Source photos may live locally in category folders such as:

- `山野`
- `建筑`
- `日出日落`
- `森林`
- `河流`
- `海洋`
- `石塘度假区`
- `花朵`

Run this when photos are added, removed, or replaced:

```bash
npm run sync:photos
```

The sync script copies image files from the project-level category folders into `public/photos/` and regenerates `src/data/photos.ts` with dimensions, filenames, categories, and public URLs.

The category folders are private migration inputs and are ignored by Git. Upload their images to Sanity with the documented `npm run cms:sync` workflow before deploying a public code repository. Production builds read the published Sanity image assets; local development can still use the private folders as a fallback.

## Photo Notes

Narrative and EXIF-like sample content lives in `src/data/stories.ts`.

- `photoMeta` adds date, location, camera, lens, aperture, shutter, ISO, and focal length.
- `photoStories` adds a title, excerpt, and body paragraphs.
- `/journal` shows story entries.
- `/photostory` is intentionally kept as a preview/test module for evaluating About, metadata, and story layouts together.

## Main Pages

- `/` home gallery
- `/photobalcony` Balcony View series
- `/journal` photo stories
- `/about` photographer profile
- `/photostory` preserved content preview module

## Verification Checklist

Before handing off changes:

```bash
npm run build
```

For a local, network-independent content check, run:

```bash
npm run verify
```

The sitemap generator falls back to the local static content when Sanity is
temporarily unavailable. Set `SANITY_BUILD_STRICT=1` in CI only when a build
must fail instead of using that fallback.

Sanity Studio includes a `网站预览` Presentation tool. Set
`SANITY_STUDIO_PREVIEW_URL` to the public or local frontend URL before running
the Studio build. The preview opens the same `?preview=1` visual review mode.

Photos now support alt text, captions, and credit fields. Public stories must
have a cover photo, and Portable Text body images, links, and basic marks are
rendered by the frontend.

Then spot-check:

- Home page has no horizontal overflow on mobile.
- Gallery images open in the lightbox.
- Lightbox shows metadata for photos listed in `photoMeta`.
- `/photobalcony`, `/journal`, `/about`, and `/photostory` load correctly.
