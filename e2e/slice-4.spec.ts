import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/**
 * Slice 4 browser acceptance: the world layer.
 *
 * The walk the prototype promises is sentence -> source -> book -> topic -> another sentence. These
 * tests follow it on real data and check that every count on screen matches the snapshot.
 */
type Highlight = { id: string; text: string; bookId: string; year?: number; topicIds: string[] };
type Book = { id: string; title: string; author: string };

const SNAPSHOT_PATH = join(process.cwd(), '.private/local-snapshot.json');
const REVIEW_DIR = join(process.cwd(), '.private/review/slice-4');
const hasSnapshot = existsSync(SNAPSHOT_PATH);

type RealData = {
    highlights: Highlight[];
    books: Book[];
    topics: { id: string; title: string }[];
    countByBook: Map<string, number>;
    byText: Map<string, Highlight>;
    years: number[];
};

function loadSnapshot(): RealData {
    const parsed = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as {
        highlights: Highlight[];
        books: Book[];
        topics: { id: string; title: string }[];
    };
    const countByBook = new Map<string, number>();
    for (const highlight of parsed.highlights) {
        countByBook.set(highlight.bookId, (countByBook.get(highlight.bookId) ?? 0) + 1);
    }
    return {
        highlights: parsed.highlights,
        books: parsed.books,
        topics: parsed.topics,
        countByBook,
        byText: new Map(parsed.highlights.map((item) => [item.text.trim(), item])),
        years: [...new Set(parsed.highlights.map((item) => item.year).filter((year): year is number => year !== undefined))].sort(),
    };
}

async function currentText(page: Page): Promise<string> {
    return (await page.getByTestId('stage-passage').innerText()).trim();
}

