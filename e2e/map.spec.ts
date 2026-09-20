import { expect, test } from '@playwright/test';
import { hasSnapshot, loadSnapshot } from './support/snapshot.ts';

test.describe('V3 reading world map', () => {
    test.skip(!hasSnapshot, 'private local snapshot is not available');

    test('renders the full real world on one canvas with a complete region-list alternative', async ({ page }) => {
        const data = loadSnapshot();
        expect(data.map).toBeDefined();
        await page.goto('/map');
        await expect(page.getByTestId('room-heading')).toHaveText('阅读世界地图');
        await expect(page.getByTestId('map-summary')).toContainText(`${data.highlights.length} 个真实点`);
        await expect(page.getByTestId('map-summary')).toContainText(`${data.highlights.filter((entry) => entry.tagIds.length > 0).length} 个已命名点`);
        await expect(page.locator('.map-region-list > li')).toHaveCount(data.tags.length);
        await expect(page.getByTestId('map-canvas')).toBeVisible();

        const canvasEvidence = await page.getByTestId('map-canvas').evaluate((canvas) => {
            const element = canvas as HTMLCanvasElement;
            const context = element.getContext('2d');
            if (context === null) return { coloured: 0, width: 0, height: 0 };
            const pixels = context.getImageData(0, 0, element.width, element.height).data;
            let coloured = 0;
            for (let index = 3; index < pixels.length; index += 4) {
                if ((pixels[index] ?? 0) > 0) coloured += 1;
            }
            return { coloured, width: element.width, height: element.height };
        });
        expect(canvasEvidence.width).toBeGreaterThan(500);
        expect(canvasEvidence.height).toBeGreaterThan(500);
        expect(canvasEvidence.coloured).toBeGreaterThan(2_000);

        const dom = await page.evaluate(() => ({
            elements: document.querySelectorAll('*').length,
            buttons: document.querySelectorAll('button').length,
            canvases: document.querySelectorAll('canvas').length,
            renderedPassages: document.querySelectorAll('.map-detail-passage, .map-point-list').length,
        }));
        expect(dom.canvases).toBe(1);
        expect(dom.buttons).toBeLessThan(30);
        expect(dom.elements).toBeLessThan(800);
        expect(dom.renderedPassages).toBe(0);
    });

    test('opens a topic region, a real point and restores the same viewport through Back', async ({ page }) => {
        const data = loadSnapshot();
        const tag = data.tags.find((entry) => data.highlights.filter((highlight) => highlight.tagIds.includes(entry.id)).length >= 3);
        expect(tag).toBeDefined();
        if (tag === undefined) return;
        const members = data.highlights.filter((highlight) => highlight.tagIds.includes(tag.id));

        await page.goto(`/map?tag=${tag.id}`);
        await expect(page.getByTestId('room-heading')).toHaveText(tag.title);
        await expect(page.locator('.map-point-list > li')).toHaveCount(members.length);
        await page.getByRole('button', { name: '放大地图' }).click();
        await page.getByRole('button', { name: '放大地图' }).click();
        const zoom = await page.getByTestId('map-canvas').getAttribute('data-map-zoom');

        await page.locator('.map-point-list a').first().click();
        await expect(page.getByTestId('map-detail')).toBeVisible();
        const selected = members[0];
        expect(selected).toBeDefined();
        if (selected !== undefined) await expect(page.locator('.map-detail-passage')).toHaveText(selected.text);

        await page.goBack();
        await expect(page.getByTestId('map-detail')).toHaveCount(0);
        await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-zoom', zoom ?? '');
    });

    test('enters from a book room and lights that book with its real Book Aura', async ({ page }) => {
        const data = loadSnapshot();
        const covered = data.books.filter((book) => book.coverPath !== undefined).slice(0, 6);
        expect(covered).toHaveLength(6);
        const first = covered[0];
        expect(first).toBeDefined();
        if (first === undefined) return;

        await page.goto(`/books/${first.id}`);
        await page.getByTestId('book-map-link').click();
        await expect(page).toHaveURL(new RegExp(`/map\\?book=${first.id}`));
        await expect(page.locator('.map-book-light strong')).toContainText(first.title);

        const colours = new Set<string>();
        for (const book of covered) {
            await page.locator('.map-book-picker select').selectOption(book.id);
            await expect(page).toHaveURL(new RegExp(`book=${book.id}`));
            await expect(page.locator('.map-book-light strong')).toContainText(book.title);
            await page.waitForTimeout(700);
            colours.add(await page.locator('.map-book-light').evaluate((element) =>
                getComputedStyle(element).getPropertyValue('--map-book-aura').trim(),
            ));
        }
        expect(colours.size).toBeGreaterThanOrEqual(4);
    });

    test('keeps all tags in a map detail and its share card', async ({ page }) => {
        const data = loadSnapshot();
        const highlight = data.highlights.find((entry) => entry.tagIds.length === 3);
        expect(highlight).toBeDefined();
        if (highlight === undefined) return;
        const tagId = highlight.tagIds[0];
        expect(tagId).toBeDefined();
        if (tagId === undefined) return;

        await page.goto(`/map?tag=${tagId}&h=${highlight.id}`);
        await expect(page.getByTestId('map-detail')).toBeVisible();
        await expect(page.getByTestId('map-detail').getByTestId('topic-clues').locator('a')).toHaveCount(3);
        await page.getByTestId('map-detail').getByRole('button', { name: '分享' }).click();
        await expect(page.getByTestId('share-card-tags').locator('span')).toHaveCount(3);
    });

    test('zooms around the pointer instead of pulling the chosen place away', async ({ page }) => {
        await page.setViewportSize({ width: 1200, height: 900 });
        await page.goto('/map');
        const canvas = page.getByTestId('map-canvas');
        const box = await canvas.boundingBox();
        expect(box).not.toBeNull();
        if (box === null) return;
        const anchor = { x: box.x + box.width * 0.72, y: box.y + box.height * 0.31 };
        const readView = async () => ({
            centerX: Number(await canvas.getAttribute('data-map-center-x')),
            centerY: Number(await canvas.getAttribute('data-map-center-y')),
            zoom: Number(await canvas.getAttribute('data-map-zoom')),
        });
        const mapAtAnchor = (view: { centerX: number; centerY: number; zoom: number }) => {
            const scale = (Math.min(box.width, box.height) / 10_000) * view.zoom;
            return {
                x: view.centerX + (anchor.x - box.x - box.width / 2) / scale,
                y: view.centerY + (anchor.y - box.y - box.height / 2) / scale,
            };
        };
        const before = mapAtAnchor(await readView());
        await page.mouse.move(anchor.x, anchor.y);
        await page.mouse.wheel(0, -240);
        await expect(canvas).not.toHaveAttribute('data-map-zoom', '1.000');
        const after = mapAtAnchor(await readView());
        expect(after.x).toBeCloseTo(before.x, -1);
        expect(after.y).toBeCloseTo(before.y, -1);
        await expect(page.locator('.map-zoom-readout')).not.toHaveText('100%');
    });

    test('supports keyboard pan and zoom while keeping the semantic lists operable', async ({ page }) => {
        await page.goto('/map');
        const canvas = page.getByTestId('map-canvas');
        await canvas.focus();
        const beforeZoom = await canvas.getAttribute('data-map-zoom');
        await page.keyboard.press('+');
        await expect(canvas).not.toHaveAttribute('data-map-zoom', beforeZoom ?? '');
        const beforeX = await canvas.getAttribute('data-map-center-x');
        await page.keyboard.press('ArrowRight');
        await expect(canvas).not.toHaveAttribute('data-map-center-x', beforeX ?? '');

        await page.locator('.map-region-list a').first().focus();
        await page.keyboard.press('Enter');
        await expect(page.getByTestId('room-heading')).not.toHaveText('阅读世界地图');
        await expect(page.locator('.map-point-list a').first()).toBeVisible();
    });
});
