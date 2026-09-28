import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

// SVG is the single design source. Generate PNG fallbacks for older tabs and home-screen shortcuts.
const svg = await readFile('public/favicon.svg');
const browser = await chromium.launch();
try {
    for (const [size, path] of [[32, 'public/favicon-32.png'], [180, 'public/apple-touch-icon.png']]) {
        const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
        try {
            await page.setContent(`<style>html,body{margin:0;background:transparent}</style><img width="${size}" height="${size}" src="data:image/svg+xml;base64,${svg.toString('base64')}">`);
            await page.locator('img').evaluate(async (image) => { await image.decode(); });
            await writeFile(path, await page.screenshot({ omitBackground: true }));
            console.log(`Generated ${path} (${size}×${size}) from public/favicon.svg`);
        } finally {
            await page.close();
        }
    }
} finally {
    await browser.close();
}
