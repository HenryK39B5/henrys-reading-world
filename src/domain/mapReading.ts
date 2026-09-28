import type { SnapshotIndex } from './snapshot.ts';
import type { Book, Highlight, MapPoint } from './types.ts';
import { mapToScreen, type MapViewport } from './map.ts';

/** A screen-space reading window, not a semantic cluster or a topic boundary. */
export const MAP_READING_ZOOM = 3.5;
export const MAP_READING_RADIUS = 0.39;

export type MapReadingEntry = {
    point: MapPoint;
    highlight: Highlight;
    book: Book;
};

export type MapReadingBook = {
    book: Book;
    /** Points from this book inside the current window, nearest the viewport centre first. */
    entries: [MapReadingEntry, ...MapReadingEntry[]];
};

export type MapReadingWindow = {
    entries: MapReadingEntry[];
    books: MapReadingBook[];
};

/** Books other than the current passage's book, in the window's existing centre-first order. */
export function otherBooksInWindow(window: MapReadingWindow, anchor: MapReadingEntry): MapReadingBook[] {
    return window.books.filter((group) => group.book.id !== anchor.book.id);
}

/**
 * Choose the point from a deliberately selected *other book* nearest the anchor on the existing
 * two-dimensional map. This is navigation geometry only; it cannot judge whether the texts relate.
 */
export function compareWithBook(window: MapReadingWindow, anchorId: string, bookId: string): MapReadingEntry | null {
    const anchor = window.entries.find((entry) => entry.highlight.id === anchorId);
    if (anchor === undefined || anchor.book.id === bookId) return null;
    const group = window.books.find((candidate) => candidate.book.id === bookId);
    if (group === undefined) return null;
    return [...group.entries].sort((left, right) => {
        const distance = (entry: MapReadingEntry): number =>
            (entry.point.x - anchor.point.x) ** 2 + (entry.point.y - anchor.point.y) ** 2;
        return distance(left) - distance(right) || left.highlight.id.localeCompare(right.highlight.id);
    })[0] ?? null;
}

/** A reviewed classification overlap, not textual similarity, agreement, or a negative for missing tags. */
export function sharedReviewedTags(anchor: MapReadingEntry, other: MapReadingEntry): string[] {
    return anchor.highlight.tagIds.filter((tagId) => other.highlight.tagIds.includes(tagId));
}

/**
 * The circle drawn over the map is exactly the set queried here. Each entry is a real approved point,
 * regardless of whether it has reviewed Topic Tags. Distance orders a *local index*, not similarity.
 */
export function mapReadingWindow(
    index: SnapshotIndex,
    view: MapViewport,
    width: number,
    height: number,
): MapReadingWindow {
    if (index.snapshot.map === undefined || width <= 1 || height <= 1) return { entries: [], books: [] };
    const radiusSquared = (Math.min(width, height) * MAP_READING_RADIUS) ** 2;
    const entries: Array<{ entry: MapReadingEntry; distanceSquared: number }> = [];
    for (const point of index.snapshot.map.points) {
        const highlight = index.highlightsById.get(point.highlightId);
        if (highlight === undefined) continue;
        const book = index.booksById.get(highlight.bookId);
        if (book === undefined) continue;
        const screen = mapToScreen(point, view, width, height);
        const distanceSquared = (screen.x - width / 2) ** 2 + (screen.y - height / 2) ** 2;
        if (distanceSquared <= radiusSquared) entries.push({ entry: { point, highlight, book }, distanceSquared });
    }
    entries.sort((a, b) => a.distanceSquared - b.distanceSquared || a.entry.highlight.id.localeCompare(b.entry.highlight.id));
    const books = new Map<string, MapReadingBook>();
    for (const { entry } of entries) {
        let group = books.get(entry.book.id);
        if (group === undefined) {
            group = { book: entry.book, entries: [entry] };
            books.set(entry.book.id, group);
        } else {
            group.entries.push(entry);
        }
    }
    return { entries: entries.map(({ entry }) => entry), books: [...books.values()] };
}
