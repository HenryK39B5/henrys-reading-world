import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { hasSnapshot, loadSnapshot, nonWhitespace, type Highlight } from './support/snapshot.ts';

const OUT_DIR = join(process.cwd(), '.private/review/v3-batch4');

async function noOverflow(page: Page): Promise<number> {
    return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

async function openHighlightOnPath(page: Page, highlight: Highlight): Promise<void> {
    const tagId = highlight.tagIds[0];
    if (tagId === undefined) throw new Error('highlight has no path');
    const data = loadSnapshot();
    const total = data.highlights.filter((entry) => entry.tagIds.includes(tagId)).length;
    await page.goto(`/paths/${tagId}`);
    for (let step = 0; step < total; step += 1) {
        const current = (await page.getByTestId('path-passage').innerText()).trim();
        if (current === highlight.text.trim()) return;
        await page.getByTestId('path-next').click();
    }
    throw new Error(`path did not reach ${highlight.id}`);
}

test.describe('Batch 4 visual evidence', () => {
    test.skip(!hasSnapshot, '需要 schema 3 local snapshot');

    test.beforeAll(() => {
        if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
    });

    test('captures path index and a three-way fork at desktop and mobile widths', async ({ page }) => {
        const data = loadSnapshot();
        const triple = data.highlights.find((entry) => entry.tagIds.length === 3);
        expect(triple).toBeTruthy();
        if (triple === undefined) return;

        for (const viewport of [
            { width: 1440, height: 1000, name: '1440' },
            { width: 390, height: 844, name: '390' },
            { width: 320, height: 720, name: '320' },
        ]) {
            await page.setViewportSize(viewport);
            await page.goto('/paths');
            await expect(page.getByTestId('path-list')).toBeVisible();
            expect(await noOverflow(page), `paths ${viewport.name}`).toBeLessThanOrEqual(1);
            await page.screenshot({ path: join(OUT_DIR, `paths-${viewport.name}.png`), fullPage: true });

            await openHighlightOnPath(page, triple);
            await expect(page.getByTestId('topic-clues').locator('a')).toHaveCount(3);
            await page.waitForTimeout(320);
            expect(await noOverflow(page), `fork ${viewport.name}`).toBeLessThanOrEqual(1);
            await page.screenshot({ path: join(OUT_DIR, `fork-${viewport.name}.png`), fullPage: true });
        }
    });

    test('captures the longest reviewed passage and its all-tag share card', async ({ page }) => {
        const data = loadSnapshot();
        const longest = data.highlights
            .filter((entry) => entry.tagIds.length > 0)
            .sort((left, right) => nonWhitespace(right.text) - nonWhitespace(left.text))[0];
        expect(longest).toBeTruthy();
        if (longest === undefined) return;

        for (const viewport of [
            { width: 1440, height: 1000, name: '1440' },
            { width: 390, height: 844, name: '390' },
        ]) {
            await page.setViewportSize(viewport);
            await openHighlightOnPath(page, longest);
            await expect(page.getByTestId('path-passage')).toHaveText(longest.text.trim());
            await page.waitForTimeout(320);
            const metrics = await page.getByTestId('path-passage').evaluate((node) => ({
                horizontal: node.scrollWidth - node.clientWidth,
                rendered: (node.textContent ?? '').trim(),
            }));
            expect(metrics.horizontal).toBeLessThanOrEqual(1);
            expect(metrics.rendered).toBe(longest.text.trim());
            await page.screenshot({ path: join(OUT_DIR, `path-longest-${viewport.name}.png`), fullPage: true });

            await page.getByRole('button', { name: '分享' }).click();
            await expect(page.getByTestId('share-card')).toBeVisible();
            await expect(page.getByTestId('share-card-tags').locator('span')).toHaveCount(longest.tagIds.length);
            const cardOverflow = await page.getByTestId('share-card').evaluate((node) => ({
                horizontal: node.scrollWidth - node.clientWidth,
                vertical: node.scrollHeight - node.clientHeight,
            }));
            expect(cardOverflow).toEqual({ horizontal: 0, vertical: 0 });
            await page.screenshot({ path: join(OUT_DIR, `share-longest-${viewport.name}.png`), fullPage: true });
            await page.keyboard.press('Escape');
        }
    });

    test('reduced motion changes direction without displacement', async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        const data = loadSnapshot();
        const fork = data.highlights.find((entry) => entry.tagIds.length >= 2);
        expect(fork).toBeTruthy();
        if (fork === undefined) return;
        await page.setViewportSize({ width: 390, height: 844 });
        await openHighlightOnPath(page, fork);
        const alternate = fork.tagIds[1];
        expect(alternate).toBeTruthy();
        if (alternate === undefined) return;
        await page.getByTestId(`topic-clue-${alternate}`).click();
        await expect(page.getByTestId('path-passage')).toHaveText(fork.text.trim());
        const animation = await page.locator('.path-stage').evaluate((node) => getComputedStyle(node).animationName);
        expect(animation).toBe('none');
        await page.screenshot({ path: join(OUT_DIR, 'fork-reduced-motion-390.png'), fullPage: true });
    });
});
