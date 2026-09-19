import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { hasSnapshot, loadSnapshot } from './support/snapshot.ts';

const OUT_DIR = join(process.cwd(), '.private/review/v3-batch5');

async function noOverflow(page: Page): Promise<number> {
    return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

async function canvasPixels(page: Page): Promise<number> {
    return page.getByTestId('map-canvas').evaluate((canvas) => {
        const element = canvas as HTMLCanvasElement;
        const context = element.getContext('2d');
        if (context === null) return 0;
        const pixels = context.getImageData(0, 0, element.width, element.height).data;
        let count = 0;
        for (let index = 3; index < pixels.length; index += 4) {
            if ((pixels[index] ?? 0) > 0) count += 1;
        }
        return count;
    });
}

test.describe('Batch 5 world map visual evidence', () => {
    test.skip(!hasSnapshot, '需要包含 map 的 schema 3 local snapshot');

    test.beforeAll(() => {
        if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
    });

    test('captures the world and one real topic region at 1440, 390 and 320', async ({ page }) => {
        const data = loadSnapshot();
        const tag = data.tags.find((entry) => data.highlights.filter((highlight) => highlight.tagIds.includes(entry.id)).length >= 5) ?? data.tags[0];
        expect(tag).toBeDefined();
        if (tag === undefined) return;

        for (const viewport of [
            { width: 1440, height: 1000, name: '1440' },
            { width: 390, height: 844, name: '390' },
            { width: 320, height: 720, name: '320' },
        ]) {
            await page.setViewportSize(viewport);
            await page.goto('/map');
            await expect(page.getByTestId('map-canvas')).toBeVisible();
            await page.waitForTimeout(520);
            expect(await canvasPixels(page), `world ${viewport.name} canvas`).toBeGreaterThan(2_000);
            expect(await noOverflow(page), `world ${viewport.name}`).toBeLessThanOrEqual(1);
            await page.screenshot({ path: join(OUT_DIR, `world-${viewport.name}.png`) });

            await page.goto(`/map?tag=${tag.id}`);
            await expect(page.getByTestId('room-heading')).toHaveText(tag.title);
            await page.waitForTimeout(520);
            expect(await canvasPixels(page), `region ${viewport.name} canvas`).toBeGreaterThan(1_000);
            expect(await noOverflow(page), `region ${viewport.name}`).toBeLessThanOrEqual(1);
            await page.screenshot({ path: join(OUT_DIR, `region-${viewport.name}.png`) });
        }
    });

    test('captures a real detail and six different Book Aura selections', async ({ page }) => {
        const data = loadSnapshot();
        const detail = data.highlights.find((entry) => entry.tagIds.length === 3);
        expect(detail).toBeDefined();
        if (detail === undefined) return;
        const tagId = detail.tagIds[0];
        expect(tagId).toBeDefined();
        if (tagId === undefined) return;

        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(`/map?tag=${tagId}&h=${detail.id}`);
        await expect(page.getByTestId('map-detail')).toBeVisible();
        await page.waitForTimeout(520);
        await page.getByTestId('map-detail').scrollIntoViewIfNeeded();
        expect(await noOverflow(page), 'detail 390').toBeLessThanOrEqual(1);
        await page.screenshot({ path: join(OUT_DIR, 'detail-390.png') });

        const books = data.books.filter((book) => book.coverPath !== undefined).slice(0, 6);
        expect(books).toHaveLength(6);
        await page.setViewportSize({ width: 1440, height: 1000 });
        const colours = new Set<string>();
        for (const [index, book] of books.entries()) {
            await page.goto(`/map?book=${book.id}`);
            await expect(page.locator('.map-book-light strong')).toContainText(book.title);
            await page.waitForTimeout(750);
            const colour = await page.locator('.map-book-light').evaluate((element) =>
                getComputedStyle(element).getPropertyValue('--map-book-aura').trim(),
            );
            colours.add(colour);
            expect(await canvasPixels(page), `book aura ${String(index + 1)}`).toBeGreaterThan(2_000);
            await page.screenshot({ path: join(OUT_DIR, `book-aura-${String(index + 1)}.png`) });
        }
        expect(colours.size).toBeGreaterThanOrEqual(4);
    });

    test('captures reduced motion without map transitions', async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        const data = loadSnapshot();
        const tag = data.tags[0];
        expect(tag).toBeDefined();
        if (tag === undefined) return;
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(`/map?tag=${tag.id}`);
        await page.waitForTimeout(120);
        const transitions = await page.locator('.map-canvas').evaluate((element) => ({
            transition: getComputedStyle(element).transitionDuration,
            animation: getComputedStyle(element).animationName,
        }));
        expect(transitions.animation).toBe('none');
        expect(transitions.transition).toMatch(/^(?:0s|0\.00001s|1e-05s)$/u);
        await page.screenshot({ path: join(OUT_DIR, 'region-reduced-motion-390.png') });
    });
});
