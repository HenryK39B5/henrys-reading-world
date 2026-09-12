import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/**
 * Slice 2 browser acceptance for the curated sequence.
 *
 * These assertions describe the experience the prototype promises on real data: the first screen is
 * a representative passage, the second deliberately contrasts, the third adds a mild surprise, and
 * passages do not repeat while unseen material remains. Which exact passage appears is not pinned:
 * the engine is allowed to sample.
 */
type Highlight = {
    id: string;
    text: string;
    bookId: string;
    year?: number;
    topicIds: string[];
    qualityScore: number;
    standaloneReadable: boolean;
    openingCandidate: boolean;
    surpriseCandidate: boolean;
};

const SNAPSHOT_PATH = join(process.cwd(), '.private/local-snapshot.json');
const REVIEW_DIR = join(process.cwd(), '.private/review/slice-2');
const hasSnapshot = existsSync(SNAPSHOT_PATH);

type RealData = { byText: Map<string, Highlight> };

function loadSnapshot(): RealData {
    const parsed = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as { highlights: Highlight[] };
    return { byText: new Map(parsed.highlights.map((item) => [item.text.trim(), item])) };
}

function nonWhitespaceLength(text: string): number {
    return [...text].filter((char) => !/\s/u.test(char)).length;
}

async function shown(page: Page): Promise<Highlight> {
    const text = (await page.getByTestId('stage-passage').innerText()).trim();
    const record = loadSnapshot().byText.get(text);
    expect(record, `displayed passage is not part of the real snapshot: ${text.slice(0, 12)}…`).toBeDefined();
    return record as Highlight;
}

/** Advances once and returns the passage that is now on screen. */
async function advance(page: Page): Promise<Highlight> {
    await page.getByTestId('next-quote').click();
    await expect(page.locator('.stage')).toHaveAttribute('data-phase', 'idle', { timeout: 3000 });
    return shown(page);
}

test.describe('curated sequence', () => {
    test.skip(!hasSnapshot, 'private local snapshot is not available');

    test('opens representatively, then contrasts, then surprises', async ({ page }) => {
        await page.goto('/');

        // Draw 1 — opening: flagged, independently readable, and a comfortable length.
        const opening = await shown(page);
        expect(opening.openingCandidate, 'opening passage should be flagged in the data').toBe(true);
        expect(nonWhitespaceLength(opening.text)).toBeGreaterThanOrEqual(20);
        expect(nonWhitespaceLength(opening.text)).toBeLessThanOrEqual(120);
        expect(opening.standaloneReadable).toBe(true);
        await page.screenshot({ path: join(REVIEW_DIR, 'draw-1-opening.png'), fullPage: true });

        // Draw 2 — contrast: a different book, ideally with unrelated topics.
        const contrast = await advance(page);
        expect(contrast.id).not.toBe(opening.id);
        expect(contrast.bookId, 'contrast should change the book').not.toBe(opening.bookId);
        expect(contrast.topicIds.some((topicId) => opening.topicIds.includes(topicId))).toBe(false);
        await page.screenshot({ path: join(REVIEW_DIR, 'draw-2-contrast.png'), fullPage: true });

        // Draw 3 — surprise: best effort on real material, never a fake time claim.
        const surprise = await advance(page);
        expect(surprise.id).not.toBe(contrast.id);
        expect(surprise.bookId, 'surprise should change the book as well').not.toBe(contrast.bookId);
        await page.screenshot({ path: join(REVIEW_DIR, 'draw-3-surprise.png'), fullPage: true });
    });

    test('never repeats a passage while unseen material remains', async ({ page }) => {
        await page.goto('/');
        const seen: Highlight[] = [await shown(page)];

        for (let index = 0; index < 7; index += 1) {
            const record = await advance(page);
            expect(seen.map((item) => item.id)).not.toContain(record.id);
            seen.push(record);
        }

        expect(new Set(seen.map((item) => item.id)).size).toBe(seen.length);
        expect(new Set(seen.map((item) => item.bookId)).size).toBeGreaterThan(1);
        await expect(page.locator('.stage')).toHaveAttribute('data-commit-count', '7');
    });

    test('keeps a visible rhythm of books, not one book in a row', async ({ page }) => {
        await page.goto('/');
        const books: string[] = [];

        for (let index = 0; index < 6; index += 1) {
            books.push((await shown(page)).bookId);
            await page.getByTestId('next-quote').click();
            await expect(page.locator('.stage')).toHaveAttribute('data-phase', 'idle', { timeout: 3000 });
        }

        // The material offers 18 books, so consecutive repeats are avoidable and should not happen.
        for (let index = 1; index < books.length; index += 1) {
            expect(books[index], `draw ${String(index + 1)} repeated the previous book`).not.toBe(books[index - 1]);
        }
        expect(new Set(books).size).toBeGreaterThanOrEqual(4);
    });
});
