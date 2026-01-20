import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 300000, // 5 minutes for sandbox operations
    hookTimeout: 300000,
    teardownTimeout: 300000,
    // Sequential execution mode (controlled by VITEST_SERIAL env var)
    // Set VITEST_SERIAL=1 to run tests one by one (avoids memory exhaustion)
    // Each test can consume ~2GB memory, use serial mode on low-memory systems
    ...(process.env.VITEST_SERIAL === '1' && {
      fileParallelism: false,
      maxConcurrency: 1,
      pool: 'forks',
      poolOptions: {
        forks: {
          singleFork: true,
        }
      },
    }),
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*',
    ],
  },
  resolve: {
    alias: {
      '@': './src',
    },
  },
  esbuild: {
    target: 'node20',
  },
  ssr: {
    noExternal: ['vitest'],
  },
})
