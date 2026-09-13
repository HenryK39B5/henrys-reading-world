import { defineConfig, devices } from '@playwright/test';

/**
 * Public-mode acceptance: the normal `dev` command serves the (still empty) public snapshot, so every
 * room's honest empty state can be checked without a private file. Run with: npm run test:public
 */
export default defineConfig({
    testDir: './e2e',
    testMatch: 'empty-state.spec.ts',
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
