import { defineConfig, devices } from '@playwright/test';

/**
 * Browser verification runs against the local development server, which is the only mode that
 * serves the private, not-yet-publicly-approved snapshot. The server binds to loopback only.
 */
export default defineConfig({
    testDir: './e2e',
    fullyParallel: false,
    forbidOnly: true,
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
