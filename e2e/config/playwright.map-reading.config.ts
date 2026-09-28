import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const port = 5212;
export default defineConfig({
    testDir: '..',
    testMatch: 'map-reading.spec.ts',
    workers: 1,
    timeout: 90_000,
    reporter: [['list']],
    use: { baseURL: `http://127.0.0.1:${String(port)}`, trace: 'off', screenshot: 'off', video: 'off' },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: {
        command: `npm run dev -- --host 127.0.0.1 --port ${String(port)} --strictPort`,
        cwd: fileURLToPath(new URL('../..', import.meta.url)),
        url: `http://127.0.0.1:${String(port)}/map`,
        reuseExistingServer: false,
        timeout: 60_000,
    },
});
