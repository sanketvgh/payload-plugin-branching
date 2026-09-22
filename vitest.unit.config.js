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
    exclude: ['.private/**', '.scratch/**', 'dev/**', 'dist/**', 'node_modules/**', 'tests/**'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
})
