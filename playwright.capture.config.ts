import { defineConfig, devices } from '@playwright/test';

/**
 * Review capture runs a separate spec that only takes screenshots and prints measurements.
 * It is kept out of the normal test run (see testIgnore in playwright.config.ts).
 */
export default defineConfig({
    testDir: './e2e',
    testMatch: '**/capture.spec.ts',
    fullyParallel: false,
    retries: 0,
    reporter: [['list']],
    use: {
        baseURL: 'http://127.0.0.1:5173',
        trace: 'off',
        screenshot: 'off',
        video: 'off',
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: {
        command: 'npm run dev:local',
        url: 'http://127.0.0.1:5173',
        reuseExistingServer: true,
        stdout: 'ignore',
        stderr: 'pipe',
        timeout: 60_000,
    },
});
