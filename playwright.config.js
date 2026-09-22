import { execSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { defineConfig, devices } from '@playwright/test'

const e2eDbDir = path.join(os.tmpdir(), `payload-plugin-branching-e2e-${randomUUID()}`)
fs.mkdirSync(e2eDbDir, { recursive: true })
const databaseUrl = `file:${path.join(e2eDbDir, 'payload.db')}`

execSync('pnpm dev:migrate', {
  cwd: import.meta.dirname,
  env: { ...process.env, DATABASE_URL: databaseUrl },
  stdio: 'inherit',
})

if (process.env.CI) {
  execSync('pnpm dev:build', {
    cwd: import.meta.dirname,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  })
}

export default defineConfig({
  testDir: './dev',
  testMatch: '**/e2e.spec.{ts,js}',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 30_000,
  expect: {
    timeout: process.env.CI ? 8_000 : 5_000,
  },
  reporter: 'html',
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  use: {
    baseURL: 'http://localhost:3000',

    actionTimeout: 15_000,
    navigationTimeout: 15_000,
    trace: 'on-first-retry',
  },
  webServer: {
    command: process.env.CI ? 'pnpm dev:start' : 'pnpm dev',
    env: { DATABASE_URL: databaseUrl },
    reuseExistingServer: false,
    timeout: process.env.CI ? 180_000 : 120_000,
    url: 'http://localhost:3000/admin',
  },
})
