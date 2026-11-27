import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { Agent } from 'node:https'
import { siteSettingsQueryUrl } from './src/lib/cmsQueries.ts'

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

function siteSettingsPreloadPlugin(projectId: string | undefined, dataset: string): Plugin {
  return {
    name: 'site-settings-preload',
    apply: 'build',
    transformIndexHtml() {
      if (!projectId) return
      const settingsUrl = JSON.stringify(siteSettingsQueryUrl(projectId, dataset))
      return [
        { tag: 'link', attrs: { rel: 'preconnect', href: 'https://cdn.sanity.io' }, injectTo: 'head-prepend' },
        {
          tag: 'script',
          injectTo: 'head-prepend',
          children: `
    if (['/', '/photography', '/photography/'].includes(location.pathname)) {
      const settings = document.createElement('link');
      settings.rel = 'preload';
      settings.as = 'fetch';
      settings.crossOrigin = 'anonymous';
      settings.href = ${settingsUrl};
      document.head.append(settings);
    }
  `,
        },
      ]
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const sanityProjectId = env.VITE_SANITY_PROJECT_ID || 'zj2ik922'
  const cmsProxy = env.SANITY_DEV_HTTPS_PROXY

  return {
    define: {
      __LAST_UPDATE__: JSON.stringify(new Date().toISOString()),
    },
    plugins: [
      react(),
      dropWoffFallback(),
      fontPreloadPlugin(),
      siteSettingsPreloadPlugin(env.VITE_SANITY_PROJECT_ID, env.VITE_SANITY_DATASET ?? 'production'),
    ],
    server: {
      proxy: {
        "/sanity": {
          target: `https://${sanityProjectId}.api.sanity.io`,
          agent: cmsProxy ? new Agent({ proxyEnv: { HTTPS_PROXY: cmsProxy }, keepAlive: true }) : undefined,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/sanity/, ""),
        },
      },
    },
  }
})
