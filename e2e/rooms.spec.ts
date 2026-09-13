import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/**
 * Room acceptance: real URLs, restored reading state, batched full-library reading and a hall that is
 * only a hall (docs/12 §2–3, docs/10 §7).
 *
 * The spec reads the private local snapshot to check on-screen counts against the real data, and skips
 * when that file is absent. Which passage appears is the fair engine's business, so nothing here asserts
 * a fixed passage order.
 */
type Highlight = { id: string; text: string; bookId: string; year?: number };
type Book = { id: string; title: string; author: string; themeIds: string[] };

const SNAPSHOT_PATH = join(process.cwd(), '.private/local-snapshot.json');
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
    const years = new Set<number>();
    for (const highlight of parsed.highlights) {
        if (highlight.year !== undefined) {
            years.add(highlight.year);
        }
    }
    return {
        highlights: parsed.highlights,
        books: parsed.books,
        themes: parsed.themes,
        countByBook,
        bookById: new Map(parsed.books.map((book) => [book.id, book])),
        byText: new Map(parsed.highlights.map((item) => [item.text.trim(), item])),
        years: [...years].sort(),
    };
}

function booksInYear(data: RealData, year: number): Set<string> {
    return new Set(data.highlights.filter((item) => item.year === year).map((item) => item.bookId));
}

function booksOnShelf(data: RealData, themeId: string): Set<string> {
    return new Set(data.books.filter((book) => book.themeIds.includes(themeId)).map((book) => book.id));
}

async function roomReady(page: Page): Promise<void> {
    await expect(page.getByTestId('room-heading')).toBeVisible();
    await expect(page.locator('.room-region')).toBeVisible();
}

/** The passage on screen, matched against the real snapshot. */
async function stageRecord(page: Page): Promise<Highlight> {
    const text = (await page.getByTestId('stage-passage').innerText()).trim();
    const record = loadSnapshot().byText.get(text);
    expect(record, 'the displayed passage must exist in the real snapshot').toBeDefined();
    return record as Highlight;
}

async function advance(page: Page): Promise<Highlight> {
    await page.getByTestId('next-quote').click();
    await expect(page.locator('.stage')).toHaveAttribute('data-phase', 'idle', { timeout: 3000 });
    return stageRecord(page);
}

async function batchLabel(page: Page, testId: string): Promise<string> {
    return (await page.getByTestId(testId).innerText()).trim();
}

/** Opens one book through the library the way a visitor would, expanding batches until it is listed. */
async function openBookFromLibrary(page: Page, bookId: string): Promise<void> {
    await page.getByTestId('nav-books').click();
    await expect(page.getByTestId('room-heading')).toHaveText('所有书');
    let guard = 0;
    while ((await page.getByTestId(`book-${bookId}`).count()) === 0 && guard < 10) {
        await page.getByTestId('books-more').click();
        guard += 1;
    }
    await page.getByTestId(`book-${bookId}`).click();
    await expect(page.getByTestId('room-heading')).toContainText('《');
}

