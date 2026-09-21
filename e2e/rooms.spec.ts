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
type Highlight = { id: string; text: string; bookId: string; year?: number; tagIds: string[] };
type Book = { id: string; title: string; author: string; themeIds: string[] };
type TopicTag = { id: string; title: string };

const SNAPSHOT_PATH = join(process.cwd(), '.private/local-snapshot.json');
const hasSnapshot = existsSync(SNAPSHOT_PATH);

type RealData = {
    highlights: Highlight[];
    books: Book[];
    themes: { id: string; title: string }[];
    tags: TopicTag[];
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
        tags: TopicTag[];
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
        tags: parsed.tags,
        countByBook,
        bookById: new Map(parsed.books.map((book) => [book.id, book])),
        byText: new Map(parsed.highlights.map((item) => [item.text.trim(), item])),
        years: [...years].sort(),
    };
}

function booksInYear(data: RealData, year: number): Set<string> {
    return new Set(data.highlights.filter((item) => item.year === year).map((item) => item.bookId));
}

function bookCountFor(data: RealData, bookId: string): number {
    return data.countByBook.get(bookId) ?? 0;
}

function booksOnShelf(data: RealData, themeId: string): Set<string> {
    return new Set(data.books.filter((book) => book.themeIds.includes(themeId)).map((book) => book.id));
}

function nonWhitespace(text: string): number {
    return [...text].filter((char) => !/\s/u.test(char)).length;
}

/**
 * Books that hold nothing in the stage's preferred 20–120 character band.
 *
 * These are the books that make a long (or very short) opening possible: when one of them is drawn, its
 * own line is shown instead of the draw being filtered away. The map carries the line each of them would
 * open with — for b-114 in the real snapshot, a single 299-character passage.
 */
function starvedBooks(data: RealData): Map<string, { longest: Highlight; length: number }> {
    const grouped = new Map<string, Highlight[]>();
    for (const item of data.highlights) {
        const list = grouped.get(item.bookId);
        if (list === undefined) {
            grouped.set(item.bookId, [item]);
        } else {
            list.push(item);
        }
    }
    const starved = new Map<string, { longest: Highlight; length: number }>();
    for (const [bookId, items] of grouped) {
        if (items.some((item) => nonWhitespace(item.text) >= 20 && nonWhitespace(item.text) <= 120)) {
            continue;
        }
        const longest = items.reduce((left, right) =>
            nonWhitespace(right.text) > nonWhitespace(left.text) ? right : left,
        );
        starved.set(bookId, { longest, length: nonWhitespace(longest.text) });
    }
    return starved;
}

