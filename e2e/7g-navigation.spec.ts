import { expect, test } from '@playwright/test';
import { hasSnapshot, loadSnapshot } from './support/snapshot.ts';

test.skip(!hasSnapshot, 'the route audit needs the real local snapshot');

test('mobile map to book to path and back preserves the real reading position and focus', async ({ page }) => {
    const snapshot = loadSnapshot();
    const highlight = snapshot.highlights.find((item) => item.id === 'h-013');
    expect(highlight?.tagIds.length).toBeGreaterThan(0);
    if (highlight === undefined) return;
    const book = snapshot.bookById.get(highlight.bookId);
    expect(book).toBeDefined();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/map?tag=tag-035&h=h-013');
    await expect(page.locator('.map-detail-passage')).toHaveText(highlight.text);
    await expect(page.locator('#map-detail-heading')).toBeFocused();
    await page.getByTestId('map-detail').getByRole('link', { name: '进入这本书' }).click();
    await expect(page).toHaveURL(new RegExp(`/books/${highlight.bookId}$`));
    await expect(page.getByTestId('room-heading')).toContainText(book?.title ?? '');
    await page.getByTestId('room-back').click();
    await expect(page.locator('.map-detail-passage')).toHaveText(highlight.text);
    await expect(page.locator('#map-detail-heading')).toBeFocused();

    await page.getByTestId('map-detail').getByRole('link', { name: '沿小径继续' }).click();
    const pathUrl = page.url();
    const pathText = await page.getByTestId('path-passage').innerText();
    expect(snapshot.byText.has(pathText.trim())).toBe(true);
    await page.locator('.path-book-link').click();
    await expect(page.getByTestId('book-random-text')).toBeVisible();
    await page.getByTestId('room-back').click();
    await expect(page).toHaveURL(pathUrl);
    await expect(page.getByTestId('path-passage')).toHaveText(pathText);
    await page.locator('.path-actions .share-trigger').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.locator('.share-card-text')).toHaveText(pathText);
    await page.keyboard.press('Escape');
    await expect(page.locator('.path-actions .share-trigger')).toBeFocused();
    await page.locator('.room-path .room-exit[href^="/map?"]').click();
    await expect(page.getByTestId('map-canvas')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
