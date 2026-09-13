import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/**
 * Discovery browser acceptance.
 *
 * v1 validated a curated Opening → Contrast → Surprise sequence. docs/10 removed that narrative, so
 * this spec now checks what the product actually promises on real data: the first screen is one real
 * passage of the library, every draw avoids the book on screen, draws spread across the library instead
 * of circling one big book, and nothing repeats while unseen material remains.
 */
type Highlight = { id: string; text: string; bookId: string };

const SNAPSHOT_PATH = join(process.cwd(), '.private/local-snapshot.json');
const REVIEW_DIR = join(process.cwd(), '.private/review/slice-2');
const hasSnapshot = existsSync(SNAPSHOT_PATH);

type RealData = { highlights: Highlight[]; byText: Map<string, Highlight> };

function nonWhitespaceLength(text: string): number {
    return [...text].filter((char) => !/\s/u.test(char)).length;
}

/** The mechanical band the opening screen prefers; it inspects character count only. */
function readableBand(text: string): boolean {
    const length = nonWhitespaceLength(text);
    return length >= 20 && length <= 120;
}

function loadSnapshot(): RealData {
    const parsed = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as { highlights: Highlight[] };
    return {
        highlights: parsed.highlights,
        byText: new Map(parsed.highlights.map((item) => [item.text.trim(), item])),
    };
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

test.describe('fair wandering', () => {
    test.skip(!hasSnapshot, 'private local snapshot is not available');

    test('opens on a passage its own book can offer', async ({ page }) => {
        await page.goto('/');

        const opening = await shown(page);
        const length = nonWhitespaceLength(opening.text);
        expect(length).toBeGreaterThan(0);

        // The opening book is drawn fairly from the whole library, so length can only be preferred inside
        // that book. Four real books hold nothing in the 20–120 band; when one of them is drawn, its own
        // passage opens the world instead of the book being filtered out of the draw.
        const bookHoldsSomethingReadable = loadSnapshot().highlights.some(
            (item) => item.bookId === opening.bookId && readableBand(item.text),
        );
        if (bookHoldsSomethingReadable) {
            expect(length).toBeGreaterThanOrEqual(20);
            expect(length).toBeLessThanOrEqual(120);
        }
        await page.screenshot({ path: join(REVIEW_DIR, 'draw-1-opening.png'), fullPage: true });

        // Nothing about the opening is curated: it is simply one passage of the library.
        const second = await advance(page);
        expect(second.id).not.toBe(opening.id);
        expect(second.bookId, 'the next draw changes the book').not.toBe(opening.bookId);
        await page.screenshot({ path: join(REVIEW_DIR, 'draw-2-contrast.png'), fullPage: true });

        const third = await advance(page);
        expect(third.id).not.toBe(second.id);
        expect(third.bookId, 'the draw after that changes the book too').not.toBe(second.bookId);
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
        await expect(page.locator('.stage')).toHaveAttribute('data-commit-count', '7');
    });

    test('spreads draws across the library instead of circling one big book', async ({ page }) => {
        const { highlights } = loadSnapshot();
        const largestBook = highlights.reduce<Map<string, number>>((counts, item) => {
            counts.set(item.bookId, (counts.get(item.bookId) ?? 0) + 1);
            return counts;
        }, new Map());
        const biggest = [...largestBook.entries()].sort((left, right) => right[1] - left[1])[0];
        expect(biggest, 'the snapshot should offer at least one book').toBeDefined();

        await page.goto('/');
        const books: string[] = [];
        for (let index = 0; index < 12; index += 1) {
            books.push((await shown(page)).bookId);
            if (index < 11) {
                await page.getByTestId('next-quote').click();
                await expect(page.locator('.stage')).toHaveAttribute('data-phase', 'idle', { timeout: 3000 });
            }
        }

        // A book already seen this session is offered only after the unseen ones, so twelve draws on a
        // library of this size should cover twelve different books — never the same book twice in a row.
        for (let index = 1; index < books.length; index += 1) {
            expect(books[index], `draw ${String(index + 1)} repeated the previous book`).not.toBe(books[index - 1]);
        }
        expect(new Set(books).size).toBeGreaterThanOrEqual(10);
        expect(books.filter((bookId) => bookId === biggest?.[0]).length).toBeLessThanOrEqual(1);
    });
});
