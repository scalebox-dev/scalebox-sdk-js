import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 300000, // 5 minutes for sandbox operations
    hookTimeout: 300000,
    teardownTimeout: 300000,
    // 排除 desktop 测试，因为存在环境问题
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*',
      '**/tests/desktop/**' // 排除 desktop 测试
    ],
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
