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

export default defineConfig({
  testDir: './dev',
  testMatch: '**/e2e.spec.{ts,js}',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: process.env.CI ? 60_000 : 30_000,
  reporter: 'html',
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  use: {
    baseURL: 'http://localhost:3000',

    actionTimeout: process.env.CI ? 45_000 : 0,
    navigationTimeout: process.env.CI ? 45_000 : 0,
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm dev',
    env: { DATABASE_URL: databaseUrl },
    reuseExistingServer: false,
    timeout: 120_000,
    url: 'http://localhost:3000/admin',
  },
})