test.describe('rooms and their URLs', () => {
    test.skip(!hasSnapshot, 'private local snapshot is not available');

    test('every room is reachable by its own URL and survives a refresh', async ({ page }) => {
        const { themes, books } = loadSnapshot();
        const shelf = themes[0];
        const book = books[0];
        expect(shelf).toBeDefined();
        expect(book).toBeDefined();
        if (shelf === undefined || book === undefined) {
            return;
        }

        const rooms = [
            { path: '/', heading: '随便看看', nav: 'nav-hall' },
            { path: '/themes', heading: '主题书架', nav: 'nav-themes' },
            { path: `/themes/${shelf.id}`, heading: `正在逛：${shelf.title}`, nav: 'nav-themes' },
            { path: '/books', heading: '所有书', nav: 'nav-books' },
            { path: `/books/${book.id}`, heading: `《${book.title}》`, nav: 'nav-books' },
            { path: '/about', heading: '关于', nav: 'nav-about' },
        ];

        for (const room of rooms) {
            await page.goto(room.path);
            await roomReady(page);
            await expect(page.getByTestId('room-heading')).toHaveText(room.heading);
            await expect(page.getByTestId(room.nav)).toHaveAttribute('aria-current', 'page');
            expect(new URL(page.url()).pathname).toBe(new URL(room.path, 'http://127.0.0.1:5173').pathname);

            // A refresh must land in the same room with its own content.
            await page.reload();
            await roomReady(page);
            await expect(page.getByTestId('room-heading')).toHaveText(room.heading);
        }
    });

    test('an unknown path explains itself and offers a way out', async ({ page }) => {
        await page.goto('/nope');
        await roomReady(page);
        await expect(page.getByTestId('unknown-note')).toContainText('/nope');
        await page.getByTestId('exit-hall').click();
        await expect(page.getByTestId('room-heading')).toHaveText('随便看看');
    });

    test('an unknown shelf or book id is a quiet dead end with exits', async ({ page }) => {
        await page.goto('/themes/t-404');
        await roomReady(page);
        await expect(page.getByTestId('theme-missing')).toBeVisible();
        await page.getByTestId('exit-themes').click();
        await expect(page.getByTestId('room-heading')).toHaveText('主题书架');

        await page.goto('/books/b-404');
        await roomReady(page);
        await expect(page.getByTestId('book-missing')).toBeVisible();
        await page.getByTestId('exit-books').click();
        await expect(page.getByTestId('room-heading')).toHaveText('所有书');
    });

    test('the hall carries a sentence and ways out, not the whole world', async ({ page }) => {
        await page.goto('/');
        await roomReady(page);

        await expect(page.getByTestId('stage-passage')).toBeVisible();
        await expect(page.getByTestId('book-list')).toHaveCount(0);
        await expect(page.getByTestId('theme-list')).toHaveCount(0);
        await expect(page.getByTestId('about-line')).toHaveCount(0);

        const density = await page.evaluate(() => ({
            elements: document.querySelectorAll('*').length,
            passageNodes: document.querySelectorAll('.passage-text').length,
            bookRows: document.querySelectorAll('.book-item').length,
            shelfRows: document.querySelectorAll('.shelf-item').length,
        }));
        // The hall is one room: a sentence, its attribution and three quiet exits.
        expect(density.elements).toBeLessThan(120);
        expect(density.passageNodes).toBe(0);
        expect(density.bookRows).toBe(0);
        expect(density.shelfRows).toBe(0);
        console.log(`hall density: ${JSON.stringify(density)}`);

        await expect(page.getByTestId('exit-themes')).toHaveAttribute('href', '/themes');
        await expect(page.getByTestId('exit-books')).toHaveAttribute('href', '/books');
    });

    test('a theme room draws only from its shelf', async ({ page }) => {
        const { themes, bookById } = loadSnapshot();
        const shelf = themes.find((theme) => booksOnShelf(loadSnapshot(), theme.id).size >= 3);
        expect(shelf).toBeDefined();
        if (shelf === undefined) {
            return;
        }

        await page.goto(`/themes/${shelf.id}`);
        await roomReady(page);
        await expect(page.getByTestId('theme-note')).toContainText('来自这个书架');

        for (let step = 0; step < 6; step += 1) {
            const record = step === 0 ? await stageRecord(page) : await advance(page);
            expect(bookById.get(record.bookId)?.themeIds, 'every shelf sentence comes from the shelf').toContain(
                shelf.id,
            );
        }
    });
});

