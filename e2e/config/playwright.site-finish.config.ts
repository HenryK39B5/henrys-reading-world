import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const cwd = fileURLToPath(new URL('../..', import.meta.url));
export default defineConfig({
    testDir: '..', testMatch: 'site-finish.spec.ts', workers: 1,
    outputDir: '../../.private/review/site-finish/results',
    timeout: 120_000, expect: { timeout: 30_000 },
    use: { screenshot: 'only-on-failure', trace: 'retain-on-failure' },
    projects: ['local', 'public'].flatMap(scope => (['chromium', 'webkit'] as const).map(browserName => ({
        name: `${scope}-${browserName}`, metadata: { scope }, use: { browserName,
            baseURL: scope === 'local' ? 'http://127.0.0.1:5216' : 'http://127.0.0.1:5198' },
    }))),
    webServer: [
        { command: 'npm run dev:play', cwd, url: 'http://127.0.0.1:5216', reuseExistingServer: true, timeout: 60_000 },
        { command: 'node scripts/preview-pages.ts', cwd, url: 'http://127.0.0.1:5198/henrys-reading-world/', reuseExistingServer: false, timeout: 60_000 },
    ],
});
