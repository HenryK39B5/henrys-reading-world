import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: '..',
    testMatch: 'terrain-study.spec.ts',
    workers: 1,
    reporter: [['list']],
    use: { baseURL: 'http://127.0.0.1:5198', trace: 'off', screenshot: 'off' },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: {
        command: 'node scripts/preview-pages.ts',
        cwd: fileURLToPath(new URL('../..', import.meta.url)),
        url: 'http://127.0.0.1:5198/henrys-reading-world/',
        reuseExistingServer: false,
        stderr: 'pipe',
        timeout: 60_000,
    },
});