test.describe('a room comes back the way it was left', () => {
    test.skip(!hasSnapshot, 'private local snapshot is not available');

    test('a shelf room restores its own sentence after visiting the shelf list and a book', async ({ page }) => {
        const { themes, books, bookById } = loadSnapshot();
        const shelf = themes.find((theme) => booksOnShelf(loadSnapshot(), theme.id).size >= 3);
        expect(shelf).toBeDefined();
        if (shelf === undefined) {
            return;
        }
        expect(bookById.size).toBeGreaterThan(100);

        await page.goto(`/themes/${shelf.id}`);
        await roomReady(page);
        await advance(page);
        await advance(page);
        await advance(page);
        const keptSentence = (await page.getByTestId('stage-passage').innerText()).trim();
        const commits = await page.locator('.stage').getAttribute('data-commit-count');

        // Away to the shelf list, then back with the browser button.
        await page.getByTestId('exit-themes').click();
        await expect(page.getByTestId('room-heading')).toHaveText('主题书架');
        await page.goBack();
        await roomReady(page);
        await expect(page.getByTestId('room-heading')).toHaveText(`正在逛：${shelf.title}`);
        await expect(page.getByTestId('stage-passage')).toHaveText(keptSentence);
        // Coming back is not a draw: the shelf cycle is not spent twice on one sentence.
        await expect(page.locator('.stage')).toHaveAttribute('data-commit-count', commits ?? '3');

        // The room keeps working afterwards, still inside the shelf.
        const state = loadSnapshot();
        const next = await advance(page);
        expect(state.bookById.get(next.bookId)?.themeIds).toContain(shelf.id);
        expect((await page.getByTestId('stage-passage').innerText()).trim()).not.toBe(keptSentence);

        // Shelf A -> shelf list -> shelf B -> back keeps shelf A's sentence as well.
        const otherShelf = themes.find((theme) => theme.id !== shelf.id);
        if (otherShelf !== undefined) {
            await page.goto('/themes');
            await roomReady(page);
            await page.getByTestId(`theme-${otherShelf.id}`).click();
            await roomReady(page);
            await expect(page.getByTestId('room-heading')).toHaveText(`正在逛：${otherShelf.title}`);
            await page.goBack();
            await roomReady(page);
            await expect(page.getByTestId('room-heading')).toHaveText('主题书架');
            await page.goBack();
            await roomReady(page);
            await expect(page.getByTestId('room-heading')).toHaveText(`正在逛：${shelf.title}`);
        }

        // A book room opened from the shelf leaves the shelf sentence alone.
        const shelfSentence = (await page.getByTestId('stage-passage').innerText()).trim();
        await page.getByTestId('source-toggle').click();
        await page.getByTestId('open-book').click();
        await expect(page.getByTestId('room-heading')).toContainText('《');
        await page.goBack();
        await roomReady(page);
        await expect(page.getByTestId('stage-passage')).toHaveText(shelfSentence);
        expect(books.length).toBeGreaterThan(100);
    });

    test('the library restores its year filter, its batch and its scroll position', async ({ page }) => {
        const data = loadSnapshot();
        const year = data.years[0];
        expect(year).toBeDefined();
        if (year === undefined) {
            return;
        }

        await page.goto('/books');
        await roomReady(page);
        await page.getByTestId(`year-${String(year)}`).click();
        await roomReady(page);
        await expect(page.getByTestId(`year-${String(year)}`)).toHaveAttribute('aria-current', 'true');

        // Expand twice, then scroll into the list and click a book that is already in view there.
        const expected = booksInYear(data, year).size;
        await page.getByTestId('books-more').click();
        if (expected > 32) {
            await page.getByTestId('books-more').click();
        }
        const label = await batchLabel(page, 'books-batch-label');
        const target = page.getByTestId('book-list').locator('a.book-link').nth(16);
        await target.scrollIntoViewIfNeeded();
        const beforeScroll = await page.evaluate(() => window.scrollY);
        expect(beforeScroll).toBeGreaterThan(0);

        // Away into a book, then back.
        await target.click();
        await expect(page.getByTestId('room-heading')).toContainText('《');
        await expect(page.getByTestId('book-passages')).toBeVisible();
        await page.goBack();
        await roomReady(page);

        await expect(page.getByTestId(`year-${String(year)}`)).toHaveAttribute('aria-current', 'true');
        await expect(page.getByTestId('books-batch-label')).toHaveText(label);
        const afterScroll = await page.evaluate(() => window.scrollY);
        expect(Math.abs(afterScroll - beforeScroll), 'the list comes back where it was left').toBeLessThan(80);
    });

    test('a book room reads its own passage without touching the hall', async ({ page }) => {
        const data = loadSnapshot();
        const biggest = [...data.countByBook.entries()].sort((left, right) => right[1] - left[1])[0];
        expect(biggest).toBeDefined();
        if (biggest === undefined) {
            return;
        }
        const [bookId] = biggest;

        await page.goto('/');
        await roomReady(page);
        const hallSentence = (await page.getByTestId('stage-passage').innerText()).trim();

        // Reached through the library without reloading the document, as a visitor would.
        await openBookFromLibrary(page, bookId);
        const first = (await page.getByTestId('book-random-text').innerText()).trim();
        expect(data.byText.get(first)?.bookId).toBe(bookId);

        await page.getByTestId('book-random').click();
        const second = (await page.getByTestId('book-random-text').innerText()).trim();
        expect(data.byText.get(second)?.bookId, '随机看一处 never leaves the book').toBe(bookId);
        expect(second).not.toBe(first);

        await page.getByTestId('nav-hall').click();
        await roomReady(page);
        await expect(page.getByTestId('stage-passage')).toHaveText(hallSentence);
    });

    test('a transition in flight does not follow the visitor into another room', async ({ page }) => {
        await page.goto('/');
        await roomReady(page);
        const before = (await page.getByTestId('stage-passage').innerText()).trim();
        const commitsBefore = await page.locator('.stage').getAttribute('data-commit-count');

        // Ask for another passage and leave in the same task, so the transition is genuinely in flight.
        await page.evaluate(() => {
            document.querySelector<HTMLButtonElement>('[data-testid="next-quote"]')?.click();
            document.querySelector<HTMLElement>('[data-testid="exit-themes"]')?.click();
        });
        await expect(page.getByTestId('room-heading')).toHaveText('主题书架');

        await page.goBack();
        await roomReady(page);
        // The abandoned draw is dropped: the same sentence is there and nothing was committed.
        await expect(page.getByTestId('stage-passage')).toHaveText(before);
        await expect(page.locator('.stage')).toHaveAttribute('data-phase', 'idle');
        await expect(page.locator('.stage')).toHaveAttribute('data-commit-count', commitsBefore ?? '0');

        // And the hall still moves on normally afterwards.
        const next = await advance(page);
        expect(next.id).toBeTruthy();
    });
});

