import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { loadSnapshot } from './support/snapshot.ts';

// Private real-content visual evidence, run explicitly with e2e/config/playwright.capture-7d.config.ts.
const phase = process.env.CAPTURE_PHASE === 'before' ? 'before' : process.env.CAPTURE_PHASE === '7e' ? '7e' : 'after';
const dir = resolve(`.private/review/v3-private-atlas/dark-cross-page/${phase}`);

test('fixed real map, lit book and two complete passages across three viewports', async ({ page }) => {
    const snapshot = loadSnapshot();
    expect(snapshot.map?.points).toHaveLength(4663);
    expect(snapshot.map?.labels).toHaveLength(56);
    const mapHash = createHash('sha256').update(JSON.stringify(snapshot.map)).digest('hex');
    expect(mapHash).toBe('567534bf71bfc5f6266ceb8ecd26267c4399888d87a1d606fed784a03d9fcd9e');
    mkdirSync(dir, { recursive: true });
    const metrics = [];
    for (const { label, width, height } of [
        { label: 'desktop', width: 1440, height: 900 },
        { label: 'mobile', width: 390, height: 844 },
        { label: 'narrow', width: 320, height: 720 },
    ]) {
        await page.setViewportSize({ width, height });
        for (const { name, url, id } of [
            { name: 'world', url: '/map', id: null },
            { name: 'lit', url: '/map?book=b-013', id: null },
            { name: 'detail', url: '/map?tag=tag-035&h=h-013', id: 'h-013' },
            { name: 'long', url: '/map?book=b-013&h=h-231', id: 'h-231' },
        ]) {
            await page.goto(url);
            await expect(page.getByTestId('map-canvas')).toBeVisible();
            await page.evaluate(() => document.fonts.ready);
            if (id !== null) {
                const real = snapshot.highlights.find((item) => item.id === id);
                expect(real).toBeDefined();
                await expect(page.locator('.map-detail-passage')).toHaveText(real?.text ?? '');
                await expect(page.locator('#map-detail-heading')).toBeFocused();
            }
            // The room-entry fade and real-cover pixel read must finish before visual evidence.
            await page.waitForTimeout(name === 'lit' || name === 'long' ? 750 : 450);
            await page.screenshot({ path: resolve(dir, `${label}-${name}.png`) });
            if (name === 'world' || name === 'lit') {
                await page.getByTestId('map-stage').evaluate((element) => {
                    window.scrollBy({ top: element.getBoundingClientRect().top - 24, behavior: 'instant' });
                });
                await page.screenshot({ path: resolve(dir, `${label}-${name}-map-in-view.png`) });
            }
            if (name === 'world' && label === 'mobile') {
                await page.getByRole('button', { name: '点亮一本书' }).click();
                await expect(page.getByRole('dialog', { name: '点亮一本书' })).toBeVisible();
                await page.screenshot({ path: resolve(dir, 'mobile-book-picker.png') });
            }
            if (id !== null) await page.getByTestId('map-detail').screenshot({ path: resolve(dir, `${label}-${name}-full-text.png`) });
            if (name === 'detail' && label === 'mobile') {
                await page.getByTestId('map-detail').getByRole('button', { name: '分享' }).click();
                await expect(page.getByRole('dialog')).toBeVisible();
                await page.screenshot({ path: resolve(dir, 'mobile-detail-share.png') });
            }
            metrics.push({
                label, name, url, width, height,
                overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
                foreground: await page.locator('.room-map').evaluate((element) => getComputedStyle(element).color),
                stage: await page.getByTestId('map-stage').evaluate((element) => {
                    const rect = element.getBoundingClientRect();
                    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
                }),
            });
        }
    }
    writeFileSync(resolve(dir, 'metrics.json'), JSON.stringify({ phase, mapVersion: snapshot.map?.version, mapHash, metrics }, null, 2));
});
