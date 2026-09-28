import type { SnapshotIndex } from './snapshot.ts';
import type { Book, Highlight, MapPoint } from './types.ts';
import { mapToScreen, type MapViewport } from './map.ts';

/** A screen-space reading window, not a semantic cluster or a topic boundary. */
export const MAP_READING_ZOOM = 2.25;
export const MAP_READING_RADIUS = 0.39;

export type MapReadingEntry = {
    point: MapPoint;
    highlight: Highlight;
    book: Book;
};

export type MapReadingBook = {
    book: Book;
    /** Points from this book inside the current window, nearest the viewport centre first. */
    entries: MapReadingEntry[];
};

export type MapReadingWindow = {
    entries: MapReadingEntry[];
    books: MapReadingBook[];
};

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
            group = { book: entry.book, entries: [] };
            books.set(entry.book.id, group);
        }
        group.entries.push(entry);
    }
    return { entries: entries.map(({ entry }) => entry), books: [...books.values()] };
}
