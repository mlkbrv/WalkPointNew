import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, transformWithEsbuild} from 'vite';
import type {Plugin} from 'vite';

/**
 * Web build.
 *
 * The app is written against React Native, so the browser target maps
 * `react-native` onto **react-native-web** — the real implementation, not a
 * hand-written stand-in. A local shim only has to satisfy the screens; every
 * third-party package that imports from `react-native` resolves here too, and
 * keeping up with all of them by hand does not converge.
 *
 * `resolve.extensions` is the other half: Expo and React Native packages ship
 * `.web.ts` / `.web.js` variants of anything that needs a browser
 * implementation, and they are only picked up if the resolver looks for them
 * first. Without this, native entry points win and reach for a bridge that is
 * not there.
 */
/**
 * Several React Native and Expo packages ship untranspiled JSX inside `.js`
 * files. Pre-bundling handles that in dev via an esbuild loader, but the
 * production build parses those files with Rollup's resolver, which refuses JSX.
 * This transforms only the node_modules `.js` files that actually contain JSX.
 */
function jsxInNodeModules(): Plugin {
  return {
    name: 'stride:jsx-in-node-modules',
    enforce: 'pre',
    async transform(code, id) {
      if (!id.includes('node_modules') || !id.endsWith('.js')) return null;
      if (!/<[A-Za-z/]/.test(code)) return null;
      return transformWithEsbuild(code, id, {loader: 'jsx', jsx: 'automatic'});
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      jsxInNodeModules(),
      react({
        babel: {
          // Reanimated's worklets are created by its Babel plugin. Without it
          // every useAnimatedStyle throws at runtime on the web.
          plugins: ['react-native-reanimated/plugin'],
        },
      }),
      tailwindcss(),
    ],
    resolve: {
      // A second copy of React means a second copy of every context object, and
      // consumers then fail with "must be used within a Provider" even though the
      // provider is right there. Pre-bundled deps make that easy to hit.
      dedupe: ['react', 'react-dom', 'react-native-web'],
      // Platform-specific files first, exactly as Metro resolves them.
      extensions: [
        '.web.tsx',
        '.web.ts',
        '.web.jsx',
        '.web.js',
        '.tsx',
        '.ts',
        '.jsx',
        '.js',
        '.mjs',
        '.json',
      ],
      alias: {
        '@': path.resolve(__dirname, '.'),
        'react-native': 'react-native-web',
        // expo-font statically imports this for server rendering, a path that
        // never runs in a browser but still has to resolve for the bundle.
        'node:async_hooks': path.resolve(__dirname, './src/polyfills/async-hooks.ts'),
      },
    },
    define: {
      // React Native injects this global; on the web nothing does, and Expo
      // packages read it at module scope, so it must exist before they load.
      __DEV__: 'import.meta.env.DEV',
      // Expo's own runtime branches on these at module scope. EXPO_OS in
      // particular decides whether it talks to a native bridge or to the browser,
      // so it has to say "web" before anything else loads. More specific keys are
      // substituted ahead of the catch-all below.
      'process.env.EXPO_OS': '"web"',
      // Expo injects EXPO_PUBLIC_* into the native bundle; on the web the
      // catch-all `process.env` define below would erase it, so it is
      // substituted explicitly from the build environment.
      'process.env.EXPO_PUBLIC_API_BASE_URL': JSON.stringify(
        process.env.EXPO_PUBLIC_API_BASE_URL ?? '',
      ),
      'process.env.NODE_ENV': JSON.stringify(
        process.env.NODE_ENV || 'development',
      ),
      // Anything else reading `process.env` gets an empty object rather than a
      // ReferenceError; the browser has no `process`.
      'process.env': '{}',
      global: 'globalThis',
    },
    optimizeDeps: {
      // Excluding `expo` also leaves its CommonJS dependencies un-prebundled, and
      // the browser cannot import CJS directly. These are pre-bundled explicitly
      // so the interop wrapper is still generated.
      include: [
        'invariant',
        'warn-once',
        'nullthrows',
        'memoize-one',
        'use-latest-callback',
        'fbjs/lib/ExecutionEnvironment',
      ],
      esbuildOptions: {
        // Several React Native and Expo packages ship untranspiled JSX inside
        // .js files, which esbuild's dependency scanner refuses by default.
        loader: {'.js': 'jsx' as const},
        resolveExtensions: [
          '.web.tsx',
          '.web.ts',
          '.web.jsx',
          '.web.js',
          '.tsx',
          '.ts',
          '.jsx',
          '.js',
          '.mjs',
          '.json',
        ],
      },
    },
    server: {
      // The API runs on its own port; proxying keeps the web build same-origin,
      // so the relative base URL in src/api/client.ts works without CORS setup.
      proxy: {
        '/v1': {target: 'http://localhost:8000', changeOrigin: true},
        '/media': {target: 'http://localhost:8000', changeOrigin: true},
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
