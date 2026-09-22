import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    tsconfigPaths({
      ignoreConfigErrors: true,
    }),
  ],
  test: {
    environment: 'node',
    exclude: ['.private/**', '.scratch/**', 'dev/**', 'dist/**', 'node_modules/**'],
    include: ['tests/integration/**/*.test.ts'],
    fileParallelism: false,
    hookTimeout: 60_000,
    testTimeout: 60_000,
  },
})