test.describe('world layer', () => {
    test.skip(!hasSnapshot, 'private local snapshot is not available');

    test('sentence -> source -> book -> topic -> another sentence', async ({ page }) => {
        const { countByBook, byText, books } = loadSnapshot();
        await page.goto('/');

        const startedAs = byText.get(await currentText(page));
        expect(startedAs).toBeDefined();
        if (startedAs === undefined) {
            return;
        }

        // source -> the book behind this sentence
        await page.getByTestId('source-toggle').click();
        await expect(page.getByTestId('source-count')).toHaveText(
            `这里收录了 ${String(countByBook.get(startedAs.bookId) ?? 0)} 处划线`,
        );
        const book = books.find((item) => item.id === startedAs.bookId);
        expect(book).toBeDefined();

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
        const chosen = byText.get(chosenText);
        expect(chosen?.bookId).toBe(startedAs.bookId);

        // topic -> a related passage from another book
        const { topics } = loadSnapshot();
        const topicId = topics[0]?.id;
        expect(topicId).toBeDefined();
        if (topicId === undefined) {
            return;
        }
        await page.getByTestId(`topic-${topicId}`).click();
        const topicPassage = page.getByTestId(`topic-detail-${topicId}`).locator('.passage-button').first();
        await expect(topicPassage).toBeVisible();
        await topicPassage.click();
        const fromTopic = await currentText(page);
        const record = byText.get(fromTopic);
        expect(record).toBeDefined();
        expect(record?.topicIds).toContain(topicId);
        await page.screenshot({ path: join(REVIEW_DIR, 'world-1440.png'), fullPage: true });
    });

    test('shows real per-book and per-topic counts, never a platform total', async ({ page }) => {
        const { countByBook, books, topics, highlights } = loadSnapshot();
        await page.goto('/');

        const list = page.getByTestId('book-list');
        await expect(list).toBeVisible();
        const firstBook = books.find((item) => (countByBook.get(item.id) ?? 0) > 0);
        expect(firstBook).toBeDefined();
        if (firstBook === undefined) {
            return;
        }
        await expect(page.getByTestId(`book-${firstBook.id}`)).toContainText(
            `这里收录了 ${String(countByBook.get(firstBook.id) ?? 0)} 处划线`,
        );

        const topicId = topics[0]?.id ?? '';
        const topicHighlights = highlights.filter((item) => item.topicIds.includes(topicId));
        const topicBooks = new Set(topicHighlights.map((item) => item.bookId)).size;
        await expect(page.getByTestId(`topic-${topicId}`)).toContainText(
            `${String(topicHighlights.length)} 处划线 · ${String(topicBooks)} 本书`,
        );

        await expect(page.getByTestId('about-line')).toContainText(`这里收录了 ${String(highlights.length)} 处划线`);
        await expect(page.getByTestId('about-line')).toContainText(`${String(books.filter((item) => (countByBook.get(item.id) ?? 0) > 0).length)} 本书`);
    });

    test('filters by a real year and can clear an empty intersection', async ({ page }) => {
        const { years, highlights, countByBook } = loadSnapshot();
        expect(years.length).toBeGreaterThan(1);
        const oldest = years[0];
        const newest = years[years.length - 1];
        expect(oldest).toBeDefined();
        expect(newest).toBeDefined();
        if (oldest === undefined || newest === undefined) {
            return;
        }

        await page.goto('/');
        await page.getByTestId(`year-${String(oldest)}`).click();
        await expect(page.getByTestId(`year-${String(oldest)}`)).toHaveAttribute('aria-pressed', 'true');
        await expect(page.getByTestId('year-all')).toHaveAttribute('aria-pressed', 'false');

        // Books that carry no passage from that year must not be listed at all.
        const inYear = new Set(
            highlights.filter((item) => item.year === oldest).map((item) => item.bookId),
        );
        const listed = page.getByTestId('book-list').locator('.book-item');
        await expect(listed).toHaveCount(inYear.size);
        for (const bookId of inYear) {
            await expect(page.getByTestId(`book-${bookId}`)).toBeVisible();
        }

        // A book detail opened under a filter only offers that year's passages, while the book's own
        // count still describes the whole snapshot rather than the current filter.
        const bookId = [...inYear][0];
        if (bookId !== undefined) {
            await page.getByTestId(`book-${bookId}`).click();
            const detail = page.getByTestId(`book-detail-${bookId}`);
            const expected = highlights.filter((item) => item.bookId === bookId && item.year === oldest).length;
            await expect(detail.locator('.passage-button')).toHaveCount(expected);
            await expect(page.getByTestId(`book-${bookId}`)).toContainText(
                `这里收录了 ${String(countByBook.get(bookId) ?? 0)} 处划线`,
            );
        }

        // Topics with nothing in that year explain the gap and offer a way out.
        const emptyTopic = loadSnapshot().topics.find(
            (topic) => !highlights.some((item) => item.topicIds.includes(topic.id) && item.year === oldest),
        );
        if (emptyTopic !== undefined) {
            await page.getByTestId(`topic-${emptyTopic.id}`).click();
            await expect(page.getByTestId(`topic-detail-${emptyTopic.id}`)).toContainText('没有与这个主题相关的划线');
            await page.screenshot({ path: join(REVIEW_DIR, 'year-filter-1440.png'), fullPage: true });
            await page.getByTestId(`topic-detail-${emptyTopic.id}`).getByRole('button', { name: '清除筛选' }).click();
            await expect(page.getByTestId('year-all')).toHaveAttribute('aria-pressed', 'true');
            await expect(page.getByTestId(`topic-${emptyTopic.id}`)).toContainText('处划线');
        }
    });

    test('expands the book list and keeps the navigation links live', async ({ page }) => {
        const { countByBook } = loadSnapshot();
        await page.goto('/');

        const total = [...countByBook.values()].filter((count) => count > 0).length;
        await expect(page.getByTestId('toggle-all-books')).toBeVisible();
        await page.getByTestId('toggle-all-books').click();
        await expect(page.getByTestId('book-list').locator('.book-item')).toHaveCount(total);

        await page.getByRole('navigation', { name: '主要导航' }).getByRole('link', { name: '关于' }).click();
        await expect(page.getByRole('heading', { name: '关于' })).toBeVisible();
        await expect(page.getByTestId('about-line')).toBeVisible();
    });
});
