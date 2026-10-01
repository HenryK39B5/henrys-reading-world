import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const port = 5212;
export default defineConfig({
    testDir: '..',
    testMatch: 'map-reading.spec.ts',
    workers: 1,
    timeout: 90_000,
    // This Windows WebKit dev-server cold load has exceeded the old 5s assertion budget.
    // Readiness waits are not a phone startup performance claim; measure built cold loads separately.
    expect: { timeout: 20_000 },
    reporter: [['list']],
    use: { baseURL: `http://127.0.0.1:${String(port)}`, trace: 'off', screenshot: 'off', video: 'off' },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    ],
    webServer: {
        command: `npm run dev -- --host 127.0.0.1 --port ${String(port)} --strictPort`,
        cwd: fileURLToPath(new URL('../..', import.meta.url)),
        url: `http://127.0.0.1:${String(port)}/map`,
        reuseExistingServer: process.env.REUSE_MAP_DEMO === '1',
        timeout: 60_000,
    },
});
