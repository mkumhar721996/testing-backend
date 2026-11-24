import { defineConfig } from '@playwright/test';

const port = 3100;

export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: `http://127.0.0.1:${port}` },
  webServer: {
    command: `pnpm build && HOST=127.0.0.1 PORT=${port} pnpm start`,
    url: `http://127.0.0.1:${port}/health`,
    reuseExistingServer: false,
  },
});
