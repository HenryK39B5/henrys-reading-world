import { expect, test } from '@playwright/test';
import { loadSnapshot } from './support/snapshot.ts';

test('the real map, reading rooms and directories share a night system without losing their roles', async ({ page }) => {
    const snapshot = loadSnapshot();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/paths');
    await expect(page.locator('.path-list-link')).toHaveCount(snapshot.tags.length);
    await expect(page.locator('.path-list')).toHaveCSS('grid-template-columns', /\d+px \d+px/);
    const readingPaper = await page.locator('.shell').evaluate((node) => getComputedStyle(node).getPropertyValue('--paper').trim());
    await page.getByTestId('nav-books').click();
    await expect(page.getByTestId('book-list')).toBeVisible();
    await page.locator('.book-link').first().click();
    await expect(page.getByTestId('book-random-text')).toBeVisible();
    expect(snapshot.byText.has((await page.getByTestId('book-random-text').innerText()).trim())).toBe(true);
    await page.getByTestId('book-map-link').click();
    await expect(page.getByTestId('map-canvas')).toBeVisible();
    await expect(page.locator('.shell--dark-map')).toBeVisible();
    const mapPaper = await page.locator('.shell').evaluate((node) => getComputedStyle(node).getPropertyValue('--paper').trim());
    expect(readingPaper).not.toBe(mapPaper);
    await page.getByTestId('nav-hall').click();
    await expect(page.locator('.shell--night:not(.shell--dark-map)')).toBeVisible();
});

test('320px long text, share and map remain readable with reduced motion', async ({ page }) => {
    const snapshot = loadSnapshot();
    await page.setViewportSize({ width: 320, height: 720 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`/?h=${snapshot.longest.id}`);
    await expect(page.getByTestId('stage-passage')).toHaveText(snapshot.longest.text);
    await expect(page.locator('.stage')).toHaveCSS('animation-name', 'none');
    await page.getByTestId('stage-passage').scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByTestId('share-open').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.locator('.share-card-text')).toHaveText(snapshot.longest.text);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('share-open')).toBeFocused();
    await page.getByTestId('nav-map').click();
    await expect(page.getByTestId('map-canvas')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('200% equivalent width keeps the full passage and all navigation destinations', async ({ page }) => {
    await page.setViewportSize({ width: 720, height: 450 });
    await page.goto('/paths/tag-040');
    await expect(page.getByTestId('path-passage')).toBeVisible();
    await expect(page.locator('.nav-link')).toHaveCount(6);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
