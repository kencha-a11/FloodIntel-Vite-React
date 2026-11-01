import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const devApiTarget = process.env.VITE_DEV_API_TARGET || 'http://localhost:8001'

const apiProxy = {
  '/api': {
    target: devApiTarget,
    changeOrigin: true,
  },
  '/storage': {
    target: devApiTarget,
    changeOrigin: true,
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'FloodIntel',
        short_name: 'FloodIntel',
        description:
          'Capture and review barangay flood level reports, online or offline.',
        theme_color: '#0f172a',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/icons.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        globIgnores: [
          '**/MapView-*.js',
          '**/MapView-*.css',
          '**/ReportLocationMap-*.js',
          '**/ReportLocationMap-*.css',
          // The shared MapLibre runtime is emitted under the mapStyle name,
          // the module both lazy maps import; it is runtime-cached instead.
          '**/mapStyle-*.js',
          '**/mapStyle-*.css',
          '**/maplibre-gl-*.js',
          '**/maplibre-gl-*.css',
        ],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/storage\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /\/assets\/(?:MapView-|ReportLocationMap-|mapStyle-|maplibre-gl-)[^/]*\.(?:js|mjs|css)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-runtime',
              expiration: {
                maxEntries: 8,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /\/geo\/.*\.(?:geojson|json|bin)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'geo-artifacts',
              expiration: {
                maxEntries: 16,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: apiProxy,
  },
  preview: {
    proxy: apiProxy,
  },
})
