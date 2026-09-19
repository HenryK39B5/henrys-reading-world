import { defineConfig, devices } from '@playwright/test';

/**
 * Browser verification runs against the local development server, which is the only mode that
 * serves the private, not-yet-publicly-approved snapshot. The server binds to loopback only.
 */
export default defineConfig({
    testDir: './e2e',
    // Review captures, the reviewer's own run and the public-mode empty-state check are run explicitly:
    // `npm run capture:review`, `npm run capture:v2e`, `npm run capture:v2e4`, `npm run test:public` and
    // `npm run test:publication`. The reviewer talks to a different server on a different port.
    testIgnore: [
        '**/capture.spec.ts',
        '**/capture-v2e.spec.ts',
        '**/capture-v2e4.spec.ts',
        '**/capture-release-a.spec.ts',
        '**/capture-v3-batch4.spec.ts',
        '**/empty-state.spec.ts',
        '**/publication/**',
        '**/tag-studio/**',
    ],
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
