# Auto Deploy From Sanity

This project can rebuild automatically when CMS content changes.

The browser reads published Sanity content directly, so ordinary photo and
story edits can appear after a page refresh. A Vercel rebuild is still useful
because it refreshes:

- `public/sitemap.xml`
- `public/robots.txt`
- the static fallback data baked into the JS bundle

## Flow

```text
Publish in Sanity Studio
-> Sanity webhook fires
-> Vercel Deploy Hook receives a POST
-> Vercel rebuilds gallery-site from GitHub master
-> www.queenstown.top receives the fresh sitemap and fallback data
```

Important: the deploy hook rebuilds the code that is already on GitHub
`master`. Code, styles, local scripts, and local image files must still be
committed and pushed. The webhook only rebuilds; it does not upload local
workspace changes.

## Create The Vercel Deploy Hook

1. Open the Vercel dashboard.
2. Select the `gallery-site` project.
3. Go to `Settings -> Git -> Deploy Hooks`.
4. Create a hook:
   - Name: `Sanity CMS`
   - Branch: `master`
5. Copy the generated URL.

Store it in `.env.local`:

```env
VERCEL_DEPLOY_HOOK_URL=https://api.vercel.com/v1/integrations/deploy/prj_xxx/yyyyyy
```

Test it manually:

```bash
npm run deploy:trigger
```

## Create Or Update The Sanity Webhook

The repository includes a setup script:

```bash
npm run deploy:webhook
```

It creates or updates a Sanity webhook with this filter:

```groq
_type in ["photo", "story", "siteSettings", "category", "homepageLayout", "photobalconyLayout", "pageLayout", "pageContent", "siteCopy"]
```

The webhook posts to `VERCEL_DEPLOY_HOOK_URL` whenever one of those documents is
created, updated, or deleted.

## Verify

1. Publish a small edit in Sanity Studio.
2. Open the Sanity webhook's recent deliveries and confirm it returned a
   successful HTTP status.
3. Open Vercel deployments and confirm a new production deployment appears.
4. After it finishes, check:

```text
https://www.queenstown.top/sitemap.xml
```

## Troubleshooting

- If no Vercel deployment appears, check Sanity webhook delivery logs first.
- If Vercel deploys an older UI, make sure the latest code is committed and
  pushed to GitHub `master`.
- If `npm run deploy:trigger` fails, confirm `VERCEL_DEPLOY_HOOK_URL` is present
  in `.env.local`.
- If `npm run deploy:webhook` fails, confirm `SANITY_WRITE_TOKEN` has permission
  to manage webhooks.
