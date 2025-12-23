/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import compression from 'vite-plugin-compression'
import path from 'path'
import fs from 'fs'
import type { Plugin } from 'vite'

/**
 * Vite plugin to generate version.json and update sw.js for cache invalidation.
 * Creates a file with build timestamp that the app checks to detect new deploys.
 * Also injects the version into the service worker to ensure cache names are unique per build.
 */
function versionPlugin(): Plugin {
  return {
    name: 'version-plugin',
    writeBundle(options) {
      const outDir = options.dir || 'dist'
      const version = Date.now().toString(36) // Base36 timestamp as version
      const versionInfo = {
        version,
        buildTime: new Date().toISOString(),
      }

      // Write version.json for the app to check
      fs.writeFileSync(
        path.join(outDir, 'version.json'),
        JSON.stringify(versionInfo, null, 2)
      )

      // Update sw.js with the build version to ensure unique cache names
      const swPath = path.join(outDir, 'sw.js')
      if (fs.existsSync(swPath)) {
        let swContent = fs.readFileSync(swPath, 'utf-8')
        // Replace the placeholder version with actual build version
        swContent = swContent.replace(
          /const CACHE_VERSION = '[^']+'/,
          `const CACHE_VERSION = '${version}'`
        )
        fs.writeFileSync(swPath, swContent)
        console.log(`[version-plugin] Updated sw.js CACHE_VERSION: ${version}`)
      }

      console.log(`[version-plugin] Generated version.json: ${version}`)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Generate pre-compressed .gz files (served by nginx's gzip_static)
    compression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 1024, // Only compress files > 1KB
    }),
    // Generate pre-compressed .br files for Brotli (best compression)
    compression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 1024,
    }),
    // Generate version.json for cache invalidation on deploy
    versionPlugin(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Load .env from project root (one level up from frontend/)
  envDir: '..',
  build: {
    rollupOptions: {
      output: {
        // Separate vendor chunks for better caching
        manualChunks: {
          // React core (rarely changes)
          'react-vendor': ['react', 'react-dom'],
          // Router (changes infrequently)
          'router': ['react-router-dom'],
          // Virtualization library (used on Verses page)
          'virtual': ['@tanstack/react-virtual'],
        },
      },
    },
  },
  // Proxy API requests to backend in development (mirrors nginx in production)
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        'src/main.tsx',
        'src/vite-env.d.ts',
      ],
    },
  },
})
