import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: '..',
    testMatch: 'map-interactive-study.spec.ts',
    workers: 1,
    reporter: [['list']],
    use: { baseURL: 'http://127.0.0.1:5199', trace: 'off', screenshot: 'off' },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: {
        command: 'vite --mode map-study --port 5199',
        cwd: fileURLToPath(new URL('../..', import.meta.url)),
        url: 'http://127.0.0.1:5199/map',
        reuseExistingServer: false,
        stderr: 'pipe',
        timeout: 60_000,
    },
});
