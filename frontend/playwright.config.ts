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
    launchOptions: {
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'python -m uvicorn api:app --host 127.0.0.1 --port 8107',
      cwd: '../backend',
      url: 'http://127.0.0.1:8107/',
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5177 --strictPort',
      url: 'http://127.0.0.1:5177',
      env: { API_PROXY_TARGET: 'http://127.0.0.1:8107' },
      reuseExistingServer: !process.env.CI,
    },
  ],
})
