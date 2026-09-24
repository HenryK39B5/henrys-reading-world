import { readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import type { Snapshot } from '../src/domain/types.ts';

const site = '/henrys-reading-world';
const snapshot = JSON.parse(readFileSync(join(process.cwd(), 'src/data/public-snapshot.json'), 'utf8')) as Snapshot;
const book = snapshot.books[0]!;
const highlight = snapshot.highlights[0]!;
const captures = join(process.cwd(), '.private/review/public-pages-preflight');

test('built project-site hall, navigation, covers, and stable share address', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText: async (text: string) => { sessionStorage.setItem('lastCopiedLink', text); } },
        });
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${site}/`);
    await expect(page.getByTestId('stage-passage')).toBeVisible();
    await mkdir(captures, { recursive: true });
    await page.screenshot({ path: join(captures, 'hall-desktop.png'), fullPage: true });
    await page.getByRole('link', { name: '所有书' }).first().click();
    await expect(page).toHaveURL(`${site}/books`);
    const cover = page.locator('img[src^="/henrys-reading-world/covers/"]').first();
    await expect(cover).toBeVisible();
    expect(await cover.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    await page.goto(`${site}/?h=${encodeURIComponent(highlight.id)}`);
    await expect(page.getByTestId('stage-passage')).toHaveText(highlight.text);
    await page.getByTestId('share-open').click();
    await expect(page.getByTestId('share-dialog')).toBeVisible();
    await page.getByTestId('share-copy-link').click();
    await expect.poll(() => page.evaluate(() => sessionStorage.getItem('lastCopiedLink')))
        .toBe(`http://127.0.0.1:5198${site}/?h=${encodeURIComponent(highlight.id)}`);
    expect(errors).toEqual([]);
});

test('404 fallback retains direct book, map, and unknown URL', async ({ page }) => {
    let response = await page.goto(`${site}/books/${encodeURIComponent(book.id)}`);
    expect(response?.status()).toBe(404);
    await expect(page.getByTestId('book-random-text')).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('book-random-text')).toBeVisible();
    response = await page.goto(`${site}/map`);
    expect(response?.status()).toBe(404);
    await expect(page.getByTestId('map-canvas')).toBeVisible();
    response = await page.goto(`${site}/design`);
    expect(response?.status()).toBe(404);
    await expect(page.getByTestId('room-heading')).toHaveText('这个网站怎么运作');
    await page.getByRole('link', { name: '主题书架' }).last().click();
    await expect(page).toHaveURL(`${site}/themes`);
    response = await page.goto(`${site}/not-a-room`);
    expect(response?.status()).toBe(404);
    await expect(page.getByTestId('room-heading')).toBeVisible();
    await page.getByTestId('exit-hall').click();
    await expect(page).toHaveURL(`${site}/`);
});

test('the finished design page remains readable and linked across widths', async ({ page }) => {
    const folder = join(process.cwd(), '.private/review/site-design');
    await mkdir(folder, { recursive: true });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const width of [1440, 720, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        const response = await page.goto(`${site}/design`);
        expect(response?.status()).toBe(404);
        const article = page.locator('[data-room="design"]');
        await expect(article.getByRole('heading', { name: '地图怎样形成' })).toBeVisible();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `design page at ${String(width)}px`).toBeLessThanOrEqual(1);
        if (width !== 720) {
            await page.screenshot({ path: join(folder, `design-${String(width)}.png`), fullPage: true });
        }
    }
    const pathLink = page.locator('[data-room="design"]').getByRole('link', { name: '主题小径', exact: true });
    await pathLink.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(`${site}/paths`);
});

test('failed public asset stays an honest error state instead of showing invented content', async ({ page }) => {
    await page.route('**/assets/public-snapshot-*.json', (route) => route.fulfill({ status: 503, body: '{}' }));
    await page.goto(`${site}/`);
    await expect(page.getByRole('heading', { name: '数据无法加载' })).toBeVisible();
    await expect(page.getByText('公开数据暂时不可用（HTTP 503）。')).toBeVisible();
    await expect(page.getByTestId('stage-passage')).toHaveCount(0);
});

test('mobile project-site navigation stays in the project', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${site}/paths`);
    await expect(page.getByTestId('room-heading')).toHaveText('主题小径');
    const target = page.locator('a[href^="/henrys-reading-world/paths/"]').first();
    await target.click();
    await expect(page).toHaveURL(/\/henrys-reading-world\/paths\//u);
    await expect(page.getByTestId('path-passage')).toBeVisible();
    await mkdir(captures, { recursive: true });
    await page.screenshot({ path: join(captures, 'path-mobile.png'), fullPage: true });
});
