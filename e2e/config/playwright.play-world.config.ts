import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: '..', testMatch: 'play-world.spec.ts', fullyParallel: false, workers: 1,
    outputDir: '../../.private/review/twilight-garden/results-local',
    timeout: 120_000, expect: { timeout: 30_000 },
    use: { baseURL: 'http://127.0.0.1:5216', viewport: { width:1440,height:900 }, screenshot:'only-on-failure', trace:'retain-on-failure' },
    projects: [{name:'chromium',use:{browserName:'chromium'}},{name:'webkit',use:{browserName:'webkit'}}],
    webServer: { command:'npm run dev:play',url:'http://127.0.0.1:5216',reuseExistingServer:true,timeout:60_000 },
});
