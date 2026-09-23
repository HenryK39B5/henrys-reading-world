import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { contrastRatio } from '../src/domain/accent.ts';
import { hasSnapshot, loadSnapshot } from './support/snapshot.ts';

const dir = resolve('.private/review/v3-private-atlas/7h');
const rooms = [
    '/', '/books', '/books/b-099', '/books/b-040', '/paths', '/paths/tag-040', '/themes', '/map',
    '/map?book=b-013', '/map?tag=tag-035&h=h-013',
];
const textSelectors = [
    '.brand', '.nav-link:not([aria-current])', '.nav-link[aria-current]', '.local-badge', '.room-note',
    '.stage-text', '.stage-attribution', '.book-random-text', '.book-head-meta', '.book-cover-fallback',
    '.path-text', '.path-list-number', '.path-list-description', '.paths-total', '.book-meta',
    '.map-summary', '.map-detail-passage p', '.map-detail-source', '.map-book-light strong',
];

test.skip(!hasSnapshot, 'the audit needs the real local snapshot');
test.setTimeout(180_000);

test('reading surfaces keep named landmarks and legible interface text across layouts', async ({ page }) => {
    const snapshot = loadSnapshot();
    expect(snapshot.books).toHaveLength(130);
    mkdirSync(dir, { recursive: true });
    const results: Array<{ width: number; route: string; selector: string; ratio: number }> = [];
    for (const width of [320, 390, 720, 1440]) {
        await page.setViewportSize({ width, height: width === 720 ? 450 : width === 1440 ? 900 : width === 390 ? 844 : 720 });
        await page.emulateMedia({ reducedMotion: 'reduce' });
        for (const route of rooms) {
            await page.goto(route);
            await expect(page.getByRole('main')).toBeVisible();
            await expect(page.getByRole('navigation', { name: '主要导航' })).toBeVisible();
            await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
            if (route === '/map') await expect(page.locator('.map-region-list a').first()).toBeVisible();
            if (route.includes('?book=')) {
                await expect(page.locator('.map-book-light strong')).toBeVisible();
                await page.waitForTimeout(750);
            }
            const samples = await page.evaluate((selectors) => {
                const shell = document.querySelector('.shell');
                if (shell === null) return [];
                const paper = getComputedStyle(shell).getPropertyValue('--paper').trim();
                const canvas = document.createElement('canvas');
                canvas.width = canvas.height = 1;
                const context = canvas.getContext('2d');
                if (context === null) throw new Error('colour readback needs a 2D context');
                const channels = (colour: string) => {
                    context.fillStyle = colour;
                    context.fillRect(0, 0, 1, 1);
                    const data = context.getImageData(0, 0, 1, 1).data;
                    return { r: data[0] ?? 0, g: data[1] ?? 0, b: data[2] ?? 0 };
                };
                return selectors.flatMap((selector) => {
                    const element = document.querySelector(selector);
                    if (element === null || element.getBoundingClientRect().width === 0) return [];
                    const detail = element.closest('.map-detail');
                    return [{ selector, foreground: channels(getComputedStyle(element).color),
                        background: channels(detail === null ? paper : getComputedStyle(detail).backgroundColor) }];
                });
            }, textSelectors);
            for (const sample of samples) {
                results.push({ width, route, selector: sample.selector,
                    ratio: contrastRatio(sample.foreground, sample.background) });
            }
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        }
    }
    const failures = results.filter((sample) => sample.ratio < 4.5);
    writeFileSync(resolve(dir, 'contrast.json'), JSON.stringify({ count: results.length, minimum: Math.min(...results.map((sample) => sample.ratio)), failures }, null, 2));
    console.log(`7H text samples: ${results.length}; below 4.5: ${failures.length}`);
    expect(failures).toEqual([]);
});

test('keyboard traversal has visible and named focus on the real reading routes', async ({ page }) => {
    mkdirSync(dir, { recursive: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const issues: Array<{ route: string; step: number; reason: string }> = [];
    for (const route of ['/', '/books', '/paths', '/map', '/map?tag=tag-035&h=h-013']) {
        await page.goto(route);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await page.locator('#room').focus();
        for (let step = 0; step < 25; step += 1) {
            await page.keyboard.press('Tab');
            if (await page.evaluate(() => document.activeElement?.tagName === 'BODY')) break;
            const stop = await page.evaluate(() => {
                const element = document.activeElement;
                if (!(element instanceof HTMLElement)) return { name: '', visible: false, hidden: true };
                const style = getComputedStyle(element);
                const name = element.getAttribute('aria-label') ?? element.textContent?.trim() ?? '';
                const visiblyFocused = (style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) > 0)
                    || (style.boxShadow !== 'none' && style.boxShadow !== '');
                return { name, visible: visiblyFocused, hidden: element.closest('[aria-hidden="true"]') !== null };
            });
            if (stop.name.length === 0) issues.push({ route, step, reason: 'unnamed focus stop' });
            if (!stop.visible) issues.push({ route, step, reason: 'no visible focus' });
            if (stop.hidden) issues.push({ route, step, reason: 'focus inside aria-hidden subtree' });
        }
    }
    writeFileSync(resolve(dir, 'focus.json'), JSON.stringify({ routes: 5, issues }, null, 2));
    console.log(`7H keyboard traversal issues: ${issues.length}`);
    expect(issues).toEqual([]);
});
