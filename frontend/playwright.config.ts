import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 15000 },
  use: {
    baseURL: 'http://127.0.0.1:5177',
    channel: 'chrome',
    headless: true,
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5177 --strictPort',
      url: 'http://127.0.0.1:5177',
      env: { API_PROXY_TARGET: 'http://127.0.0.1:8107' },
      reuseExistingServer: !process.env.CI,
    },
  ],
})