test.describe('the whole library stays reachable, in batches', () => {
    test.skip(!hasSnapshot, 'private local snapshot is not available');

    test('the library starts at twelve books and walks to all of them', async ({ page }) => {
        const data = loadSnapshot();
        const total = [...data.countByBook.keys()].length;

        await page.goto('/books');
        await roomReady(page);
        await expect(page.getByTestId('book-list').locator('.book-item')).toHaveCount(12);
        await expect(page.getByTestId('books-batch-label')).toHaveText(`显示 12 / ${String(total)}`);
        // Covers are real and never all at once: the first batch loads lazily.
        expect(await page.getByTestId('book-list').locator('img[loading="lazy"]').count()).toBeGreaterThan(0);

        await page.getByTestId('books-more').click();
        await expect(page.getByTestId('book-list').locator('.book-item')).toHaveCount(32);

        let guard = 0;
        while ((await page.getByTestId('books-more').count()) > 0 && guard < 20) {
            await page.getByTestId('books-more').click();
            guard += 1;
        }
        await expect(page.getByTestId('book-list').locator('.book-item')).toHaveCount(total);
        await expect(page.getByTestId('books-batch-label')).toHaveText(`已显示全部 ${String(total)} 本`);
        await expect(page.getByTestId('books-more')).toHaveCount(0);
        expect(total).toBe(data.books.length);
    });

    test('the largest book walks to its last passage', async ({ page }) => {
        const data = loadSnapshot();
        const biggest = [...data.countByBook.entries()].sort((left, right) => right[1] - left[1])[0];
        expect(biggest).toBeDefined();
        if (biggest === undefined) {
            return;
        }
        const [bookId, count] = biggest;
        expect(count).toBeGreaterThan(200);

        await page.goto(`/books/${bookId}`);
        await roomReady(page);
        await expect(page.getByTestId('book-passages').locator('.passage-item')).toHaveCount(10);
        await expect(page.getByTestId('book-batch-label')).toHaveText(`显示 10 / ${String(count)}`);

        let guard = 0;
        while ((await page.getByTestId('book-more').count()) > 0 && guard < 40) {
            await page.getByTestId('book-more').click();
            guard += 1;
        }
        await expect(page.getByTestId('book-passages').locator('.passage-item')).toHaveCount(count);
        await expect(page.getByTestId('book-batch-label')).toHaveText(`已显示全部 ${String(count)} 处`);
        // The initial paint is bounded even for the largest book in the library.
        expect(guard).toBeGreaterThan(20);
    });

    test('a sampled book opens with its real count in a bounded first batch', async ({ page }) => {
        const data = loadSnapshot();
        const counts = [...data.countByBook.entries()].sort((left, right) => right[1] - left[1]);
        const largest = counts[0];
        const smallest = counts[counts.length - 1];
        const middle = counts[Math.floor(counts.length / 2)];
        const sample = [largest, middle, smallest].filter(
            (entry): entry is [string, number] => entry !== undefined,
        );
        expect(sample).toHaveLength(3);

        for (const [bookId, count] of sample) {
            await page.goto(`/books/${bookId}`);
            await roomReady(page);
            await expect(page.getByTestId('book-count')).toHaveText(`这里收录了 ${String(count)} 处划线`);
            const shown = Math.min(10, count);
            await expect(page.getByTestId('book-passages').locator('.passage-item')).toHaveCount(shown);
            const visible = await page.getByTestId('book-passages').locator('.passage-item').count();
            expect(visible).toBeLessThanOrEqual(10);
        }
    });

    test('the year filter is honest and belongs to the library only', async ({ page }) => {
        const data = loadSnapshot();
        const year = data.years[0];
        expect(year).toBeDefined();
        if (year === undefined) {
            return;
        }
        const expected = booksInYear(data, year).size;

        await page.goto('/books');
        await roomReady(page);
        await page.getByTestId(`year-${String(year)}`).click();
        await roomReady(page);
        await expect(page.getByTestId('books-batch-label')).toHaveText(
            `显示 ${String(Math.min(12, expected))} / ${String(expected)}`,
        );

        // Shelves and shelf rooms are not filtered by year at all.
        await page.goto('/themes');
        await roomReady(page);
        await expect(page.locator('[data-testid^="year-"]')).toHaveCount(0);
        const shelf = data.themes[0];
        if (shelf !== undefined) {
            await page.goto(`/themes/${shelf.id}`);
            await roomReady(page);
            await expect(page.locator('[data-testid^="year-"]')).toHaveCount(0);
            await expect(page.getByTestId('stage-passage')).toBeVisible();
        }

        // An empty year says so instead of showing substitutes.
        const emptyYear = 1998;
        await page.goto(`/books?year=${String(emptyYear)}`);
        await roomReady(page);
        await expect(page.getByTestId('books-empty')).toContainText('没有收录任何划线');
        await expect(page.getByTestId('book-list')).toHaveCount(0);
    });

    test('a shelf filter shows exactly the books filed on that shelf', async ({ page }) => {
        const data = loadSnapshot();
        const shelf = data.themes.find((theme) => booksOnShelf(data, theme.id).size >= 3);
        expect(shelf).toBeDefined();
        if (shelf === undefined) {
            return;
        }
        const onShelf = booksOnShelf(data, shelf.id).size;

        await page.goto(`/books?theme=${shelf.id}`);
        await roomReady(page);
        await expect(page.getByTestId('shelf-filter')).toContainText(shelf.title);
        await expect(page.getByTestId('books-batch-label')).toHaveText(
            `显示 ${String(Math.min(12, onShelf))} / ${String(onShelf)}`,
        );

        await page.getByTestId('clear-shelf-filter').click();
        await roomReady(page);
        await expect(page.getByTestId('books-batch-label')).toHaveText(
            `显示 12 / ${String(data.countByBook.size)}`,
        );
    });

    test('the shelf room links to the books of its own shelf', async ({ page }) => {
        const data = loadSnapshot();
        const shelf = data.themes[0];
        expect(shelf).toBeDefined();
        if (shelf === undefined) {
            return;
        }
        await page.goto(`/themes/${shelf.id}`);
        await roomReady(page);
        await page.getByTestId('exit-shelf-books').click();
        await roomReady(page);
        await expect(page.getByTestId('room-heading')).toHaveText('所有书');
        await expect(page.getByTestId('shelf-filter')).toContainText(shelf.title);
        await expect(page.getByTestId('books-batch-label')).toHaveText(
            `显示 ${String(Math.min(12, booksOnShelf(data, shelf.id).size))} / ${String(booksOnShelf(data, shelf.id).size)}`,
        );
    });
});
