import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: '../research', testMatch: ['projection-windows.spec.ts', 'projection-pipeline-holdout.spec.ts'], workers: 1, timeout: 240_000,
    reporter: [['list']], use: { baseURL: 'http://127.0.0.1:5200', trace: 'off', screenshot: 'off', video: 'off' },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: {
        command: 'node scripts/research/serve-projection-study.ts --port=5200',
        cwd: fileURLToPath(new URL('../..', import.meta.url)), url: 'http://127.0.0.1:5200/',
        reuseExistingServer: false, timeout: 60_000,
    },
});
