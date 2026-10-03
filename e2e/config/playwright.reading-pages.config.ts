import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
export default defineConfig({
    outputDir:'../../.private/review/virtual-films/results-pages',
    testDir:'..',testMatch:'reading-pages.spec.ts',fullyParallel:false,workers:1,timeout:150_000,expect:{timeout:30_000},
    use:{baseURL:'http://127.0.0.1:5316',screenshot:'only-on-failure',trace:'retain-on-failure'},
    projects:[{name:'chromium',use:{browserName:'chromium'}},{name:'webkit',use:{browserName:'webkit'}}],
    webServer:{cwd:fileURLToPath(new URL('../..',import.meta.url)),command:'npx vite build --mode play-static-check && node scripts/research/serve-play-static-check.mjs',url:'http://127.0.0.1:5316/henrys-reading-world/',reuseExistingServer:false,timeout:90_000},
});
