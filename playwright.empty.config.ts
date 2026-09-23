import { defineConfig, devices } from '@playwright/test';

/**
 * Public-mode acceptance checks the approved non-empty snapshot after Release-B export.
 */
export default defineConfig({
    testDir: './e2e',
    testMatch: 'public-release.spec.ts',
    fullyParallel: false,
    retries: 0,
    reporter: [['list']],
    use: { baseURL: 'http://127.0.0.1:5199', trace: 'off', screenshot: 'off', video: 'off' },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: {
        command: 'npm run dev -- --port 5199',
        url: 'http://127.0.0.1:5199',
        reuseExistingServer: true,
        stdout: 'ignore',
        stderr: 'pipe',
        timeout: 60_000,
    },
});
