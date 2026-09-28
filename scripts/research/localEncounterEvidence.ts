import { compareWithBook, type MapReadingEntry, type MapReadingWindow } from '../../src/domain/mapReading.ts';

export type EncounterMethod = { id: string; cosine: number; distance: number; sharedReviewedTagIds: string[]; bothReviewed: boolean };
export type LocalEncounterComparison = {
    anchorId: string;
    anchorBookId: string;
    otherBookId: string;
    otherBookWindowCount: number;
    windowHighlightCount: number;
    windowBookCount: number;
    anchorHasReviewedTag: boolean;
    actual: EncounterMethod;
    model: EncounterMethod;
    control: EncounterMethod;
};

export function stableUnit(seed: string): number {
    let hash = 2166136261;
    for (let i = 0; i < seed.length; i += 1) {
        hash ^= seed.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) / 2 ** 32;
}

function method(anchor: MapReadingEntry, next: MapReadingEntry, cosine: number): EncounterMethod {
    return {
        id: next.highlight.id,
        cosine,
        distance: Math.hypot(anchor.point.x - next.point.x, anchor.point.y - next.point.y),
        sharedReviewedTagIds: anchor.highlight.tagIds.filter((id) => next.highlight.tagIds.includes(id)),
        bothReviewed: anchor.highlight.tagIds.length > 0 && next.highlight.tagIds.length > 0,
    };
}

/** Same real circle and reader-selected book for every comparator; B's cosine is diagnostic, not a human score. */
export function compareLocalEncounters(
    window: MapReadingWindow,
    anchorId: string,
    bookId: string,
    similarity: (anchorId: string, otherId: string) => number,
    unit: number,
): LocalEncounterComparison | null {
    if (!Number.isFinite(unit) || unit < 0 || unit >= 1) throw new Error('control draw must be in [0, 1)');
    const anchor = window.entries.find((entry) => entry.highlight.id === anchorId);
    const group = window.books.find((entry) => entry.book.id === bookId);
    if (anchor === undefined || group === undefined || anchor.book.id === bookId) return null;
    const actual = compareWithBook(window, anchorId, bookId);
    if (actual === null) throw new Error('baseline point disappeared from same window');
    const scored = group.entries.map((entry) => {
        const score = similarity(anchorId, entry.highlight.id);
        if (!Number.isFinite(score)) throw new Error('non-finite embedding similarity');
        return { entry, score };
    });
    const model = [...scored].sort((a, b) => b.score - a.score || a.entry.highlight.id.localeCompare(b.entry.highlight.id))[0];
    const control = scored[Math.floor(unit * scored.length)];
    const current = scored.find((entry) => entry.entry.highlight.id === actual.highlight.id);
    if (model === undefined || control === undefined || current === undefined) throw new Error('invalid comparison set');
    return {
        anchorId,
        anchorBookId: anchor.book.id,
        otherBookId: bookId,
        otherBookWindowCount: group.entries.length,
        windowHighlightCount: window.entries.length,
        windowBookCount: window.books.length,
        anchorHasReviewedTag: anchor.highlight.tagIds.length > 0,
        actual: method(anchor, actual, current.score),
        model: method(anchor, model.entry, model.score),
        control: method(anchor, control.entry, control.score),
    };
}

export function median(values: readonly number[]): number | null {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = sorted.length >> 1;
    return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}
