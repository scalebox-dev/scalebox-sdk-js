import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 300000, // 5 minutes for sandbox operations
    hookTimeout: 300000,
    teardownTimeout: 300000,
  },
  resolve: {
    alias: {
      '@': './src',
    },
  },
  esbuild: {
    target: 'node18',
  },
  ssr: {
    noExternal: ['vitest'],
  },
})
