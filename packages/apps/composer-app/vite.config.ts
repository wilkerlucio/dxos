//
// Copyright 2022 DXOS.org
//

import { sentryVitePlugin } from '@sentry/vite-plugin';
import ReactPlugin from '@vitejs/plugin-react-swc';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig, searchForWorkspaceRoot } from 'vite';
import Inspect from 'vite-plugin-inspect';
import { VitePWA } from 'vite-plugin-pwa';
import TopLevelAwaitPlugin from 'vite-plugin-top-level-await';
import WasmPlugin from 'vite-plugin-wasm';
import tsconfigPaths from 'vite-tsconfig-paths';

import { ConfigPlugin } from '@dxos/config/vite-plugin';
import { ThemePlugin } from '@dxos/react-ui-theme/plugin';

import { appKey } from './src/constants';
import IconsPlugin from "@ch-ui/vite-plugin-icons";

const phosphorIconsCore = resolve(__dirname, '../../../node_modules/@phosphor-icons/core/assets')

// https://vitejs.dev/config
export default defineConfig({
  server: {
    host: true,
    https:
      process.env.HTTPS === 'true'
        ? {
            key: './key.pem',
            cert: './cert.pem',
          }
        : undefined,
    fs: {
      strict: false,
      cachedChecks: false,
      allow: [
        // TODO(wittjosiah): Not detecting pnpm-workspace?
        //   https://vitejs.dev/config/server-options.html#server-fs-allow
        searchForWorkspaceRoot(process.cwd()),
      ],
    },
  },
  build: {
    sourcemap: true,
    minify: process.env.DX_MINIFY !== 'false',
    rollupOptions: {
      input: {
        internal: resolve(__dirname, './internal.html'),
        main: resolve(__dirname, './index.html'),
        shell: resolve(__dirname, './shell.html'),
        devtools: resolve(__dirname, './devtools.html'),
        'script-frame': resolve(__dirname, './script-frame/index.html'),
      },
      output: {
        chunkFileNames,
        manualChunks: {
          react: ['react', 'react-dom'],
          dxos: ['@dxos/react-client'],
          ui: ['@dxos/react-ui', '@dxos/react-ui-theme'],
          editor: ['@dxos/react-ui-editor'],
        },
      },
      external: [
        // Provided at runtime by socket supply shell.
        'socket:application',
      ],
    },
  },
  resolve: {
    alias: {
      'node-fetch': 'isomorphic-fetch',
    },
  },
  worker: {
    format: 'es',
    plugins: () => [TopLevelAwaitPlugin(), WasmPlugin()],
  },
  plugins: [
    tsconfigPaths({
      projects: ['../../../tsconfig.paths.json'],
    }),
    ConfigPlugin(),
    ThemePlugin({
      root: __dirname,
      content: [
        resolve(__dirname, './index.html'),
        resolve(__dirname, './src/**/*.{js,ts,jsx,tsx}'),
        resolve(__dirname, '../plugins/*/src/**/*.{js,ts,jsx,tsx}'),
      ],
    }),
    IconsPlugin({
      symbolPattern:
        'ph--([a-z]+[a-z-]*)--(bold|duotone|fill|light|regular|thin)',
      assetPath: (name, variant) =>
        `${phosphorIconsCore}/${variant}/${name}${
          variant === 'regular' ? '' : `-${variant}`
        }.svg`,
      spritePath: resolve(__dirname, 'public/icons.svg'),
      contentPaths: [
        `${resolve(__dirname, '../../..')}/{packages,tools}/**/dist/**/*.{mjs,html}`,
        `${resolve(__dirname, '../../..')}/{packages,tools}/**/src/**/*.{ts,tsx,js,jsx,css,md,html}`
      ],
    }),
    // https://github.com/antfu-collective/vite-plugin-inspect#readme
    // localhost:5173/__inspect
    process.env.DX_INSPECT && Inspect(),
    TopLevelAwaitPlugin(),
    WasmPlugin(),
    // https://github.com/preactjs/signals/issues/269
    ReactPlugin({
      plugins: [
        [
          '@dxos/swc-log-plugin',
          {
            to_transform: [
              {
                name: 'log',
                package: '@dxos/log',
                param_index: 2,
                include_args: false,
                include_call_site: true,
                include_scope: true,
              },
              {
                name: 'invariant',
                package: '@dxos/invariant',
                param_index: 2,
                include_args: true,
                include_call_site: false,
                include_scope: true,
              },
              {
                name: 'Context',
                package: '@dxos/context',
                param_index: 1,
                include_args: false,
                include_call_site: false,
                include_scope: false,
              },
            ],
          },
        ],
      ],
    }),
    VitePWA({
      // No PWA for e2e tests because it slows them down (especially waiting to clear toasts).
      // No PWA in dev to make it easier to ensure the latest version is being used.
      // May be mitigated in the future by https://github.com/dxos/dxos/issues/4939.
      // https://vite-pwa-org.netlify.app/guide/unregister-service-worker.html#unregister-service-worker
      selfDestroying: process.env.DX_PWA === 'false',
      workbox: {
        maximumFileSizeToCacheInBytes: 30000000,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm,woff2}'],
      },
      includeAssets: ['favicon.ico'],
      manifest: {
        name: 'DXOS Composer',
        short_name: 'Composer',
        description: 'DXOS Composer Application',
        theme_color: '#003E70',
        icons: [
          {
            src: 'favicon-16x16.png',
            sizes: '16x16',
            type: 'image/png',
          },
          {
            src: 'favicon-32x32.png',
            sizes: '32x32',
            type: 'image/png',
          },
          {
            src: 'android-chrome-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'android-chrome-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
    // https://docs.sentry.io/platforms/javascript/sourcemaps/uploading/vite
    // https://www.npmjs.com/package/@sentry/vite-plugin
    sentryVitePlugin({
      org: 'dxos',
      project: 'composer-app',
      sourcemaps: {
        assets: './packages/apps/composer-app/out/composer/**',
      },
      authToken: process.env.SENTRY_RELEASE_AUTH_TOKEN,
      disable: process.env.DX_ENVIRONMENT !== 'production',
      release: {
        name: `${appKey}@${process.env.npm_package_version}`,
      },
    }),
    ...(process.env.DX_STATS
      ? [
          visualizer({
            emitFile: true,
            filename: 'stats.html',
          }),
          // https://www.bundle-buddy.com/rollup
          {
            name: 'bundle-buddy',
            buildEnd() {
              const deps: { source: string; target: string }[] = [];
              for (const id of this.getModuleIds()) {
                const m = this.getModuleInfo(id);
                if (m != null && !m.isExternal) {
                  for (const target of m.importedIds) {
                    deps.push({ source: m.id, target });
                  }
                }
              }

              const outDir = join(__dirname, 'out');
              if (!existsSync(outDir)) {
                mkdirSync(outDir);
              }
              writeFileSync(join(outDir, 'graph.json'), JSON.stringify(deps, null, 2));
            },
          },
        ]
      : []),
  ],
});

/**
 * Generate nicer chunk names.
 * Default makes most chunks have names like index-[hash].js.
 */
function chunkFileNames(chunkInfo: any) {
  if (chunkInfo.facadeModuleId && chunkInfo.facadeModuleId.match(/index.[^\/]+$/gm)) {
    let segments: any[] = chunkInfo.facadeModuleId.split('/').reverse().slice(1);
    const nodeModulesIdx = segments.indexOf('node_modules');
    if (nodeModulesIdx !== -1) {
      segments = segments.slice(0, nodeModulesIdx);
    }
    const ignoredNames = ['dist', 'lib', 'browser'];
    const significantSegment = segments.find((segment) => !ignoredNames.includes(segment));
    if (significantSegment) {
      return `assets/${significantSegment}-[hash].js`;
    }
  }

  return 'assets/[name]-[hash].js';
}
