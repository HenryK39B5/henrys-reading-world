import { defineConfig, devices } from '@playwright/test';

/**
 * The publication reviewer's own run (docs/18 §5.3).
 *
 * It serves a different document on a different port, and — importantly — it starts the server with
 * `READING_WORLD_PUBLICATION_DIR` pointing at a test directory: the automated run must never save over the
 * decisions a person is making in the real review file. One worker, because every test in this file reads
 * and writes that one policy.
 */
export default defineConfig({
    testDir: './e2e/publication',
    fullyParallel: false,
    workers: 1,
    forbidOnly: true,
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
        env: { READING_WORLD_PUBLICATION_DIR: '.private/review/release-a/test-policy' },
        stdout: 'ignore',
        stderr: 'pipe',
        timeout: 60_000,
    },
});
