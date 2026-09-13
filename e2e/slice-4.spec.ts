import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/**
 * World-layer browser acceptance: books, theme shelves, the year tool and the about line.
 *
 * v2 note: a theme shelf owns books, not passages, so a shelf assertion checks that the passage came
 * from a book filed on that shelf. It never claims the passage itself is "about" the theme.
 *
 * Every count on screen must match the snapshot, and the DOM must stay small even though the library
 * holds thousands of passages.
 */
type Highlight = { id: string; text: string; bookId: string; year?: number };
type Book = { id: string; title: string; author: string; themeIds: string[] };

const SNAPSHOT_PATH = join(process.cwd(), '.private/local-snapshot.json');
const REVIEW_DIR = join(process.cwd(), '.private/review/slice-4');
const hasSnapshot = existsSync(SNAPSHOT_PATH);

type RealData = {
    highlights: Highlight[];
    books: Book[];
    themes: { id: string; title: string }[];
    countByBook: Map<string, number>;
    bookById: Map<string, Book>;
    byText: Map<string, Highlight>;
    years: number[];
};

function loadSnapshot(): RealData {
    const parsed = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as {
        highlights: Highlight[];
        books: Book[];
        themes: { id: string; title: string }[];
    };
    const countByBook = new Map<string, number>();
    for (const highlight of parsed.highlights) {
        countByBook.set(highlight.bookId, (countByBook.get(highlight.bookId) ?? 0) + 1);
    }
    return {
        highlights: parsed.highlights,
        books: parsed.books,
        themes: parsed.themes,
        countByBook,
        bookById: new Map(parsed.books.map((book) => [book.id, book])),
        byText: new Map(parsed.highlights.map((item) => [item.text.trim(), item])),
        years: [...new Set(parsed.highlights.map((item) => item.year).filter((year): year is number => year !== undefined))].sort(),
    };
}

function passagesOfTheme(data: RealData, themeId: string): Highlight[] {
    return data.highlights.filter((highlight) => data.bookById.get(highlight.bookId)?.themeIds.includes(themeId) === true);
}

async function currentText(page: Page): Promise<string> {
    return (await page.getByTestId('stage-passage').innerText()).trim();
}

async function expandBookList(page: Page): Promise<void> {
    const toggle = page.getByTestId('toggle-all-books');
    if ((await toggle.getAttribute('aria-expanded')) === 'false') {
        await toggle.click();
    }
}

/** The local snapshot is fetched asynchronously, so every world-layer probe waits for the list first. */
async function waitForWorld(page: Page): Promise<void> {
    await expect(page.getByTestId('book-list')).toBeVisible();
    await expect(page.getByTestId('theme-list')).toBeVisible();
}

