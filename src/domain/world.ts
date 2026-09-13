/**
 * Read model for the world layer: books, theme shelves, years and the about line.
 *
 * All of it is derived from the snapshot; nothing is stored twice and nothing is invented. Ordering
 * is deterministic so the same snapshot always renders the same page.
 *
 * v2 note: a theme shelf owns books, not passages. Theme counts are therefore the counts of the
 * books filed on that shelf, and the UI must say so ("这个书架里的书").
 */
import { describeCollection, type SnapshotIndex } from './snapshot.ts';
import { describeBookCollection } from './timeLabel.ts';
import type { Book, Highlight, Theme } from './types.ts';

export type BookEntry = {
    book: Book;
    highlightCount: number;
    /** Latest highlight year for this book; null when no passage carries a year. */
    latestYear: number | null;
    years: number[];
};

export type ThemeEntry = {
    theme: Theme;
    highlightCount: number;
    bookCount: number;
    years: number[];
    /** One passage per book first, so a shelf preview is not a single-book list. */
    leads: Highlight[];
};

function yearsOf(highlights: Highlight[]): number[] {
    const years = new Set<number>();
    for (const highlight of highlights) {
        if (highlight.year !== undefined) {
            years.add(highlight.year);
        }
    }
    return [...years].sort((left, right) => left - right);
}

function byId(left: Highlight, right: Highlight): number {
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

export function summarizeBooks(index: SnapshotIndex): BookEntry[] {
    return index.booksInUse.map((book) => {
        const highlights = index.highlightsByBook.get(book.id) ?? [];
        const years = yearsOf(highlights);
        return {
            book,
            highlightCount: highlights.length,
            latestYear: years.length === 0 ? null : (years[years.length - 1] ?? null),
            years,
        };
    });
}

/**
 * Recency ordering for the books list. It is based on highlight years only, so the section must be
 * labelled as recently *highlighted*, never as recently finished reading.
 *
 * Books of the same year fall back to stable id order, which is also the order the snapshot assigns.
 * How many passages a book holds is deliberately not a ranking: within one year, a 531-passage book has
 * no more claim to the top of the list than a 2-passage one (docs/11 §6.1).
 */
export function orderByRecentHighlight(entries: BookEntry[]): BookEntry[] {
    return [...entries].sort((left, right) => {
        const leftYear = left.latestYear ?? -1;
        const rightYear = right.latestYear ?? -1;
        if (leftYear !== rightYear) {
            return rightYear - leftYear;
        }
        if (left.book.id === right.book.id) {
            return 0;
        }
        return left.book.id < right.book.id ? -1 : 1;
    });
}

/** Years present in the snapshot, newest first. Only real years are offered. */
export function yearOptions(index: SnapshotIndex): number[] {
    return [...index.years].sort((left, right) => right - left);
}

export function filterBooksByYear(entries: BookEntry[], year: number | null): BookEntry[] {
    if (year === null) {
        return entries;
    }
    return entries.filter((entry) => entry.years.includes(year));
}

/** Books filed on one shelf; a shelf owns books, so this is a book filter (docs/10 §4). */
export function filterBooksByTheme(entries: BookEntry[], themeId: string | null): BookEntry[] {
    if (themeId === null) {
        return entries;
    }
    return entries.filter((entry) => entry.book.themeIds.includes(themeId));
}

export function summarizeThemes(index: SnapshotIndex, year: number | null = null): ThemeEntry[] {
    return index.themesInUse.map((theme) => {
        const all = index.highlightsByTheme.get(theme.id) ?? [];
        const matching = year === null ? all : all.filter((highlight) => highlight.year === year);
        const ordered = [...matching].sort(byId);
        const seenBooks = new Set<string>();
        const leads: Highlight[] = [];
        for (const highlight of ordered) {
            if (seenBooks.has(highlight.bookId)) {
                continue;
            }
            seenBooks.add(highlight.bookId);
            leads.push(highlight);
        }
        for (const highlight of ordered) {
            if (!leads.includes(highlight)) {
                leads.push(highlight);
            }
        }
        return {
            theme,
            highlightCount: matching.length,
            bookCount: new Set(matching.map((highlight) => highlight.bookId)).size,
            years: yearsOf(matching),
            leads,
        };
    });
}

/** Passages of one shelf: one per book first, then the rest, capped by `limit`. */
export function highlightsForTheme(entry: ThemeEntry, limit: number): Highlight[] {
    return entry.leads.slice(0, limit);
}

export function highlightsForBook(index: SnapshotIndex, bookId: string, year: number | null = null): Highlight[] {
    const all = index.highlightsByBook.get(bookId) ?? [];
    const matching = year === null ? all : all.filter((highlight) => highlight.year === year);
    return [...matching].sort(byId);
}

export function themeCountText(entry: ThemeEntry): string {
    return `${String(entry.highlightCount)} 处划线 · ${String(entry.bookCount)} 本书`;
}

export function bookCountText(entry: BookEntry): string {
    return describeBookCollection(entry.highlightCount);
}

export function totalCountText(index: SnapshotIndex): string {
    return describeCollection(index);
}

export function yearSpanText(index: SnapshotIndex): string | null {
    const years = index.years;
    if (years.length === 0) {
        return null;
    }
    const first = years[0];
    const last = years[years.length - 1];
    if (first === undefined || last === undefined) {
        return null;
    }
    return first === last ? `${String(first)} 年` : `${String(first)}–${String(last)} 年`;
}
