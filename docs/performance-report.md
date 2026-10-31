# Performance Analysis Report

**Test URL:** http://localhost:5174/?fresh=1 (dev, since production URL timed out via the user proxy)
**Test tool:** Playwright + Performance API (instead of Lighthouse — Chrome 149 + Lighthouse 12 are currently incompatible on this machine)
**Device:** 1440×900 viewport, headless Chromium

## Core Web Vitals

| Metric | Value | Threshold | Verdict |
| --- | --- | --- | --- |
| **FCP** (First Contentful Paint) | 640 ms | < 1.8 s | ✅ Good |
| **LCP** (Largest Contentful Paint) | 716 ms | < 2.5 s | ✅ Good |
| **TTFB** (Time to First Byte) | 6 ms | < 800 ms | ✅ Good |
| **DOM Interactive** | 26 ms | — | ✅ Excellent |
| **Load** | 209 ms | — | ✅ Excellent |
| **LCP element** | `IMG.hero-image` | — | ✅ Correctly the LCP candidate |

## Bundle Sizes (production build, from `npm run build`)

| File | Raw | Gzip |
| --- | --- | --- |
| `index.html` | 1.49 KB | 0.74 KB |
| `index-*.css` | 39.17 KB | 8.48 KB |
| `index-*.js` | 353.92 KB | **113.18 KB** |
| `browser-*.js` (chunk) | 11.92 KB | 4.58 KB |
| `stegaEncodeSourceMap-*.js` | 6.86 KB | 2.85 KB |
| **Total** | ~413 KB | **~130 KB** |

The 113 KB gzipped JS is the main cost. Sources:
- React 19 + ReactDOM
- yet-another-react-lightbox (large image gallery lib)
- @sanity/client
- lucide-react
- bundled application code

## Resource Counts on Initial Load (dev)

| Type | Count |
| --- | --- |
| Scripts | 31 (Vite HMR + app in dev — production ships 1–2 files) |
| Stylesheets | 1 |
| Images (above-the-fold eager) | 5 |
| Images (lazy, below the fold) | 52 |
| Fonts | **6 woff2 files** (Cormorant, Playfair, Poppins × 2 weights each) |

## Issues Found

### 1. Font loading (historical finding)
The original test observed external Google Fonts failures. The current implementation imports Poppins and Playfair Display from `@fontsource`, so this finding no longer applies to the current build. Keep the bundled font imports and re-run the performance test after future typography changes.

`index.html:19-22` loads three families × multiple weights = up to 19 woff2 files.

**Current status:** Fonts are self-hosted in the production bundle.

### 2. Hero image delivery
The current frontend applies Sanity CDN transforms to the hero (`w=1400/2000/2400`, `auto=format`, and quality settings) and uses `srcset`. The old local JPG measurement is retained as historical context only; production should be checked against the published Sanity asset URL.

**Fix:**
- Keep the hero in Sanity and verify the CDN response size after changing it.
- Keep the existing `srcset` widths and avoid reintroducing raw source photos into the public build.

### 3. JS bundle is 113 KB gzipped
This is acceptable for a feature-rich portfolio (Sanity client, lightbox, masonry). Splitting the lightbox into a lazy chunk would only save ~20–30 KB because it's only needed when the user opens an image. Probably not worth the complexity right now.

## Recommendations (priority order)

1. **Verify the transformed hero response** on the production domain after each hero change.
2. (Optional) **Code-split the lightbox** — only relevant if the archive grows substantially

The current code path already applies the required transform and responsive delivery.
