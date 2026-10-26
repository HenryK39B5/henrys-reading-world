import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const live = process.env.RELEASE_LIVE_URL;
export default defineConfig({
    testDir: '..', testMatch: 'release-c.spec.ts', workers: 1, retries: 0,
    outputDir: '../../.private/review/release-c/results', timeout: 150_000, expect: { timeout: 30_000 },
    use: { baseURL: live ?? 'http://127.0.0.1:5198', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
    projects: [{ name: 'chromium', use: { browserName: 'chromium' } }, { name: 'webkit', use: { browserName: 'webkit' } }],
    ...(live ? {} : { webServer: { command: 'node scripts/preview-pages.ts', cwd: fileURLToPath(new URL('../..', import.meta.url)),
        url: 'http://127.0.0.1:5198/henrys-reading-world/', reuseExistingServer: false, timeout: 60_000 } }),
});
