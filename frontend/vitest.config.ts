import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: 'happy-dom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      testTimeout: 15000,
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
)
