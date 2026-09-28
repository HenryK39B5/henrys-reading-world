import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { mapToScreen, WORLD_MAP_VIEW, type MapViewport } from '../src/domain/map.ts';
import { mapReadingWindow } from '../src/domain/mapReading.ts';
import { indexSnapshot } from '../src/domain/snapshot.ts';
import type { Snapshot } from '../src/domain/types.ts';

const index = indexSnapshot(JSON.parse(readFileSync(new URL('../src/data/public-snapshot.json', import.meta.url), 'utf8')) as Snapshot);
const layout = index.snapshot.map;

async function openAnUnnamedPart(page: Page) {
    const canvas = page.getByTestId('map-canvas');
    const bounds = await canvas.boundingBox();
    expect(bounds).not.toBeNull();
    expect(layout).toBeDefined();
    if (bounds === null || layout === undefined) throw Error('The real public map must be present');
    const labels = layout.labels.map((label) => mapToScreen(label, WORLD_MAP_VIEW, bounds.width, bounds.height));
    const target = layout.points.find((point) => {
        const screen = mapToScreen(point, WORLD_MAP_VIEW, bounds.width, bounds.height);
        return screen.x > bounds.width * 0.25 && screen.x < bounds.width * 0.75 &&
            screen.y > bounds.height * 0.27 && screen.y < bounds.height * 0.72 &&
            labels.every((label) => Math.hypot(screen.x - label.x, screen.y - label.y) > 55);
    });
    expect(target).toBeDefined();
    if (target === undefined) throw Error('No visible real unlabelled location');
    const screen = mapToScreen(target, WORLD_MAP_VIEW, bounds.width, bounds.height);
    await canvas.click({ position: { x: screen.x, y: screen.y } });
    await expect(page.getByTestId('map-reading-window')).toBeVisible();
    return canvas;
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 720 }]) {
    test(`reading a real unnamed part of the published map at ${viewport.width}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.goto('/map');
        const canvas = await openAnUnnamedPart(page);
        const bounds = await canvas.boundingBox();
        expect(bounds).not.toBeNull();
        if (bounds === null) return;
        const view: MapViewport = {
            centerX: Number(await canvas.getAttribute('data-map-center-x')),
            centerY: Number(await canvas.getAttribute('data-map-center-y')),
            zoom: Number(await canvas.getAttribute('data-map-zoom')),
        };
        const contents = mapReadingWindow(index, view, bounds.width, bounds.height);
        expect(contents.entries.length).toBeGreaterThan(0);
        await expect(page.locator('.map-reading-passage p')).toHaveText(contents.entries[0]?.highlight.text ?? '');
        await expect(page.locator('.map-reading-window .map-reading-count')).toContainText(`${contents.entries.length} 处划线 · 来自 ${contents.books.length} 本书`);
        await expect(page.locator('.map-reading-books').first().locator('li').first()).toContainText(contents.books[0]?.book.title ?? '');
        await page.screenshot({ path: `.private/review/map-readable/reading-${viewport.width}.png`, fullPage: false });

        const firstId = contents.entries[0]?.highlight.id;
        expect(firstId).toBeDefined();
        const zoom = await canvas.getAttribute('data-map-zoom');
        await expect.poll(() => page.evaluate(() => sessionStorage.getItem('reading-world:map:world-view:v1'))).not.toBeNull();
        await page.reload();
        await expect(page.getByTestId('map-reading-window')).toBeVisible();
        await expect(page.locator('.map-reading-passage p')).toHaveText(contents.entries[0]?.highlight.text ?? '');
        await expect(canvas).toHaveAttribute('data-map-zoom', zoom ?? '');
        await page.getByRole('link', { name: '在图上读这一处' }).click();
        await expect(page.locator('.map-detail-passage')).toHaveText(contents.entries[0]?.highlight.text ?? '');
        expect(new URL(page.url()).searchParams.get('h')).toBe(firstId);
        await page.goBack();
        await expect(page.getByTestId('map-reading-window')).toBeVisible();
        await expect(canvas).toHaveAttribute('data-map-zoom', zoom ?? '');
        await expect(page.getByRole('link', { name: '在图上读这一处' })).toBeFocused();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
}

test('keyboard zoom and reduced-motion keep local text accessible at a 720px reflow', async ({ page }) => {
    await page.setViewportSize({ width: 720, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/map');
    for (let step = 0; step < 6; step++) await page.getByRole('button', { name: '放大地图' }).click();
    await expect(page.getByTestId('map-reading-window')).toBeVisible();
    await expect(page.getByRole('link', { name: '在图上读这一处' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: '.private/review/map-readable/reading-720-reduced.png', fullPage: false });
});

test('the bounded text list can open an untagged real point in the same area', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/map');
    const canvas = await openAnUnnamedPart(page);
    const bounds = await canvas.boundingBox();
    if (bounds === null) throw Error('Missing map canvas');
    const local = mapReadingWindow(index, {
        centerX: Number(await canvas.getAttribute('data-map-center-x')),
        centerY: Number(await canvas.getAttribute('data-map-center-y')),
        zoom: Number(await canvas.getAttribute('data-map-zoom')),
    }, bounds.width, bounds.height);
    const unknown = local.entries.find((entry) => entry.highlight.tagIds.length === 0);
    expect(unknown).toBeDefined();
    if (unknown === undefined) return;
    const list = page.getByTestId('map-reading-all');
    await list.locator('summary').click();
    const target = list.locator(`a[href="/map?h=${unknown.highlight.id}"]`);
    for (let attempt = 0; attempt < Math.ceil(local.entries.length / 16) && await target.count() === 0; attempt++) {
        await list.getByRole('button', { name: '再看这片的划线' }).click();
    }
    await expect(target).toBeVisible();
    await target.click();
    await expect(page.locator('.map-detail-passage')).toHaveText(unknown.highlight.text);
    await page.goBack();
    await expect(page.getByTestId('map-reading-window')).toBeVisible();
    await expect(target).toBeFocused();
});

test('panning changes the true local reading window, while reviewed tags remain optional', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/map');
    const canvas = await openAnUnnamedPart(page);
    const firstCenter = Number(await canvas.getAttribute('data-map-center-x'));
    await canvas.focus();
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => Number(await canvas.getAttribute('data-map-center-x'))).not.toBe(firstCenter);
    const bounds = await canvas.boundingBox();
    expect(bounds).not.toBeNull();
    if (bounds === null) return;
    const current = mapReadingWindow(index, {
        centerX: Number(await canvas.getAttribute('data-map-center-x')),
        centerY: Number(await canvas.getAttribute('data-map-center-y')),
        zoom: Number(await canvas.getAttribute('data-map-zoom')),
    }, bounds.width, bounds.height);
    if (current.entries.length > 0) await expect(page.locator('.map-reading-passage p')).toHaveText(current.entries[0]?.highlight.text ?? '');
    const untagged = index.snapshot.highlights.find((entry) => entry.tagIds.length === 0);
    expect(untagged).toBeDefined();
    if (untagged === undefined) return;
    await page.goto(`/map?h=${untagged.id}`);
    await expect(page.locator('.map-detail-passage')).toHaveText(untagged.text);
    await expect(page.locator('.map-detail .topic-clues')).toHaveCount(0);
});
