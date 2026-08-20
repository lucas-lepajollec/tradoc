import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

const port = process.env.TRADOC_DEMO_E2E_PORT || '65441';
const localChrome = process.env.PLAYWRIGHT_CHROME_PATH
  || (existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe')
    ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    : undefined);

export default defineConfig({
  testDir: './e2e-demo',
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'on-first-retry',
    launchOptions: localChrome ? { executablePath: localChrome } : {},
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: {
    command: `npm run dev:demo -- --host 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 120 * 1000,
  },
});