/** The shelf of `bookId` holding the fewest books, so one fair cycle is short. */
function smallestShelfOf(data: RealData, bookId: string): string | null {
    const shelfIds = data.books.find((book) => book.id === bookId)?.themeIds ?? [];
    let best: { id: string; size: number } | null = null;
    for (const themeId of shelfIds) {
        const size = [...booksOnShelf(data, themeId)].filter((id) => (data.countByBook.get(id) ?? 0) > 0).length;
        if (size === 0) {
            continue;
        }
        if (best === null || size < best.size) {
            best = { id: themeId, size };
        }
    }
    return best?.id ?? null;
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
        const { themes, books, tags } = loadSnapshot();
        const shelf = themes[0];
        const book = books[0];
        const tag = tags[0];
        expect(shelf).toBeDefined();
        expect(book).toBeDefined();
        expect(tag).toBeDefined();
        if (shelf === undefined || book === undefined || tag === undefined) {
            return;
        }

        const rooms = [
            { path: '/', heading: '随便看看', nav: 'nav-hall' },
            { path: '/themes', heading: '主题书架', nav: 'nav-themes' },
            { path: `/themes/${shelf.id}`, heading: `正在逛：${shelf.title}`, nav: 'nav-themes' },
            { path: '/paths', heading: '主题小径', nav: 'nav-paths' },
            { path: `/paths/${tag.id}`, heading: tag.title, nav: 'nav-paths' },
            { path: '/map', heading: '阅读世界地图', nav: 'nav-map' },
            { path: `/map?tag=${tag.id}`, heading: tag.title, nav: 'nav-map' },
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

    test('the mobile primary navigation is an intentional three-by-two atlas index', async ({ page }) => {
        for (const width of [390, 320]) {
            await page.setViewportSize({ width, height: 844 });
            await page.goto('/');
            await roomReady(page);
            const rows = await page.locator('.nav-link').evaluateAll((links) => {
                const counts = new Map<number, number>();
                for (const link of links) {
                    const top = Math.round(link.getBoundingClientRect().top);
                    counts.set(top, (counts.get(top) ?? 0) + 1);
                }
                return [...counts.values()];
            });
            expect(rows, `${String(width)}px nav rows`).toEqual([3, 3]);
            expect(
                await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
                `${String(width)}px horizontal overflow`,
            ).toBeLessThanOrEqual(1);
        }
    });

    test('about keeps real excerpts distinct from complete context or personal endorsement', async ({ page }) => {
        const data = loadSnapshot();
        await page.goto('/about');
        await roomReady(page);

        const context = page.getByTestId('about-context');
        await expect(context).toContainText('原文划线');
        await expect(context).toContainText('可能失去部分上下文');
        await expect(context).toContainText('不代表我认同作者的全部观点');
        const roomText = await page.locator('[data-room="about"]').innerText();
        expect(roomText.split(String(data.highlights.length)).length - 1).toBe(1);
        expect(roomText.split(String(data.books.length)).length - 1).toBe(1);
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
            passageNodes: document.querySelectorAll('.book-random-text, .stage-text').length,
            bookRows: document.querySelectorAll('.book-item').length,
            shelfRows: document.querySelectorAll('.shelf-item').length,
        }));
        // The hall is one room: a sentence, its attribution and three quiet exits.
        expect(density.elements).toBeLessThan(120);
        // One rendered passage is the hall's whole point; the number that matters is that it is one
        // passage rather than a list of them.
        expect(density.passageNodes).toBe(1);
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
        await expect(page.getByTestId('book-walk-progress')).toBeVisible();
        await expect(page.getByTestId('book-random-text')).toBeVisible();
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
        expect(data.byText.get(second)?.bookId, '再看一处 never leaves the book').toBe(bookId);
        expect(second).not.toBe(first);

        // The room walks the book in rounds: the progress is this book's round, not a reading statistic.
        await expect(page.getByTestId('book-walk-progress')).toHaveText(
            `本轮已看 2 / ${String(bookCountFor(data, bookId))}`,
        );
        // And the full list no longer lives in the room at all (docs/17 §5).
        await expect(page.getByTestId('book-more')).toHaveCount(0);
        await expect(page.getByTestId('book-batch-label')).toHaveCount(0);
        await expect(page.locator('.book-random-text')).toHaveCount(1);

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

    test('the largest book walks one passage at a time to the end of its round', async ({ page }) => {
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
        await expect(page.getByTestId('book-count')).toHaveText(`这里收录了 ${String(count)} 处划线`);
        await expect(page.getByTestId('book-walk-progress')).toHaveText(`本轮已看 1 / ${String(count)}`);
        // One passage is rendered, however many the book holds: the round is the visitor's pace.
        await expect(page.locator('.book-random-text')).toHaveCount(1);
        // A bounded room even for the largest book in the library: no list, no batch controls.
        expect(await page.locator('.room-book *').count()).toBeLessThan(140);

        // Walking twice never repeats a passage inside the round and never skips ahead of it.
        const seen = new Set([(await page.getByTestId('book-random-text').innerText()).trim()]);
        for (let step = 2; step <= 6; step += 1) {
            await page.getByTestId('book-random').click();
            // Wait for the round to actually advance before reading the sentence: a re-render is not a
            // promise, and reading the text a moment early is how this check would go flaky.
            await expect(page.getByTestId('book-walk-progress')).toHaveText(`本轮已看 ${String(step)} / ${String(count)}`);
            const text = (await page.getByTestId('book-random-text').innerText()).trim();
            expect(seen.has(text), 'a round must not repeat a passage').toBe(false);
            seen.add(text);
        }
        expect(seen.size).toBe(6);
        // The round is long, so the completion note and the restart control are still ahead.
        await expect(page.getByTestId('book-walk-complete')).toHaveCount(0);
        await expect(page.getByTestId('book-restart')).toHaveCount(0);
    });

    test('a whole round completes, says so, and only restarts when asked', async ({ page }) => {
        const data = loadSnapshot();
        // A small real book: the point is the end of a round, and a 500-passage book is not needed to
        // reach it. The 531-passage round is proven deterministically against the real snapshot in
        // `tests/local-snapshot.smoke.test.tsx` instead of by hundreds of clicks here.
        const small = [...data.countByBook.entries()]
            .filter(([, count]) => count >= 2)
            .sort((left, right) => left[1] - right[1])[0];
        expect(small, 'the snapshot must hold a book with more than one passage').toBeDefined();
        if (small === undefined) {
            return;
        }
        const [bookId, count] = small;

        await page.goto(`/books/${bookId}`);
        await roomReady(page);
        await expect(page.getByTestId('book-walk-progress')).toHaveText(`本轮已看 1 / ${String(count)}`);

        const seen = new Set([(await page.getByTestId('book-random-text').innerText()).trim()]);
        for (let step = 2; step <= count; step += 1) {
            await page.getByTestId('book-random').click();
            // Advance by observation, not by hoping the re-render already happened.
            await expect(page.getByTestId('book-walk-progress')).toHaveText(
                `本轮已看 ${String(step)} / ${String(count)}`,
            );
            const text = (await page.getByTestId('book-random-text').innerText()).trim();
            expect(seen.has(text), `passage ${String(step - 1)} of the round must be new`).toBe(false);
            seen.add(text);
        }

        // Every passage of the book was shown exactly once, and the room says the round is over.
        expect(seen.size).toBe(count);
        await expect(page.getByTestId('book-walk-progress')).toHaveText(`本轮已看 ${String(count)} / ${String(count)}`);
        await expect(page.getByTestId('book-walk-complete')).toHaveText(
            `这本书收录的 ${String(count)} 处划线已经看过一遍了`,
        );
        // No silent restart: 再看一处 is gone and the visitor is offered a new round instead.
        await expect(page.getByTestId('book-random')).toHaveCount(0);
        await expect(page.getByTestId('book-restart')).toBeVisible();

        const atTheEnd = (await page.getByTestId('book-random-text').innerText()).trim();
        await page.getByTestId('book-restart').click();
        await expect(page.getByTestId('book-walk-progress')).toHaveText(`本轮已看 1 / ${String(count)}`);
        await expect(page.getByTestId('book-walk-complete')).toHaveCount(0);
        await expect(page.getByTestId('book-random')).toBeVisible();
        expect(data.byText.get(atTheEnd)?.bookId).toBe(bookId);
    });

    test('leaving and returning to a book keeps its passage and its progress', async ({ page }) => {
        const data = loadSnapshot();
        const biggest = [...data.countByBook.entries()].sort((left, right) => right[1] - left[1])[0];
        expect(biggest).toBeDefined();
        if (biggest === undefined) {
            return;
        }
        const [bookId, count] = biggest;

        await page.goto(`/books/${bookId}`);
        await roomReady(page);
        await page.getByTestId('book-random').click();
        await expect(page.getByTestId('book-walk-progress')).toHaveText(`本轮已看 2 / ${String(count)}`);
        const before = (await page.getByTestId('book-random-text').innerText()).trim();

        // Out to the library and back, without reloading the document.
        await page.getByTestId('exit-books').click();
        await roomReady(page);
        await expect(page.getByTestId('room-heading')).toHaveText('所有书');
        await page.goBack();
        await roomReady(page);

        // Same passage, same round: the walk is this session's memory (docs/17 §3.2).
        await expect(page.getByTestId('book-random-text')).toHaveText(before);
        await expect(page.getByTestId('book-walk-progress')).toHaveText(`本轮已看 2 / ${String(count)}`);

        // A fresh load starts a fresh round rather than storing state outside the session.
        await page.reload();
        await roomReady(page);
        await expect(page.getByTestId('book-walk-progress')).toHaveText(`本轮已看 1 / ${String(count)}`);
    });

    test('a sampled book opens with its real count and one passage at a time', async ({ page }) => {
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
            await expect(page.getByTestId('book-walk-progress')).toHaveText(
                `本轮已看 1 / ${String(count)}`,
            );
            // Bounded initial paint: one passage node and a small DOM however large the book is.
            await expect(page.locator('.book-random-text')).toHaveCount(1);
            expect(await page.locator('.room-book *').count()).toBeLessThan(140);
            await expect(page.getByTestId('book-random-text')).not.toHaveText('');
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

    test('the year filter stays in the library and does not reshape the book room', async ({ page }) => {
        const data = loadSnapshot();
        // A real book that really has passages in more than one year, so the filter can be told apart
        // from "this book only has one year anyway".
        const multiYear = data.books
            .map((book) => ({
                book,
                years: [...new Set(data.highlights.filter((item) => item.bookId === book.id && item.year !== undefined).map((item) => item.year as number))].sort(),
            }))
            .filter((entry) => entry.years.length >= 2)
            .at(0);
        expect(multiYear, 'the snapshot must hold a book with passages in several years').toBeDefined();
        if (multiYear === undefined) {
            return;
        }
        const bookId = multiYear.book.id;
        const year = multiYear.years[0] as number;
        const inYear = data.highlights.filter((item) => item.bookId === bookId && item.year === year);
        const wholeBook = data.countByBook.get(bookId) ?? 0;
        expect(inYear.length).toBeLessThan(wholeBook);

        // Reach the book the way a visitor does: filtered library, then the book it lists.
        await page.goto(`/books?year=${String(year)}`);
        await roomReady(page);
        let guard = 0;
        while ((await page.getByTestId(`book-${bookId}`).count()) === 0 && guard < 10) {
            await page.getByTestId('books-more').click();
            guard += 1;
        }
        const link = page.getByTestId(`book-${bookId}`);
        await expect(link).toBeVisible();
        // The filter belongs to the library: the book's own address names the book and nothing else.
        await expect(link).toHaveAttribute('href', `/books/${bookId}`);
        await link.click();
        await roomReady(page);
        await expect.poll(() => new URL(page.url()).search, { message: 'the book address names the book' }).toBe('');

        // The room walks the whole book in rounds instead of narrowing to the year (docs/17 §3.3).
        await expect(page.getByTestId('book-walk-progress')).toHaveText(`本轮已看 1 / ${String(wholeBook)}`);
        await expect(page.locator('[data-testid^="book-year-"]')).toHaveCount(0);
        await expect(page.getByTestId('book-count')).toHaveText(`这里收录了 ${String(wholeBook)} 处划线`);

        // Leaving the book returns to the same filtered library.
        await page.getByTestId('room-back').click();
        await roomReady(page);
        await expect(page.getByTestId(`year-${String(year)}`)).toHaveAttribute('aria-current', 'true');

        // A stale filtered book link from before this change still lands on the book, normalised.
        await page.goto(`/books/${bookId}?year=${String(year)}`);
        await roomReady(page);
        await expect(page.getByTestId('room-heading')).toContainText(multiYear.book.title);
        await expect.poll(() => new URL(page.url()).search, { message: 'a stale filter is normalised' }).toBe('');
        await expect(page.getByTestId('book-walk-progress')).toHaveText(`本轮已看 1 / ${String(wholeBook)}`);
    });

    test('a book without a cover falls back to its real title, and long passages stay complete', async ({ page }) => {
        const data = loadSnapshot();
        const parsed = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as {
            books: { id: string; title: string; coverPath?: string }[];
            highlights: Highlight[];
        };
        const withoutCover = parsed.books.filter((book) => book.coverPath === undefined);
        test.skip(withoutCover.length === 0, 'every book in this snapshot has a local cover');
        const target = withoutCover.find((book) => bookCountFor(data, book.id) > 1) ?? withoutCover[0];
        expect(target).toBeDefined();
        if (target === undefined) {
            return;
        }

        await page.goto(`/books/${target.id}`);
        await roomReady(page);
        // No invented image: the real title is typeset in place of the cover.
        await expect(page.locator('.book-head-cover .book-cover-fallback')).toHaveText(target.title);
        await expect(page.locator('.book-head-cover img')).toHaveCount(0);
        // The room still shows a real passage of that same book.
        const shown = (await page.getByTestId('book-random-text').innerText()).trim();
        expect(data.byText.get(shown)?.bookId).toBe(target.id);

        // The longest real passage in the library is rendered whole, never clipped. It is opened through
        // its own stable link, which is the address that names one passage (docs/15 §4.1); inside a book
        // room a passage arrives through the round instead of being addressable.
        const longest = parsed.highlights
            .map((item) => ({ item, length: [...item.text].filter((char) => !/\s/u.test(char)).length }))
            .sort((left, right) => right.length - left.length)[0];
        expect(longest).toBeDefined();
        if (longest === undefined) {
            return;
        }
        await page.goto(`/?h=${encodeURIComponent(longest.item.id)}`);
        await roomReady(page);
        const rendered = page.locator('.stage-text');
        await expect(rendered).toHaveText(longest.item.text);
        const metrics = await rendered.evaluate((element) => ({
            scrollWidth: element.scrollWidth,
            clientWidth: element.clientWidth,
            overflow: window.getComputedStyle(element).overflow,
            whiteSpace: window.getComputedStyle(element).whiteSpace,
        }));
        expect(metrics.overflow).not.toBe('hidden');
        expect(metrics.whiteSpace).toBe('pre-wrap');
        expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
        const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(1);
        console.log(`longest passage rendered: ${String(longest.length)} characters`);
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

/**
 * The rare long opening (docs/07, docs/12 §7).
 *
 * The fair engine draws a book first and only then looks at lengths, so a book that holds nothing in the
 * preferred band still opens — with its own longest line. These tests prove that path is reachable
 * inside one fair cycle of a shelf the book belongs to, and that the text arrives whole at both widths
 * rather than being clipped or shortened to fit a band.
 *
 * Reduced motion is used here purely to make the draw loop fast: it changes only the transition
 * durations, never the selection or the typography.
 */
test.describe('a book with nothing shorter can still open, whole', () => {
    test.skip(!hasSnapshot, 'private local snapshot is not available');

    test('a book outside the preferred band still opens, whole, in one shelf cycle', async ({ page }) => {
        test.setTimeout(240_000);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        const data = loadSnapshot();
        const starved = starvedBooks(data);
        expect(starved.size, 'this snapshot has books outside the preferred band').toBeGreaterThan(0);

        const report: string[] = [];
        for (const bookId of starved.keys()) {
            const shelfId = smallestShelfOf(data, bookId);
            expect(shelfId, `${bookId} must be filed on a shelf`).not.toBeNull();
            if (shelfId === null) {
                continue;
            }
            const shelfSize = [...booksOnShelf(data, shelfId)].filter(
                (id) => (data.countByBook.get(id) ?? 0) > 0,
            ).length;

            await page.goto(`/themes/${shelfId}`);
            await roomReady(page);

            // One fair cycle covers every book of the shelf, so the budget is the shelf itself.
            let found = false;
            let draws = 0;
            for (let step = 0; step <= shelfSize + 2 && !found; step += 1) {
                const record = await stageRecord(page);
                if (record.bookId === bookId) {
                    found = true;
                    break;
                }
                draws += 1;
                await page.getByTestId('next-quote').click();
                await expect(page.locator('.stage')).toHaveAttribute('data-phase', 'idle', { timeout: 3000 });
            }
            expect(found, `${bookId} must appear within one cycle of ${shelfId}`).toBe(true);

            const shown = (await page.getByTestId('stage-passage').innerText()).trim();
            const shownHighlight = data.byText.get(shown);
            expect(shownHighlight?.bookId, 'the stage must show a real passage of this book').toBe(bookId);
            if (shownHighlight === undefined) {
                continue;
            }
            const shownLength = nonWhitespace(shown);
            // Whole, not trimmed to a band: the rendered line is exactly the stored one.
            expect(shownLength).toBe(nonWhitespace(shownHighlight.text));
            // Which of the book's own lines arrives is the fair engine's business, so this asserts the
            // property that makes the book special — the band preference cannot serve it, and it opens anyway.
            expect(shownLength < 20 || shownLength > 120, `${bookId} must stay outside the preferred band`).toBe(
                true,
            );
            await expect(page.locator('.stage')).toHaveAttribute(
                'data-band',
                shownLength <= 40 ? 'short' : shownLength <= 120 ? 'medium' : 'long',
            );

            const metrics = await page.getByTestId('stage-passage').evaluate((node) => ({
                scrollWidth: node.scrollWidth,
                clientWidth: node.clientWidth,
                overflow: window.getComputedStyle(node).overflow,
                whiteSpace: window.getComputedStyle(node).whiteSpace,
                font: window.getComputedStyle(node).fontSize,
            }));
            expect(metrics.overflow).not.toBe('hidden');
            expect(metrics.whiteSpace).toBe('pre-wrap');
            expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
            const overflow = await page.evaluate(
                () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
            );
            expect(overflow, 'the long opening must not push the page sideways').toBeLessThanOrEqual(1);
            report.push(`${bookId}/${shelfId}: ${String(shownLength)} chars, ${String(draws)} draws, ${metrics.font}`);

            // And the same line is complete on a phone-width screen.
            await page.setViewportSize({ width: 390, height: 844 });
            const narrow = await page.getByTestId('stage-passage').evaluate((node) => ({
                scrollWidth: node.scrollWidth,
                clientWidth: node.clientWidth,
            }));
            expect(narrow.scrollWidth).toBeLessThanOrEqual(narrow.clientWidth + 1);
            const narrowOverflow = await page.evaluate(
                () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
            );
            expect(narrowOverflow).toBeLessThanOrEqual(1);
            expect(nonWhitespace((await page.getByTestId('stage-passage').innerText()).trim())).toBe(shownLength);
            await page.setViewportSize({ width: 1440, height: 900 });
        }

        console.log(`rare openings, each reached inside one shelf cycle:\n${report.join('\n')}`);
    });
});
