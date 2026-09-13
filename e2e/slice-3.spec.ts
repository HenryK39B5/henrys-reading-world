import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/**
 * Slice 3 browser acceptance: the source is revealed in place.
 *
 * Real data only, and no dead controls: "再看一处" must stay inside the same book, and a book with a
 * single passage must say so instead of silently moving elsewhere.
 */
type Highlight = { id: string; text: string; bookId: string };

const SNAPSHOT_PATH = join(process.cwd(), '.private/local-snapshot.json');
const REVIEW_DIR = join(process.cwd(), '.private/review/slice-3');
const hasSnapshot = existsSync(SNAPSHOT_PATH);

type RealData = { byText: Map<string, Highlight>; countByBook: Map<string, number>; titles: Map<string, string> };

function loadSnapshot(): RealData {
    const parsed = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as {
        highlights: Highlight[];
        books: { id: string; title: string }[];
    };
    const countByBook = new Map<string, number>();
    for (const highlight of parsed.highlights) {
        countByBook.set(highlight.bookId, (countByBook.get(highlight.bookId) ?? 0) + 1);
    }
    return {
        byText: new Map(parsed.highlights.map((item) => [item.text.trim(), item])),
        countByBook,
        titles: new Map(parsed.books.map((book) => [book.id, book.title])),
    };
}

async function currentRecord(page: Page): Promise<Highlight> {
    const text = (await page.getByTestId('stage-passage').innerText()).trim();
    const record = loadSnapshot().byText.get(text);
    expect(record).toBeDefined();
    return record as Highlight;
}

async function advance(page: Page): Promise<void> {
    await page.getByTestId('next-quote').click();
    await expect(page.locator('.stage')).toHaveAttribute('data-phase', 'idle', { timeout: 3000 });
}

/**
 * Opens a specific book from the world layer and puts one of its passages on the stage.
 *
 * v1 could walk the global stage until a small book happened to appear. With the full library that
 * walk is neither bounded nor deterministic, so these tests drive the same UI path the visitor has:
 * expand the book list, open the book, pick a passage.
 */
async function stagePassageOfBook(page: Page, bookId: string): Promise<void> {
    // The local snapshot arrives asynchronously, so wait for the world layer before driving it.
    await expect(page.getByTestId('book-list')).toBeVisible();
    const toggleAll = page.getByTestId('toggle-all-books');
    if (await toggleAll.isVisible()) {
        await toggleAll.click();
    }
    const row = page.getByTestId(`book-${bookId}`);
    await expect(row).toBeVisible();
    await row.click();
    const detail = page.getByTestId(`book-detail-${bookId}`);
    await expect(detail).toBeVisible();
    await detail.locator('.passage-button').first().click();
    await expect(page.getByTestId('stage-passage')).toBeVisible();
}

