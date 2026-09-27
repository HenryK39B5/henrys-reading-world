import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: '../research', testMatch: 'route-next.spec.ts', workers: 1, timeout: 90_000, reporter: [['list']],
    use: { baseURL: 'http://127.0.0.1:5202', trace: 'off', screenshot: 'off', video: 'off' },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: { command: 'node scripts/research/serve-route-viewer.ts --port=5202', cwd: fileURLToPath(new URL('../..', import.meta.url)),
        url: 'http://127.0.0.1:5202/next', reuseExistingServer: false, timeout: 60_000 },
});
