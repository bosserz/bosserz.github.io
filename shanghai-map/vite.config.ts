import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { buildData, report } from './scripts/build-data.ts';

/** In `vite dev`, rebuild places.geojson whenever data/*.csv changes, then reload. */
function placesData(): Plugin {
  const dataDir = resolve(import.meta.dirname, 'data');
  return {
    name: 'places-data',
    apply: 'serve',
    configureServer(server) {
      server.watcher.add(dataDir);
      server.watcher.on('change', (file) => {
        if (!file.startsWith(dataDir) || !file.endsWith('.csv')) return;
        try {
          report(buildData(), (line) => server.config.logger.info(line));
        } catch (e) {
          // Never crash the dev server on a bad CSV; just say what's wrong.
          server.config.logger.error(`build-data: ${(e as Error).message}`);
          return;
        }
        server.ws.send({ type: 'full-reload' });
      });
    },
  };
}

const DAY = 24 * 60 * 60;

export default defineConfig({
  base: './',
  build: { target: 'es2020' },
  plugins: [
    placesData(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Shanghai Trip Map',
        short_name: 'Shanghai',
        description: 'Restaurants, cafés and sights for the Shanghai trip.',
        theme_color: '#d9480f',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        // App shell + places.geojson are precached (revisioned, so a redeploy updates them).
        globPatterns: ['**/*.{js,css,html,svg,png,geojson,json}'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            // Map tiles the user has viewed. Tiles are loaded as <img> (no-cors), so
            // responses are opaque (status 0) and must be explicitly allowed.
            urlPattern: ({ url }) => /(^|\.)autonavi\.com$|^tile\.openstreetmap\.org$/.test(url.hostname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'tiles',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 2000, maxAgeSeconds: 60 * DAY },
            },
          },
        ],
      },
    }),
  ],
  test: { environment: 'node' },
} as any);
