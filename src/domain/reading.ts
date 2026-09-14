/**
 * Reading-level rules for the rooms (docs/10 §7, docs/12 §2).
 *
 * The library is reachable, not rendered: 所有书 shows a bounded first batch and the visitor asks for
 * more. These numbers are product decisions, kept here as pure functions so the batching can be tested
 * without a browser.
 *
 * A book room no longer batches anything (docs/17 §3): it walks its own passages one at a time in rounds,
 * which lives in `bookWalk.ts`.
 */
import type { SnapshotIndex } from './snapshot.ts';
import type { Highlight } from './types.ts';

/** 所有书: a first screen of 12 books, then 20 more per request. */
export const INITIAL_BOOK_BATCH = 12;
export const BOOK_BATCH_STEP = 20;

function clamp(value: number, total: number): number {
    if (value < 0) {
        return 0;
    }
    return value > total ? total : value;
}

/** How many items are actually shown for a remembered request; never more than exist. */
export function visibleCount(loaded: number, total: number): number {
    return clamp(loaded, total);
}

/** The next remembered request after "show more". */
export function expandCount(loaded: number, total: number, step: number): number {
    return clamp(loaded + step, total);
}

export function hasMore(loaded: number, total: number): boolean {
    return visibleCount(loaded, total) < total;
}

export function batchLabel(shown: number, total: number): string {
    return `显示 ${String(shown)} / ${String(total)}`;
}

/**
 * Every passage of one book, in stable id order.
 *
 * Ordering, not filtering: a book room's walk visits these one at a time in rounds (docs/17 §3).
 */
export function passagesOfBook(index: SnapshotIndex, bookId: string): Highlight[] {
    const all = index.highlightsByBook.get(bookId) ?? [];
    return [...all].sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
}

/**
 * Every passage the rooms can reach. A passage is reachable when its book can be opened from 所有书 and
 * that book's round can show it, so an empty result is the proof of "全量可达" (docs/10 §7, docs/17 §3.4).
 */
export function unreachableHighlights(index: SnapshotIndex): Highlight[] {
    const reachableBooks = new Set(index.booksInUse.map((book) => book.id));
    return index.snapshot.highlights.filter((highlight) => !reachableBooks.has(highlight.bookId));
}

/** How many passages of a shelf belong to one year, for honest shelf counts. */
export function countThemeYear(index: SnapshotIndex, themeId: string, year: number): number {
    return (index.highlightsByTheme.get(themeId) ?? []).filter((highlight) => highlight.year === year).length;
}
