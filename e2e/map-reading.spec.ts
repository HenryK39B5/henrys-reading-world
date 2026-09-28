import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { mapToScreen, WORLD_MAP_VIEW, type MapViewport } from '../src/domain/map.ts';
import { compareWithBook, mapReadingWindow, otherBooksInWindow, sharedReviewedTags } from '../src/domain/mapReading.ts';
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
    test(`reading a real unnamed part of the published map at ${viewport.width}`, async ({ page }, testInfo) => {
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
        await expect(page.getByTestId('map-reading-window')).not.toContainText('未标主题的也在这里');
        await expect(page.getByTestId('map-reading-window')).not.toContainText('位置相近不代表观点相同');
        const anotherBook = contents.entries[0] === undefined ? undefined : otherBooksInWindow(contents, contents.entries[0])[0];
        expect(anotherBook).toBeDefined();
        await expect(page.locator('.map-reading-books').first().locator('li').first()).toContainText(anotherBook?.book.title ?? '');
        await page.screenshot({ path: `.private/review/map-readable/reading-${viewport.width}-${testInfo.project.name}.png`, fullPage: false });

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

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 720 }]) {
    test(`a chosen other book reveals a second full genuine passage and its map point at ${viewport.width}`, async ({ page }, testInfo) => {
        await page.setViewportSize(viewport);
        if (viewport.width === 390) await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto('/map');
        const canvas = await openAnUnnamedPart(page);
        const bounds = await canvas.boundingBox();
        if (bounds === null) throw Error('Missing real map canvas');
        const view = {
            centerX: Number(await canvas.getAttribute('data-map-center-x')),
            centerY: Number(await canvas.getAttribute('data-map-center-y')),
            zoom: Number(await canvas.getAttribute('data-map-zoom')),
        };
        const local = mapReadingWindow(index, view, bounds.width, bounds.height);
        const anchor = local.entries[0];
        if (anchor === undefined) throw Error('Missing real anchor');
        const otherBooks = otherBooksInWindow(local, anchor);
        const group = otherBooks[0];
        if (group === undefined) throw Error('Missing other real book');
        const other = compareWithBook(local, anchor.highlight.id, group.book.id);
        if (other === null) throw Error('Missing nearest real other-book passage');
        const choose = page.getByRole('button', { name: `读《${group.book.title}》在这里的一句` });
        if (viewport.width === 390) {
            await choose.focus();
            await page.keyboard.press('Enter');
        } else await choose.click();
        await expect(choose).toHaveAttribute('aria-expanded', 'true');
        await expect(canvas).toHaveAttribute('data-map-compare-highlight', other.highlight.id);
        await expect(page.locator('.map-reading-window > .map-reading-passage p')).toHaveText(anchor.highlight.text);
        await expect(page.getByTestId('map-reading-comparison').locator('blockquote p')).toHaveText(other.highlight.text);
        await expect(page.getByTestId('map-reading-comparison')).toContainText(group.book.title);
        const shared = sharedReviewedTags(anchor, other);
        if (shared.length === 0) await expect(page.locator('.map-reading-evidence')).toHaveCount(0);
        else await expect(page.locator('.map-reading-evidence')).toContainText('两句都标有');
        await expect(page.getByTestId('map-reading-comparison')).toBeVisible();
        await page.screenshot({ path: `.private/review/map-readable/compare-${viewport.width}-${testInfo.project.name}.png`, fullPage: false });
        await page.getByRole('link', { name: '在图上读②的详情' }).click();
        await expect(page.locator('.map-detail-passage')).toHaveText(other.highlight.text);
        expect(new URL(page.url()).searchParams.get('h')).toBe(other.highlight.id);
        await page.goBack();
        await expect(canvas).toHaveAttribute('data-map-compare-highlight', other.highlight.id);
        await expect(page.getByTestId('map-reading-comparison')).toBeVisible();
        await expect(page.getByRole('link', { name: '在图上读②的详情' })).toBeFocused();
        await page.getByRole('button', { name: '收起②，继续看这片' }).click();
        await expect(choose).toBeFocused();
        await expect(canvas).not.toHaveAttribute('data-map-compare-highlight', /.+/);
        await expect(page.getByTestId('map-reading-comparison')).toHaveCount(0);
        if (viewport.width === 1440) {
            await choose.click();
            await canvas.focus();
            await page.keyboard.press('ArrowRight');
            await expect(canvas).not.toHaveAttribute('data-map-compare-highlight', /.+/);
            await expect(page.getByTestId('map-reading-comparison')).toHaveCount(0);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
}

for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 720 }]) {
    test(`a named Hall sentence enters its own map point and offers a truthful way back at ${viewport.width}`, async ({ page }, testInfo) => {
        await page.setViewportSize(viewport);
        const passage = index.highlightsById.get('h-025');
        if (passage === undefined) throw Error('Public hall passage is missing');
        await page.goto(`/?h=${passage.id}`);
        await expect(page.getByTestId('stage-passage')).toHaveText(passage.text);
        await page.getByTestId('source-toggle').click();
        await page.getByTestId('stage-map-entry').click();
        await expect(page).toHaveURL(/\/map\?h=h-025/);
        await expect(page.locator('.map-detail-passage')).toHaveText(passage.text);
        const canvas = page.getByTestId('map-canvas');
        await expect.poll(async () => Number(await canvas.getAttribute('data-map-zoom'))).toBeGreaterThanOrEqual(4);
        const point = layout?.points.find((entry) => entry.highlightId === passage.id);
        if (point === undefined) throw Error('Actual point is missing');
        const bounds = await canvas.boundingBox();
        if (bounds === null) throw Error('Map canvas missing on arrival');
        const screen = mapToScreen(point, {
            centerX: Number(await canvas.getAttribute('data-map-center-x')),
            centerY: Number(await canvas.getAttribute('data-map-center-y')),
            zoom: Number(await canvas.getAttribute('data-map-zoom')),
        }, bounds.width, bounds.height);
        expect(screen.x).toBeGreaterThanOrEqual(0);
        expect(screen.x).toBeLessThanOrEqual(bounds.width);
        expect(screen.y).toBeGreaterThanOrEqual(0);
        expect(screen.y).toBeLessThanOrEqual(bounds.height);
        await page.screenshot({ path: `.private/review/map-readable/arrival-hall-${viewport.width}-${testInfo.project.name}.png`, fullPage: false });
        await page.locator('.map-detail-actions').getByRole('link', { name: '回到随便看看' }).click();
        await expect(page.getByTestId('stage-passage')).toHaveText(passage.text);
        expect(new URL(page.url()).searchParams.get('h')).toBe(passage.id);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
}

test('a book sentence enters its own point, returns to the book, and the map return keeps its frame', async ({ page }, testInfo) => {
    const book = index.booksInUse[0];
    if (book === undefined) throw Error('No published book is available');
    await page.goto(`/books/${book.id}`);
    const text = await page.getByTestId('book-random-text').innerText();
    await page.getByTestId('book-map-passage').click();
    const mapped = new URL(page.url());
    const id = mapped.searchParams.get('h');
    expect(mapped.searchParams.get('book')).toBe(book.id);
    expect(id).not.toBeNull();
    await expect(page.locator('.map-detail-passage')).toHaveText(text);
    const canvas = page.getByTestId('map-canvas');
    await expect.poll(async () => Number(await canvas.getAttribute('data-map-zoom'))).toBeGreaterThanOrEqual(4);
    const zoom = await canvas.getAttribute('data-map-zoom');
    const centerX = await canvas.getAttribute('data-map-center-x');
    await page.screenshot({ path: `.private/review/map-readable/arrival-book-1440-${testInfo.project.name}.png`, fullPage: false });
    await page.locator('.map-detail-actions').getByRole('link', { name: '回到这本书' }).click();
    await expect(page.getByTestId('book-random-text')).toHaveText(text);
    await page.goBack();
    await expect(page.locator('.map-detail-passage')).toHaveText(text);
    await expect(canvas).toHaveAttribute('data-map-zoom', zoom ?? '');
    await expect(canvas).toHaveAttribute('data-map-center-x', centerX ?? '');
});

test('a path passage enters its tag region at the same original and returns to the path', async ({ page }) => {
    await page.goto('/paths/tag-035');
    const text = await page.getByTestId('path-passage').innerText();
    await page.getByTestId('path-map-passage').click();
    await expect(page.locator('.map-detail-passage')).toHaveText(text);
    expect(new URL(page.url()).searchParams.get('tag')).toBe('tag-035');
    await page.locator('.map-detail-actions').getByRole('link', { name: '回到这条小径' }).click();
    await expect(page.getByTestId('path-passage')).toHaveText(text);
});

test('the reading window can explicitly return to the world and gives focus back to the map', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto('/map');
    const canvas = await openAnUnnamedPart(page);
    await page.getByRole('button', { name: '回到世界总览' }).click();
    await expect(page.getByTestId('map-reading-window')).toHaveCount(0);
    await expect(canvas).toHaveAttribute('data-map-zoom', '1.000');
    await expect(canvas).toBeFocused();
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 720 }]) {
    test(`map annotations leave no empty badge and keep real place-name hit targets at ${viewport.width}`, async ({ page }, testInfo) => {
        await page.setViewportSize(viewport);
        await page.goto('/map');
        const readout = page.locator('.map-hover-readout');
        await expect(readout).toBeEmpty();
        expect(await readout.evaluate((element) => element.getBoundingClientRect().width)).toBeLessThanOrEqual(1);
        await page.screenshot({ path: `.private/review/map-readable/annotation-world-${viewport.width}-${testInfo.project.name}.png`, fullPage: false });

        const label = layout?.labels.find((entry) => entry.tagId === 'tag-040');
        if (label === undefined) throw Error('Public map place name missing');
        await page.goto('/map?tag=tag-040');
        const canvas = page.getByTestId('map-canvas');
        await canvas.scrollIntoViewIfNeeded();
        const box = await canvas.boundingBox();
        if (box === null) throw Error('Map canvas missing');
        const screen = mapToScreen(label, {
            centerX: Number(await canvas.getAttribute('data-map-center-x')),
            centerY: Number(await canvas.getAttribute('data-map-center-y')),
            zoom: Number(await canvas.getAttribute('data-map-zoom')),
        }, box.width, box.height);
        await page.mouse.move(box.x + screen.x, box.y + screen.y);
        await expect(readout).toContainText('交易');
        expect(await readout.evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThan(40);
        await page.screenshot({ path: `.private/review/map-readable/annotation-region-${viewport.width}-${testInfo.project.name}.png`, fullPage: false });
        await page.mouse.move(0, 0);
        await expect(readout).toBeEmpty();
        expect(await readout.evaluate((element) => element.getBoundingClientRect().width)).toBeLessThanOrEqual(1);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
}

test('shared reviewed tags are labelled as classification, never as similarity or agreement', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/map');
    const canvas = page.getByTestId('map-canvas');
    const bounds = await canvas.boundingBox();
    const point = layout?.points.find((entry) => entry.highlightId === 'h-025');
    if (bounds === null || point === undefined) throw Error('Public point for real reviewed-tag countercheck is missing');
    const screen = mapToScreen(point, WORLD_MAP_VIEW, bounds.width, bounds.height);
    await canvas.click({ position: screen });
    await expect(page.getByTestId('map-reading-window')).toBeVisible();
    const readingBounds = await canvas.boundingBox();
    if (readingBounds === null) throw Error('Missing reading canvas');
    const local = mapReadingWindow(index, {
        centerX: Number(await canvas.getAttribute('data-map-center-x')),
        centerY: Number(await canvas.getAttribute('data-map-center-y')),
        zoom: Number(await canvas.getAttribute('data-map-zoom')),
    }, readingBounds.width, readingBounds.height);
    const anchor = local.entries[0];
    expect(anchor?.highlight.id).toBe('h-025');
    if (anchor === undefined) return;
    const group = otherBooksInWindow(local, anchor).find((entry) => entry.book.id === 'b-055');
    if (group === undefined) throw Error('Real second book no longer falls inside the published local window');
    const other = compareWithBook(local, anchor.highlight.id, group.book.id);
    expect(other?.highlight.id).toBe('h-4169');
    if (other === null) return;
    const choice = page.getByRole('button', { name: `读《${group.book.title}》在这里的一句` });
    if (await choice.count() === 0) await page.locator('.map-reading-rest summary').click();
    await choice.click();
    await expect(canvas).toHaveAttribute('data-map-compare-highlight', other.highlight.id);
    const shared = sharedReviewedTags(anchor, other);
    expect(shared).toEqual(['tag-054']);
    await expect(page.locator('.map-reading-evidence')).toContainText(index.tagsById.get(shared[0] ?? '')?.title ?? '');
    await expect(page.locator('.map-reading-evidence')).toContainText('两句都标有');
    await expect(page.getByTestId('map-reading-comparison').locator('blockquote p')).toHaveText(other.highlight.text);
});

test('keyboard zoom and reduced-motion keep local text accessible at a 720px reflow', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 720, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/map');
    for (let step = 0; step < 6; step++) await page.getByRole('button', { name: '放大地图' }).click();
    await expect(page.getByTestId('map-reading-window')).toBeVisible();
    await expect(page.getByRole('link', { name: '在图上读这一处' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `.private/review/map-readable/reading-720-reduced-${testInfo.project.name}.png`, fullPage: false });
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
