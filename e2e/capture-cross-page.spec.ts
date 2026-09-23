import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { loadSnapshot } from './support/snapshot.ts';

const phase = process.env.CAPTURE_PHASE === 'before' ? 'before' : 'after';
const dir = resolve(`.private/review/v3-private-atlas/cross-page-dark/${phase}`);

test('fixed real content across reading, directory and map rooms', async ({ page }) => {
    const snapshot = loadSnapshot();
    const mapHash = createHash('sha256').update(JSON.stringify(snapshot.map)).digest('hex');
    expect(mapHash).toBe('567534bf71bfc5f6266ceb8ecd26267c4399888d87a1d606fed784a03d9fcd9e');
    expect(snapshot.highlights).toHaveLength(4663);
    mkdirSync(dir, { recursive: true });
    // Visual comparisons need the same opening sentence in the book and path rooms.
    await page.addInitScript(() => { Math.random = () => 0.37; });
    const metrics = [];
    for (const { label, width, height } of [
        { label: 'desktop', width: 1440, height: 900 },
        { label: 'mobile', width: 390, height: 844 },
        { label: 'narrow', width: 320, height: 720 },
    ]) {
        await page.setViewportSize({ width, height });
        for (const { name, url, room } of [
            { name: 'hall', url: '/?h=h-013', room: 'hall' },
            { name: 'book', url: '/books/b-013', room: 'book' },
            { name: 'path', url: '/paths/tag-040', room: 'path' },
            { name: 'paths', url: '/paths', room: 'paths' },
            { name: 'books', url: '/books', room: 'books' },
            { name: 'themes', url: '/themes', room: 'themes' },
            { name: 'map', url: '/map', room: 'map' },
        ]) {
            await page.goto(url);
            await expect(page.locator(`[data-room="${room}"]`)).toBeVisible();
            await page.evaluate(() => document.fonts.ready);
            const passage = page.locator('[data-testid="stage-passage"], [data-testid="book-random-text"], [data-testid="path-passage"]');
            if (['hall', 'book', 'path'].includes(name)) {
                const text = (await passage.innerText()).trim();
                expect(snapshot.byText.has(text)).toBe(true);
                if (name === 'hall') expect(text).toBe(snapshot.highlights.find((item) => item.id === 'h-013')?.text);
            }
            await page.waitForTimeout(850);
            // Reset scroll after route-memory restores, so each image represents the actual opening.
            await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
            await page.screenshot({ path: resolve(dir, `${label}-${name}.png`) });
            metrics.push({
                label, name, width, height, url,
                overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
                paper: await page.locator('.shell').evaluate((node) => getComputedStyle(node).getPropertyValue('--paper').trim()),
                passage: ['hall', 'book', 'path'].includes(name) ? (await passage.innerText()).trim() : null,
                heading: await page.locator('[data-testid="room-heading"]').boundingBox(),
                stage: name === 'map' ? await page.getByTestId('map-stage').boundingBox() : null,
            });
        }
    }
    expect(metrics.every((item) => !item.overflow)).toBe(true);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?h=h-013');
    await expect(page.getByTestId('stage-passage')).toHaveText(snapshot.highlights.find((item) => item.id === 'h-013')?.text ?? '');
    await page.getByTestId('share-open').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.screenshot({ path: resolve(dir, 'mobile-share.png') });

    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto(`/?h=${snapshot.longest.id}`);
    await expect(page.getByTestId('stage-passage')).toHaveText(snapshot.longest.text);
    await page.locator('.stage').screenshot({ path: resolve(dir, 'narrow-long-full-text.png') });
    writeFileSync(resolve(dir, 'metrics.json'), JSON.stringify({ phase, mapHash, metrics }, null, 2));
});
