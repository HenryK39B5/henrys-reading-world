import { expect, test } from '@playwright/test';
import { mapToScreen } from '../src/domain/map.ts';
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
        await expect(page.locator('.map-region-list > li')).toHaveCount(Math.min(12, data.tags.length));
        await expect(page.getByTestId('map-regions-toggle')).toHaveAttribute('aria-expanded', 'false');
        await page.getByTestId('map-regions-toggle').click();
        await expect(page.locator('.map-region-list > li')).toHaveCount(data.tags.length);
        await expect(page.getByTestId('map-regions-toggle')).toHaveAttribute('aria-expanded', 'true');
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
        await expect(page.locator('.map-point-list > li')).toHaveCount(Math.min(12, members.length));
        if (members.length > 12) {
            await page.getByTestId('map-points-toggle').click();
            await expect(page.locator('.map-point-list > li')).toHaveCount(members.length);
        }
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

    test('brings a point-list arrival into view on mobile and returns to its opener on Back', async ({ page }) => {
        const data = loadSnapshot();
        const tag = data.tags.find((entry) => data.highlights.filter((highlight) => highlight.tagIds.includes(entry.id)).length > 12);
        expect(tag).toBeDefined();
        if (tag === undefined) return;
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(`/map?tag=${tag.id}`);
        const opener = page.locator('.map-point-list a').first();
        await opener.click();
        await expect(page.getByTestId('map-detail')).toBeVisible();
        const heading = page.locator('#map-detail-heading');
        await expect(heading).toBeFocused();
        await expect.poll(() => heading.evaluate((node) => {
            const box = node.getBoundingClientRect();
            return box.top >= 0 && box.bottom <= window.innerHeight * 0.45;
        })).toBe(true);
        expect(await page.locator('.map-detail-passage').evaluate((node) => node.getBoundingClientRect().top < innerHeight * 0.7)).toBe(true);
        await page.goBack();
        await expect(page.getByTestId('map-detail')).toHaveCount(0);
        await expect(opener).toBeFocused();
        expect(await opener.evaluate((node) => {
            const box = node.getBoundingClientRect();
            return box.top < window.innerHeight && box.bottom > 0;
        })).toBe(true);
    });

    test('opens a direct long-passage map link in view, without truncating the real text', async ({ page }) => {
        const data = loadSnapshot();
        const longest = data.highlights.find((entry) => entry.id === 'h-231');
        expect(longest).toBeDefined();
        if (longest === undefined) return;
        await page.setViewportSize({ width: 320, height: 720 });
        await page.goto(`/map?h=${longest.id}`);
        await expect(page.locator('.map-detail-passage')).toHaveText(longest.text);
        await expect(page.locator('#map-detail-heading')).toBeFocused();
        await expect.poll(() => page.locator('#map-detail-heading').evaluate((node) => {
            const box = node.getBoundingClientRect();
            return box.top >= 0 && box.bottom <= window.innerHeight * 0.45;
        })).toBe(true);
        expect(await page.locator('.map-detail-passage').evaluate((node) => node.getBoundingClientRect().top < innerHeight * 0.7)).toBe(true);
    });

    test('arrives from a real lit-book canvas point and closes back to the canvas', async ({ page }) => {
        const data = loadSnapshot();
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('/map?book=b-013');
        const canvas = page.getByTestId('map-canvas');
        const bounds = await canvas.boundingBox();
        expect(bounds).not.toBeNull();
        if (bounds === null || data.map === undefined) return;
        const view = {
            centerX: Number(await canvas.getAttribute('data-map-center-x')),
            centerY: Number(await canvas.getAttribute('data-map-center-y')),
            zoom: Number(await canvas.getAttribute('data-map-zoom')),
        };
        const highlightIds = new Set(data.highlights.filter((item) => item.bookId === 'b-013').map((item) => item.id));
        const target = data.map.points.map((point) => ({ point, screen: mapToScreen(point, view, bounds.width, bounds.height) }))
            .find(({ point, screen }) => highlightIds.has(point.highlightId) && screen.x > 30 && screen.x < bounds.width - 30 && screen.y > bounds.height * 0.65 && screen.y < bounds.height - 35);
        expect(target).toBeDefined();
        if (target === undefined) return;
        await canvas.click({ position: { x: target.screen.x, y: target.screen.y } });
        await expect(page).toHaveURL(/\bh=h-\d+/);
        await expect(page.locator('#map-detail-heading')).toBeFocused();
        const id = new URL(page.url()).searchParams.get('h');
        await expect(page.locator('.map-detail-passage')).toHaveText(data.highlights.find((item) => item.id === id)?.text ?? '');
        await page.getByRole('link', { name: '关闭划线详情' }).click();
        await expect(page.getByTestId('map-detail')).toHaveCount(0);
        await expect(canvas).toBeFocused();
        await expect(page).toHaveURL(/book=b-013/);
    });

    test('the dark map is scoped to the map, stays readable at 200% and honours reduced motion', async ({ page }) => {
        const data = loadSnapshot();
        const long = data.highlights.find((item) => item.id === 'h-231');
        expect(long).toBeDefined();
        if (long === undefined) return;
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.setViewportSize({ width: 720, height: 450 });
        await page.goto('/map?book=b-013&h=h-231');
        await expect(page.locator('.map-detail-passage')).toHaveText(long.text);
        await expect(page.locator('#map-detail-heading')).toBeFocused();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await expect(page.locator('.shell')).toHaveCSS('color-scheme', 'dark');
        await expect(page.getByTestId('map-detail')).toHaveCSS('animation-name', 'none');
        await page.getByRole('link', { name: '随便看看' }).first().click();
        await expect(page.locator('.shell')).toHaveCSS('color-scheme', 'light');
    });

    test('gives only the world opening a full-width real map without clipping the semantic route', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('/map');
        const stage = page.getByTestId('map-stage');
        await expect(page.locator('.map-opening-world')).toBeVisible();
        await expect(page.locator('.map-opening-world .map-list-return')).toHaveCount(0);
        await expect(page.getByTestId('nav-paths')).toBeVisible();
        await expect.poll(() => stage.evaluate((element) => {
            const rect = element.getBoundingClientRect();
            return Math.abs(rect.left) < 1 && Math.abs(rect.width - innerWidth) < 1;
        })).toBe(true);
        await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-zoom', '1.000');
        await expect(page.locator('.map-region-list a').first()).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

        await page.setViewportSize({ width: 320, height: 720 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.goto('/map?tag=tag-035');
        await expect(page.locator('.map-opening-world')).toHaveCount(0);
        await expect(page.locator('.map-point-list a').first()).toBeVisible();
        await page.goto('/map?book=b-013&h=h-231');
        await expect(page.locator('.map-opening-world')).toHaveCount(0);
        await expect(page.getByTestId('map-detail')).toBeVisible();
    });

    test('book picker searches real books, closes on Escape and returns focus', async ({ page }) => {
        const data = loadSnapshot();
        const chosen = data.books.find((book) => book.id === 'b-013');
        expect(chosen).toBeDefined();
        if (chosen === undefined) return;
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('/map');
        const trigger = page.getByRole('button', { name: '点亮一本书' });
        await trigger.click();
        const dialog = page.getByRole('dialog', { name: '点亮一本书' });
        await expect(dialog).toBeVisible();
        const search = dialog.getByRole('searchbox', { name: '搜索书名或作者' });
        await expect(search).toBeFocused();
        await search.fill('no-such-real-book-999');
        await expect(dialog.getByText('没有找到这本书。')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
        await expect(trigger).toBeFocused();
        await trigger.click();
        await page.getByRole('searchbox', { name: '搜索书名或作者' }).fill(chosen.title);
        await dialog.getByRole('button', { name: `《${chosen.title}》`, exact: false }).click();
        await expect(page).toHaveURL(/book=b-013/);
        await expect(trigger).toBeFocused();
        await expect(page.locator('.map-book-light strong')).toContainText(chosen.title);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
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
        await page.getByRole('button', { name: '点亮一本书' }).click();
        await expect(page.getByRole('dialog', { name: '点亮一本书' })).toBeVisible();
        await expect(page.getByRole('button', { name: `《${first.title}》`, exact: false }).last()).toHaveAttribute('aria-current', 'true');
        await page.getByRole('button', { name: '关闭选书' }).click();
        const relatedTagCount = new Set(
            data.highlights.filter((highlight) => highlight.bookId === first.id).flatMap((highlight) => highlight.tagIds),
        ).size;
        await expect(page.locator('.map-book-paths > p a')).toHaveCount(Math.min(6, relatedTagCount));
        if (relatedTagCount > 6) {
            await page.locator('.map-book-paths details summary').click();
            await expect(page.locator('.map-book-paths a')).toHaveCount(relatedTagCount);
        }

        const colours = new Set<string>();
        for (const book of covered) {
            await page.getByRole('button', { name: '点亮一本书' }).click();
            await page.getByRole('searchbox', { name: '搜索书名或作者' }).fill(book.title);
            await page.getByRole('dialog').getByRole('button', { name: `《${book.title}》`, exact: false }).click();
            await expect(page).toHaveURL(new RegExp(`book=${book.id}`));
            await expect(page.locator('.map-book-light strong')).toContainText(book.title);
            await page.waitForTimeout(700);
            colours.add(await page.locator('.map-book-picker').evaluate((element) =>
                getComputedStyle(element).getPropertyValue('--map-book-aura').trim(),
            ));
        }
        expect(colours.size).toBeGreaterThanOrEqual(4);
    });

    test('the passage detail uses its own real cover, not a different book lit in the picker', async ({ page }) => {
        const data = loadSnapshot();
        const highlight = data.highlights.find((item) => item.id === 'h-013');
        expect(highlight?.bookId).toBe('b-008');
        await page.goto('/map?book=b-008&h=h-013');
        await expect(page.getByTestId('map-detail')).toBeVisible();
        await page.waitForTimeout(650); // wait for local cover sampling to settle
        const ownAccent = await page.locator('.map-book-light').evaluate((node) => getComputedStyle(node).getPropertyValue('--map-book-aura').trim());
        await page.goto('/map?book=b-013&h=h-013');
        await expect(page.locator('.map-book-light strong')).toContainText(data.books.find((item) => item.id === 'b-013')?.title ?? '');
        await expect(page.getByTestId('map-detail')).toHaveCSS('--map-detail-accent', ownAccent);
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
        await expect(canvas).toBeVisible();
        await expect(page.getByTestId('map-regions-toggle')).toBeVisible();
        await page.evaluate(() => window.scrollTo(0, 180));
        await expect.poll(async () => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
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
        const pageScrollBefore = await page.evaluate(() => window.scrollY);
        await page.mouse.wheel(0, -240);
        await expect(canvas).not.toHaveAttribute('data-map-zoom', '1.000');
        await expect.poll(async () => page.evaluate(() => window.scrollY)).toBe(pageScrollBefore);
        const afterZoomIn = await readView();
        const after = mapAtAnchor(afterZoomIn);
        expect(after.x).toBeCloseTo(before.x, -1);
        expect(after.y).toBeCloseTo(before.y, -1);
        await expect(page.locator('.map-zoom-readout')).not.toHaveText('100%');
        await page.mouse.wheel(0, 180);
        await expect.poll(async () => page.evaluate(() => window.scrollY)).toBe(pageScrollBefore);
        await expect.poll(async () => (await readView()).zoom).toBeLessThan(afterZoomIn.zoom);
    });

    test('offers the world map as its own primary navigation destination', async ({ page }) => {
        await page.goto('/map');
        await expect(page.getByTestId('nav-map')).toHaveAttribute('aria-current', 'page');
        await expect(page.getByTestId('nav-paths')).not.toHaveAttribute('aria-current', 'page');
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
