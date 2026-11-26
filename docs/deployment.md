# Deployment

## Recommended Setup

Use GitHub for source control and Vercel for hosting.

```text
GitHub  -> code and history
Vercel  -> frontend deployment
Sanity  -> CMS content and image assets
```

## Vercel Settings

Vercel should detect this as a Vite project.

| Setting | Value |
| --- | --- |
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |

## Vercel Environment Variables

Set the public frontend variables:

```text
VITE_SANITY_PROJECT_ID=zj2ik922
VITE_SANITY_DATASET=production
```

### Production map tiles

The map uses the configured provider first and keeps the built-in OSM/Esri
sources as a fallback. To use a different tile provider, set these public
variables in the Vercel Production environment:

```text
VITE_MAP_TILE_URL=https://tiles.example.com/{z}/{x}/{y}.png
VITE_MAP_TILE_ATTRIBUTION=© Map provider
VITE_MAP_TILE_MAX_NATIVE_ZOOM=18
```

Use a provider whose terms allow the site's expected traffic, and keep its
attribution visible. A provider URL is public data; it does not belong in a
secret variable. With these values blank, the site uses the built-in
OSM/Esri sources in production, preview, and local builds.

The public site reads Sanity without a token. The optional AI worker and iPhone Live Photo uploader use `SANITY_WRITE_TOKEN` on the server. Configure it as a server-side Vercel variable when enabling those features. See `ios/README.md` for uploader setup.

## Sanity CORS

After Vercel creates a production URL, add it to Sanity CORS:

```bash
npx sanity cors add https://your-vercel-domain.vercel.app --no-credentials
```

For Vercel Preview deployments, allow the project-specific deployment host
pattern so each new Preview URL can read published content:

```bash
npx sanity cors add "https://gallery-site-*.zjk159357s-projects.vercel.app" --no-credentials
```

If a custom domain is added later, add that too:

```bash
npx sanity cors add https://your-custom-domain.com --no-credentials
```

Current local development origins:

```text
http://127.0.0.1:5174
http://localhost:5174
http://127.0.0.1:3333
http://localhost:3333
```

## Git Safety

The repo ignores:

- `.env.local`
- `dist/`
- `dist-studio/`
- `public/photos/`
- `sanity/seed/generated/`
- the source photo category folders and `public/hero/`

This keeps local tokens, generated builds, source photos, synced public photos, and migration output out of Git. Upload source photos to Sanity, then deploy the public code repository with `VITE_SANITY_PROJECT_ID` and `VITE_SANITY_DATASET` configured. Production reads the published Sanity image assets.

## Production Verification

Before pushing:

```bash
npm run lint
npm run build
npm run cms:status
```

Expected CMS status:

```text
photos: current Sanity dataset count
photosWithImages: same as photos
pageLayouts: 2
siteCopy: 1
Status: ready
```

After deploy, open the Vercel URL and confirm the site loads. The local dev-only `CMS · 73` badge does not appear in production builds.
