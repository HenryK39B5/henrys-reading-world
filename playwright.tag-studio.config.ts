import { defineConfig, devices } from '@playwright/test';

/**
 * The Local Tag Studio's own run (docs/22 §6.2).
 *
 * It serves a different document on a different port, and starts the server with `READING_WORLD_TAG_DIR`
 * pointing at a test directory: the automated run must never save over the trial a person is reviewing in
 * `.private/tags/assignments.json`. One worker, because every test reads and writes that one file.
 */
export default defineConfig({
    testDir: './e2e/tag-studio',
    fullyParallel: false,
    workers: 1,
    forbidOnly: true,
    retries: 0,
    reporter: [['list']],
    use: {
        baseURL: 'http://127.0.0.1:5175',
        trace: 'off',
        screenshot: 'off',
        video: 'off',
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: {
        command: 'npm run tags:studio',
        url: 'http://127.0.0.1:5175/tag-studio.html',
        reuseExistingServer: false,
        env: { READING_WORLD_TAG_DIR: '.private/review/batch-3/test-tags' },
        stdout: 'ignore',
        stderr: 'pipe',
        timeout: 60_000,
    },
});
