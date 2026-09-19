import { defineConfig, devices } from '@playwright/test';
import { readTestEnv } from './scripts/env.mjs';

const { DATABASE_URL, DIRECT_URL, JWT_SECRET, NODE_ENV, APP_ORIGIN } =
  readTestEnv();

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: 'http://localhost:3000', trace: 'retain-on-failure' },
  reporter: [['list'], ['html', { open: 'never' }]],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm dev:api',
      env: {
        DATABASE_URL,
        DIRECT_URL,
        JWT_SECRET,
        NODE_ENV,
        APP_ORIGIN,
        HOST: '127.0.0.1',
        PORT: '3001',
      },
      url: 'http://127.0.0.1:3001/health/ready',
      reuseExistingServer: false,
      timeout: 60000,
    },
    {
      command: 'pnpm dev:web',
      env: {
        NODE_ENV,
        HOST: '127.0.0.1',
        PORT: '3000',
        API_URL: 'http://127.0.0.1:3001',
      },
      url: 'http://localhost:3000',
      reuseExistingServer: false,
      timeout: 60000,
    },
  ],
});
