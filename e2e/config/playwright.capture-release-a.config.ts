import { defineConfig, devices } from '@playwright/test';

/**
 * Release-A evidence on the product side (docs/18 §6.3): the book room's walk and the copied text's
 * provenance, captured from the real local server. Kept out of the normal run, like the other captures.
 */
export default defineConfig({
    testDir: '..',
    testMatch: '**/capture-release-a.spec.ts',
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
