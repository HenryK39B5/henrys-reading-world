import { defineConfig, devices } from '@playwright/test';

/**
 * Release-A evidence on the reviewer side (docs/18 §6.3).
 *
 * Its own server on its own port, with the policy redirected into the capture's directory so a mixed
 * review can be photographed without overwriting anything a person has decided.
 */
export default defineConfig({
    testDir: './e2e/publication',
    testMatch: '**/capture-publication.spec.ts',
    fullyParallel: false,
    workers: 1,
    retries: 0,
    reporter: [['list']],
    use: {
        baseURL: 'http://127.0.0.1:5174',
        trace: 'off',
        screenshot: 'off',
        video: 'off',
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: {
        command: 'npm run publication:review',
        url: 'http://127.0.0.1:5174/publication-review.html',
        reuseExistingServer: false,
        env: { READING_WORLD_PUBLICATION_DIR: '.private/review/release-a/capture-policy' },
        stdout: 'ignore',
        stderr: 'pipe',
        timeout: 60_000,
    },
});
