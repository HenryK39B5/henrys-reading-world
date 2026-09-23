import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { hasSnapshot, loadSnapshot } from './support/snapshot.ts';

const phase = process.env.AUDIT_PHASE === 'after' ? 'after' : 'before';
const dir = resolve(`.private/review/v3-private-atlas/7g/${phase}`);

test.skip(!hasSnapshot, 'the audit requires the real local snapshot');
test.setTimeout(600_000);

test('every real book and path fits the reading system at narrow and desktop widths', async ({ page }) => {
    const snapshot = loadSnapshot();
    mkdirSync(dir, { recursive: true });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const issues: Array<{ width: number; kind: string; id: string; reason: string }> = [];
    const capture = async (name: string) => page.screenshot({ path: resolve(dir, `${name}.png`) });
    const geometry = async (selector: string) => page.locator(selector).first().evaluate((node) => {
        const rect = node.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(node);
        return {
            left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
            textOutside: [...range.getClientRects()].some((line) => line.left < -1 || line.right > innerWidth + 1),
            clipped: node.scrollWidth > node.clientWidth + 1,
        };
    });

    for (const width of [320, 1440]) {
        await page.setViewportSize({ width, height: width === 320 ? 720 : 900 });
        await page.goto('/books');
        await expect(page.getByTestId('book-list')).toBeVisible();
        while (await page.getByTestId('books-more').count()) await page.getByTestId('books-more').click();
        const bookIds = await page.locator('.book-link').evaluateAll((links) => links.map((link) => link.getAttribute('href')?.split('/').pop()));
        expect(new Set(bookIds).size).toBe(snapshot.books.length);
        for (const item of await page.locator('.book-list .book-title').all()) {
            const href = await item.locator('xpath=ancestor::a').getAttribute('href');
            const id = href?.split('/').pop() ?? '';
            const rect = await item.evaluate((node) => {
                const range = document.createRange(); range.selectNodeContents(node);
                return [...range.getClientRects()].some((line) => line.left < -1 || line.right > innerWidth + 1);
            });
            if (rect) issues.push({ width, kind: 'book-index', id, reason: 'title outside viewport' });
        }
        if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) {
            issues.push({ width, kind: 'book-index', id: 'all', reason: 'horizontal overflow' });
        }
        if (width === 320) await capture('narrow-books-all');

        await page.goto('/paths');
        await expect(page.locator('.path-list-link')).toHaveCount(snapshot.tags.length);
        for (const item of await page.locator('.path-list-title').all()) {
            const href = await item.locator('xpath=ancestor::a').getAttribute('href');
            const id = href?.split('/').pop() ?? '';
            const rect = await item.evaluate((node) => {
                const range = document.createRange(); range.selectNodeContents(node);
                return [...range.getClientRects()].some((line) => line.left < -1 || line.right > innerWidth + 1);
            });
            if (rect) issues.push({ width, kind: 'path-index', id, reason: 'title outside viewport' });
        }
        if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) {
            issues.push({ width, kind: 'path-index', id: 'all', reason: 'horizontal overflow' });
        }

        for (const book of snapshot.books) {
            if (!snapshot.countByBook.has(book.id)) continue;
            await page.goto(`/books/${book.id}`);
            await expect(page.getByTestId('room-heading')).toContainText(book.title);
            const heading = await geometry('.book-head .room-heading');
            const passage = await geometry('.book-random-text');
            if (heading.textOutside || heading.clipped) issues.push({ width, kind: 'book', id: book.id, reason: 'heading clips or escapes' });
            if (passage.textOutside || passage.clipped) issues.push({ width, kind: 'book', id: book.id, reason: 'passage clips or escapes' });
            if (passage.top <= heading.bottom) issues.push({ width, kind: 'book', id: book.id, reason: 'passage overlaps heading' });
            if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) {
                issues.push({ width, kind: 'book', id: book.id, reason: 'horizontal overflow' });
            }
            if (width === 320 && ['b-013', 'b-094', 'b-099'].includes(book.id)) {
                const cover = page.locator('.book-head-cover img');
                if (await cover.count()) await cover.evaluate((image: HTMLImageElement) => image.decode());
                await capture(`narrow-${book.id}`);
            }
        }
        for (const tag of snapshot.tags) {
            await page.goto(`/paths/${tag.id}`);
            await expect(page.getByTestId('room-heading')).toContainText(tag.title);
            const heading = await geometry('.path-heading');
            const passage = await geometry('.path-text');
            if (heading.textOutside || heading.clipped) issues.push({ width, kind: 'path', id: tag.id, reason: 'heading clips or escapes' });
            if (passage.textOutside || passage.clipped) issues.push({ width, kind: 'path', id: tag.id, reason: 'passage clips or escapes' });
            if (passage.top <= heading.bottom) issues.push({ width, kind: 'path', id: tag.id, reason: 'passage overlaps heading' });
            if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) {
                issues.push({ width, kind: 'path', id: tag.id, reason: 'horizontal overflow' });
            }
        }
    }
    writeFileSync(resolve(dir, 'audit.json'), JSON.stringify({ books: snapshot.books.length, paths: snapshot.tags.length, widths: [320, 1440], issues }, null, 2));
    console.log(`7G real-content audit: ${snapshot.books.length} books, ${snapshot.tags.length} paths at two widths; ${issues.length} issues`);
    expect(issues).toEqual([]);
});

test('real missing covers and the longest titles keep their full heading and readable fallback', async ({ page }) => {
    const snapshot = loadSnapshot();
    mkdirSync(dir, { recursive: true });
    await page.setViewportSize({ width: 320, height: 720 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const withoutCover = snapshot.books.filter((book) => book.coverPath === undefined);
    expect(withoutCover).toHaveLength(3);
    const longest = [...snapshot.books].sort((a, b) => [...b.title].length - [...a.title].length).slice(0, 2);
    const edges = [];
    for (const width of [320, 390, 720]) {
        await page.setViewportSize({ width, height: width === 720 ? 450 : width === 390 ? 844 : 720 });
        for (const book of [...withoutCover, ...longest]) {
            await page.goto(`/books/${book.id}`);
            await expect(page.getByTestId('room-heading')).toHaveText(`《${book.title}》`);
            if (book.coverPath === undefined) {
                await expect(page.locator('.book-head-cover img')).toHaveCount(0);
                await expect(page.locator('.book-head-cover .book-cover-fallback')).toHaveText('无封面');
            } else {
                await page.locator('.book-head-cover img').evaluate((image: HTMLImageElement) => image.decode());
            }
            const heading = await page.getByTestId('room-heading').boundingBox();
            edges.push({ id: book.id, width, titleLength: [...book.title].length,
                passageTop: (await page.getByTestId('book-random-text').boundingBox())?.y,
                headingBottom: heading === null ? null : heading.y + heading.height,
                overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth) });
            await page.screenshot({ path: resolve(dir, `${width}-cover-${book.id}.png`) });
        }
    }
    writeFileSync(resolve(dir, 'edges.json'), JSON.stringify(edges, null, 2));
    expect(edges.every((entry) => !entry.overflow)).toBe(true);
});
