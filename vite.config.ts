import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { createClient } from '@sanity/client'

const IMAGE_CDN_SUFFIX = '?w=2560&q=90&auto=format&fit=max'

async function fetchHeroUrlFromSanity(): Promise<string | null> {
  try {
    const client = createClient({
      projectId: 'zj2ik922',
      dataset: 'production',
      apiVersion: '2025-02-19',
      useCdn: true,
    })
    const result = await client.fetch<{ s?: string }>(
      `*[_type=="photo"&&isHero==true][0]{"s":image.asset->url}`
    )
    return result?.s ?? null
  } catch {
    return null
  }
}

function dropWoffFallback(): Plugin {
  return {
    name: 'drop-woff-fallback',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const woffUrl = /url\([^)]*\.woff(?:[?#][^)]*)?\)\s*format\(['"]woff['"]\)\s*,?\s*/gi
      const woffAssets = new Set<string>()
      for (const file of Object.values(bundle)) {
        if (file.type === 'asset' && typeof file.source === 'string' && file.fileName.endsWith('.css')) {
          const before = file.source.length
          file.source = file.source.replace(woffUrl, (match) => {
            const urlMatch = match.match(/url\(([^)]*)\)/)
            if (urlMatch) woffAssets.add(urlMatch[1].replace(/^["']|["']$/g, ''))
            return ''
          })
          if (file.source.length !== before) {
            file.source = file.source.replace(/,(\s*})/g, '$1').replace(/;\s*}/g, '}')
          }
        }
      }
      for (const fileName of Object.keys(bundle)) {
        const baseName = fileName.split('?')[0].split('#')[0]
        if (baseName.endsWith('.woff') && !baseName.endsWith('.woff2')) {
          for (const ref of woffAssets) {
            if (fileName === ref || fileName.endsWith(ref) || ref.endsWith(fileName)) {
              delete bundle[fileName]
              break
            }
          }
        }
      }
    },
  }
}

/**
 * Preload the locally bundled homepage font faces to avoid a fallback-font
 * repaint on a cold visit.
 */
function fontPreloadPlugin(): Plugin {
  const criticalFonts = [
    'poppins-latin-400-normal',
    'poppins-latin-600-normal',
    'playfair-display-latin-600-normal',
    'playfair-display-latin-600-italic',
  ]

  return {
    name: 'font-preload',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const fontFiles = criticalFonts
        .map((font) =>
          Object.keys(bundle).find(
            (fileName) => fileName.startsWith(`assets/${font}-`) && fileName.endsWith('.woff2'),
          ),
        )
        .filter((fileName): fileName is string => Boolean(fileName))

      if (fontFiles.length === 0) return

      const links = fontFiles
        .map((fileName) => `  <link rel="preload" as="font" type="font/woff2" href="/${fileName}" crossorigin>`)
        .join('\n')

      for (const file of Object.values(bundle)) {
        if (file.type !== 'asset' || file.fileName !== 'index.html' || typeof file.source !== 'string') {
          continue
        }
        file.source = file.source.replace('</head>', `${links}\n  </head>`)
        break
      }
    },
  }
}

/**
 * Ask Sanity which photo is the homepage hero and inject a preload link
 * so the browser can download it in parallel with the JS bundle.
 *
 * At build time this queries Sanity for the hero photo's CDN URL. If the
 * query fails (no network, proxy issue), the preload is silently skipped
 * but the preconnect to cdn.sanity.io is still added — a smaller but
 * still useful optimisation.
 *
 * When the hero changes in Sanity (isHero flag moved or uploaded),
 * the next build automatically picks up the new URL. No manual edit
 * needed.
 */
function heroPreloadPlugin(): Plugin {
  return {
    name: 'hero-preload',
    apply: 'build',
    enforce: 'pre',
    async transformIndexHtml(html) {
      const preconnect = '  <link rel="preconnect" href="https://cdn.sanity.io">\n'
      let preload = ''

      const src = await fetchHeroUrlFromSanity()
      if (src) {
        preload = `  <link rel="preload" as="image" href="${src}${IMAGE_CDN_SUFFIX}" fetchpriority="high">\n`
      }

      if (!html.includes('cdn.sanity.io')) {
        html = html.replace('</head>', `${preconnect}${preload}  </head>`)
      }

      return html
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const sanityProjectId = env.VITE_SANITY_PROJECT_ID || 'zj2ik922'

  return {
    define: {
      __LAST_UPDATE__: JSON.stringify(new Date().toISOString()),
    },
    plugins: [react(), dropWoffFallback(), fontPreloadPlugin(), heroPreloadPlugin()],
    server: {
      proxy: {
        "/sanity": {
          target: `https://${sanityProjectId}.api.sanity.io`,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/sanity/, ""),
        },
      },
    },
  }
})