test.describe('source reveal', () => {
    test.skip(!hasSnapshot, 'private local snapshot is not available');

    test('expands in place, reports the real collection and collapses back with focus', async ({ page }) => {
        const { countByBook, titles } = loadSnapshot();
        await page.goto('/');

        const toggle = page.getByTestId('source-toggle');
        const panel = page.getByTestId('source-panel');
        await expect(panel).toBeHidden();
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
        await expect(toggle).toHaveAttribute('aria-controls', 'source-panel');

        const before = await currentRecord(page);
        await toggle.click();

        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        await expect(panel).toBeVisible();
        await expect(page.locator('.stage')).toHaveAttribute('data-source-open', 'true');
        // The panel replaces a jump to a detail page; the stage stays on screen.
        await expect(page.getByTestId('stage-passage')).toBeVisible();
        await expect(page.getByTestId('source-count')).toHaveText(
            `这里收录了 ${String(countByBook.get(before.bookId) ?? 0)} 处划线`,
        );
        // Real cover art is used when it has been fetched; otherwise a typeset title stands in for it.
        const frame = page.locator('.cover-frame');
        const coverImage = frame.locator('img');
        const coverTitle = titles.get(before.bookId) ?? '';
        if ((await coverImage.count()) > 0) {
            expect(await coverImage.getAttribute('alt')).toContain(coverTitle);
        } else {
            await expect(frame.locator('.cover-placeholder')).toContainText(coverTitle);
        }
        await page.waitForTimeout(300);
        await page.screenshot({ path: join(REVIEW_DIR, 'source-open-1440.png'), fullPage: true });

        await page.getByTestId('close-source').click();
        await expect(panel).toBeHidden();
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
        // Focus must return to the control that owns the panel.
        await expect(toggle).toBeFocused();
    });

    test('opens and closes from the keyboard', async ({ page }) => {
        await page.goto('/');
        const toggle = page.getByTestId('source-toggle');
        await toggle.focus();
        await page.keyboard.press('Enter');
        await expect(page.getByTestId('source-panel')).toBeVisible();
        await page.keyboard.press('Enter');
        await expect(page.getByTestId('source-panel')).toBeHidden();
        await expect(toggle).toBeFocused();
    });

    test('keeps "another passage" inside the same book and leaves the panel open', async ({ page }) => {
        const { countByBook } = loadSnapshot();
        await page.goto('/');

        const before = await currentRecord(page);
        const bookCount = countByBook.get(before.bookId) ?? 0;
        const globalDraws = await page.locator('.stage').getAttribute('data-commit-count');

        await page.getByTestId('source-toggle').click();
        const nextInBook = page.getByTestId('next-in-book');

        if (bookCount <= 1) {
            await expect(nextInBook).toHaveAttribute('aria-disabled', 'true');
            return;
        }

        await nextInBook.click();
        await expect(page.locator('.stage')).toHaveAttribute('data-phase', 'idle', { timeout: 3000 });

        const after = await currentRecord(page);
        expect(after.bookId, '再看一处 must not cross into another book').toBe(before.bookId);
        expect(after.id).not.toBe(before.id);
        await expect(page.getByTestId('source-panel')).toBeVisible();
        await expect(page.getByTestId('source-count')).toHaveText(`这里收录了 ${String(bookCount)} 处划线`);
        // A book move is not a global draw, so the stage counter advances while the draw phase does not.
        expect(await page.locator('.stage').getAttribute('data-commit-count')).toBe(
            String(Number(globalDraws ?? '0') + 1),
        );
        await page.screenshot({ path: join(REVIEW_DIR, 'next-in-book-1440.png'), fullPage: true });
    });

    test('closes the panel when a global passage arrives', async ({ page }) => {
        await page.goto('/');
        await page.getByTestId('source-toggle').click();
        await expect(page.getByTestId('source-panel')).toBeVisible();

        await advance(page);

        await expect(page.getByTestId('source-panel')).toBeHidden();
        await expect(page.locator('.stage')).toHaveAttribute('data-source-open', 'false');
        await expect(page.getByTestId('source-toggle')).toHaveAttribute('aria-expanded', 'false');
    });

    test('explains exhaustion instead of silently moving to another book', async ({ page }) => {
        const { countByBook } = loadSnapshot();
        // A short book keeps the walk bounded and deterministic on the full library.
        const small = [...countByBook.entries()]
            .filter(([, count]) => count >= 2 && count <= 4)
            .sort((left, right) => left[1] - right[1])[0];
        test.skip(small === undefined, 'no small multi-passage book in the snapshot');
        if (small === undefined) {
            return;
        }
        const [bookId, bookCount] = small;

        await page.goto('/');
        await stagePassageOfBook(page, bookId);
        await page.getByTestId('source-toggle').click();

        // Walk through every remaining passage of this book, then ask once more.
        for (let index = 1; index < bookCount; index += 1) {
            await page.getByTestId('next-in-book').click();
            await expect(page.locator('.stage')).toHaveAttribute('data-phase', 'idle', { timeout: 3000 });
        }

        expect((await currentRecord(page)).bookId).toBe(bookId);
        // The control explains itself before it is pressed; it never jumps to another book.
        await expect(page.getByTestId('next-in-book')).toHaveAttribute('aria-disabled', 'true');
        await expect(page.getByTestId('source-note')).toContainText('都看过了');
        await page.screenshot({ path: join(REVIEW_DIR, 'book-exhausted-1440.png'), fullPage: true });
    });

    test('explains a single-passage book instead of offering a dead control', async ({ page }) => {
        const { countByBook } = loadSnapshot();
        const single = [...countByBook.entries()].find(([, count]) => count === 1);
        test.skip(single === undefined, 'no single-passage book in the snapshot');
        if (single === undefined) {
            return;
        }

        await page.goto('/');
        await stagePassageOfBook(page, single[0]);
        await page.getByTestId('source-toggle').click();

        await expect(page.getByTestId('source-count')).toHaveText('这里收录了 1 处划线');
        await expect(page.getByTestId('next-in-book')).toHaveAttribute('aria-disabled', 'true');
        await expect(page.getByTestId('source-note')).toContainText('只收录了一处划线');
    });
});
