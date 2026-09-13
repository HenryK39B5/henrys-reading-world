import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The real snapshot, read from disk for browser checks.
 *
 * Which passage is on screen is the fair engine's business, so specs assert against the snapshot rather
 * than against a fixed order. When the private file is absent every browser check skips instead of
 * quietly passing on fake content.
 */
export type Highlight = { id: string; text: string; bookId: string; year?: number };
export type Book = { id: string; title: string; author: string; themeIds: string[]; coverPath?: string };
export type Theme = { id: string; title: string };

export type RealData = {
    highlights: Highlight[];
    books: Book[];
    themes: Theme[];
    bookById: Map<string, Book>;
    countByBook: Map<string, number>;
    /** Keyed by the trimmed text, so a rendered passage can be looked up. */
    byText: Map<string, Highlight>;
    firstOfBook: Map<string, Highlight>;
    biggestBookId: string | null;
    /** The first book that has both a cover in the snapshot and a passage to open. */
    coveredBookId: string | null;
    shortest: Highlight;
    longest: Highlight;
    medium: Highlight;
};

const SNAPSHOT_PATH = join(process.cwd(), '.private/local-snapshot.json');

export const hasSnapshot = existsSync(SNAPSHOT_PATH);

export function nonWhitespace(text: string): number {
    return [...text].filter((char) => !/\s/u.test(char)).length;
}

export function loadSnapshot(): RealData {
    const parsed = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as {
        highlights: Highlight[];
        books: Book[];
        themes: Theme[];
    };

    const countByBook = new Map<string, number>();
    const firstOfBook = new Map<string, Highlight>();
    for (const highlight of parsed.highlights) {
        countByBook.set(highlight.bookId, (countByBook.get(highlight.bookId) ?? 0) + 1);
        if (!firstOfBook.has(highlight.bookId)) {
            firstOfBook.set(highlight.bookId, highlight);
        }
    }

    const byLength = [...parsed.highlights].sort((left, right) => nonWhitespace(left.text) - nonWhitespace(right.text));
    const shortest = byLength[0];
    const longest = byLength[byLength.length - 1];
    const medium = parsed.highlights.find((item) => {
        const length = nonWhitespace(item.text);
        return length >= 41 && length <= 120;
    });
    if (shortest === undefined || longest === undefined || medium === undefined) {
        throw new Error('the snapshot does not cover the lengths this check needs');
    }

    let biggestBookId: string | null = null;
    let biggest = 0;
    for (const [bookId, count] of countByBook) {
        if (count > biggest) {
            biggest = count;
            biggestBookId = bookId;
        }
    }

    const covered = parsed.books.find((book) => book.coverPath !== undefined && countByBook.has(book.id));

    return {
        highlights: parsed.highlights,
        books: parsed.books,
        themes: parsed.themes,
        bookById: new Map(parsed.books.map((book) => [book.id, book])),
        countByBook,
        byText: new Map(parsed.highlights.map((item) => [item.text.trim(), item])),
        firstOfBook,
        biggestBookId,
        coveredBookId: covered?.id ?? null,
        shortest,
        longest,
        medium,
    };
}