test.describe('world layer', () => {
    test.skip(!hasSnapshot, 'private local snapshot is not available');

    test('sentence -> source -> book -> theme shelf -> another sentence', async ({ page }) => {
        const data = loadSnapshot();
        await page.goto('/');

        const startedAs = data.byText.get(await currentText(page));
        expect(startedAs).toBeDefined();
        if (startedAs === undefined) {
            return;
        }

        // source -> the book behind this sentence
        await page.getByTestId('source-toggle').click();
        await expect(page.getByTestId('source-count')).toHaveText(
            `这里收录了 ${String(data.countByBook.get(startedAs.bookId) ?? 0)} 处划线`,
        );

        // "查看这本书" takes over the book section below instead of opening a detail page
        await page.getByTestId('open-book').click();
        const detail = page.getByTestId(`book-detail-${startedAs.bookId}`);
        await expect(detail).toBeVisible();
        await expect(page.getByTestId('book-detail-heading')).toBeFocused();
        await expect(detail.locator('.passage-button').first()).toBeVisible();

        // book -> a passage of that book becomes the stage again
        const bookPassage = detail.locator('.passage-button').first();
        const chosenText = (await bookPassage.locator('.passage-text').innerText()).trim();
        await bookPassage.click();
        await expect(page.getByTestId('stage-passage')).toHaveText(chosenText);
        expect(data.byText.get(chosenText)?.bookId).toBe(startedAs.bookId);

        // theme shelf -> a passage from another book filed on that shelf
        const shelf = data.themes.find((theme) =>
            data.books.some((book) => book.themeIds.includes(theme.id) && book.id !== startedAs.bookId),
        );
        expect(shelf).toBeDefined();
        if (shelf === undefined) {
            return;
        }
        await page.getByTestId(`theme-${shelf.id}`).click();
        const shelfPassage = page.getByTestId(`theme-detail-${shelf.id}`).locator('.passage-button').first();
        await expect(shelfPassage).toBeVisible();
        await shelfPassage.click();

        const record = data.byText.get(await currentText(page));
        expect(record).toBeDefined();
        // The shelf owns the book, so the check is about the book's shelf, not this sentence's topic.
        expect(data.bookById.get(record?.bookId ?? '')?.themeIds).toContain(shelf.id);
        await page.screenshot({ path: join(REVIEW_DIR, 'world-1440.png'), fullPage: true });
    });

    test('shows real per-book and per-shelf counts, never a platform total', async ({ page }) => {
        const data = loadSnapshot();
        await page.goto('/');
        await waitForWorld(page);

        const list = page.getByTestId('book-list');
        await expect(list).toBeVisible();
        // The list is collapsed by recency, so look at a book that is actually on screen.
        const firstRow = list.locator('.book-item').first();
        const rowBookId = ((await firstRow.getByTestId(/^book-b-/u).getAttribute('data-testid')) ?? '').replace('book-', '');
        expect(rowBookId).not.toBe('');
        await expect(page.getByTestId(`book-${rowBookId}`)).toContainText(
            `这里收录了 ${String(data.countByBook.get(rowBookId) ?? 0)} 处划线`,
        );

        const shelf = data.themes[0];
        expect(shelf).toBeDefined();
        if (shelf === undefined) {
            return;
        }
        const shelfPassages = passagesOfTheme(data, shelf.id);
        const shelfBooks = new Set(shelfPassages.map((item) => item.bookId)).size;
        await expect(page.getByTestId(`theme-${shelf.id}`)).toContainText(
            `${String(shelfPassages.length)} 处划线 · ${String(shelfBooks)} 本书`,
        );

        const booksWithPassages = data.books.filter((item) => (data.countByBook.get(item.id) ?? 0) > 0).length;
        await expect(page.getByTestId('about-line')).toContainText(`这里收录了 ${String(data.highlights.length)} 处划线`);
        await expect(page.getByTestId('about-line')).toContainText(`${String(booksWithPassages)} 本书`);
    });

    test('filters books by a real year without inventing substitutes', async ({ page }) => {
        const data = loadSnapshot();
        expect(data.years.length).toBeGreaterThan(1);
        const oldest = data.years[0];
        expect(oldest).toBeDefined();
        if (oldest === undefined) {
            return;
        }

        await page.goto('/');
        await waitForWorld(page);
        await page.getByTestId(`year-${String(oldest)}`).click();
        await expect(page.getByTestId(`year-${String(oldest)}`)).toHaveAttribute('aria-pressed', 'true');
        await expect(page.getByTestId('year-all')).toHaveAttribute('aria-pressed', 'false');

        // Books that carry no passage from that year must not be listed at all.
        const inYear = new Set(data.highlights.filter((item) => item.year === oldest).map((item) => item.bookId));
        await expandBookList(page);
        await expect(page.getByTestId('book-list').locator('.book-item')).toHaveCount(inYear.size);

        // A book detail opened under a filter only offers that year's passages, while the book's own
        // count still describes the whole snapshot rather than the current filter.
        const bookId = [...inYear][0];
        if (bookId !== undefined) {
            await page.getByTestId(`book-${bookId}`).click();
            const detail = page.getByTestId(`book-detail-${bookId}`);
            const expected = data.highlights.filter((item) => item.bookId === bookId && item.year === oldest).length;
            if (expected > 6) {
                await detail.getByRole('button', { name: /查看全部/u }).click();
            }
            await expect(detail.locator('.passage-button')).toHaveCount(expected);
            await expect(page.getByTestId(`book-${bookId}`)).toContainText(
                `这里收录了 ${String(data.countByBook.get(bookId) ?? 0)} 处划线`,
            );
        }

        // A shelf with nothing in that year explains the gap and offers a way out.
        const emptyShelf = data.themes.find((theme) => !passagesOfTheme(data, theme.id).some((item) => item.year === oldest));
        if (emptyShelf !== undefined) {
            await page.getByTestId(`theme-${emptyShelf.id}`).click();
            await expect(page.getByTestId(`theme-detail-${emptyShelf.id}`)).toContainText('没有这个书架中书籍的划线');
            await page.screenshot({ path: join(REVIEW_DIR, 'year-filter-1440.png'), fullPage: true });
            await page.getByTestId(`theme-detail-${emptyShelf.id}`).getByRole('button', { name: '清除筛选' }).click();
            await expect(page.getByTestId('year-all')).toHaveAttribute('aria-pressed', 'true');
            await expect(page.getByTestId(`theme-${emptyShelf.id}`)).toContainText('处划线');
        }
    });

    test('expands the whole book list and keeps the navigation links live', async ({ page }) => {
        const data = loadSnapshot();
        await page.goto('/');
        await waitForWorld(page);

        const total = data.books.filter((book) => (data.countByBook.get(book.id) ?? 0) > 0).length;
        await expect(page.getByTestId('toggle-all-books')).toBeVisible();
        await expect(page.getByTestId('toggle-all-books')).toHaveAttribute('aria-expanded', 'false');
        await page.getByTestId('toggle-all-books').click();
        await expect(page.getByTestId('toggle-all-books')).toHaveAttribute('aria-expanded', 'true');
        await expect(page.getByTestId('book-list').locator('.book-item')).toHaveCount(total);

        await page.getByRole('navigation', { name: '主要导航' }).getByRole('link', { name: '关于' }).click();
        await expect(page.getByRole('heading', { name: '关于' })).toBeVisible();
        await expect(page.getByTestId('about-line')).toBeVisible();
    });

    test('keeps the first paint small even though the library is large', async ({ page }) => {
        const data = loadSnapshot();
        expect(data.highlights.length).toBeGreaterThan(1000);

        await page.goto('/');
        await waitForWorld(page);
        const density = await page.evaluate(() => ({
            passages: document.querySelectorAll('.passage-button').length,
            bookRows: document.querySelectorAll('.book-item').length,
            shelfRows: document.querySelectorAll('.theme-item').length,
            elements: document.querySelectorAll('*').length,
            text: document.body.innerText.length,
        }));

        // The library is reachable, not rendered: sections stay collapsed until asked for.
        expect(density.passages).toBe(0);
        expect(density.shelfRows).toBeLessThanOrEqual(15);
        expect(density.elements).toBeLessThan(1500);
        console.log(`first paint DOM: ${JSON.stringify(density)}`);
    });
});
