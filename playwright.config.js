// @ts-check
import { defineConfig, devices } from '@playwright/test';

// Port 3000 may be taken on shared hosts; override with E2E_CLIENT_PORT.
const clientPort = process.env.E2E_CLIENT_PORT ?? '3000';
const baseURL = `http://localhost:${clientPort}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run dev --prefix server',
      url: 'http://localhost:4000/api/v1/health/ready',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: `npm run dev --prefix client -- --port ${clientPort}`,
      url: `${baseURL}/login`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
