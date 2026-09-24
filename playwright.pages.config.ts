import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    testMatch: 'pages-preflight.spec.ts',
    workers: 1,
    reporter: [['list']],
    use: { baseURL: 'http://127.0.0.1:5198', trace: 'off' },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: {
        command: 'node scripts/preview-pages.ts',
        url: 'http://127.0.0.1:5198/henrys-reading-world/',
        reuseExistingServer: false,
        stderr: 'pipe',
        timeout: 60_000,
    },
});
