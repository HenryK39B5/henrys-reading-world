import { countNonWhitespace, hasOriginalLineBreak, lengthBand } from './length.ts';
import type { Book, Highlight, LengthBand, Snapshot, Theme } from './types.ts';

export type SnapshotCoverage = {
    highlightCount: number;
    bookCount: number;
    themeCount: number;
    yearCount: number;
    bands: Record<LengthBand, number>;
    hasOriginalLineBreak: boolean;
};

export type SnapshotIndex = {
    snapshot: Snapshot;
    booksById: Map<string, Book>;
    themesById: Map<string, Theme>;
    highlightsById: Map<string, Highlight>;
    highlightsByBook: Map<string, Highlight[]>;
    /** Passages of every book filed on a shelf, so a theme never needs per-passage labels. */
    highlightsByTheme: Map<string, Highlight[]>;
    /** Books that actually appear on the page, in snapshot order. */
    booksInUse: Book[];
    themesInUse: Theme[];
    years: number[];
    coverage: SnapshotCoverage;
};

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
    const list = map.get(key);
    if (list === undefined) {
        map.set(key, [value]);
        return;
    }
    list.push(value);
}

/** Derived read model. Everything is computed from the snapshot; nothing is duplicated. */
export function indexSnapshot(snapshot: Snapshot): SnapshotIndex {
    const booksById = new Map(snapshot.books.map((book) => [book.id, book]));
    const themesById = new Map(snapshot.themes.map((theme) => [theme.id, theme]));
    const highlightsById = new Map(snapshot.highlights.map((highlight) => [highlight.id, highlight]));
    const highlightsByBook = new Map<string, Highlight[]>();
    const highlightsByTheme = new Map<string, Highlight[]>();
    const bands: Record<LengthBand, number> = { short: 0, medium: 0, long: 0 };
    const years = new Set<number>();
    let hasLineBreak = false;

    for (const highlight of snapshot.highlights) {
        push(highlightsByBook, highlight.bookId, highlight);
        const book = booksById.get(highlight.bookId);
        for (const themeId of book?.themeIds ?? []) {
            push(highlightsByTheme, themeId, highlight);
        }
        bands[lengthBand(highlight.text)] += 1;
        if (highlight.year !== undefined) {
            years.add(highlight.year);
        }
        if (hasOriginalLineBreak(highlight.text)) {
            hasLineBreak = true;
        }
    }

    const booksInUse = snapshot.books.filter((book) => (highlightsByBook.get(book.id)?.length ?? 0) > 0);
    const themesInUse = snapshot.themes.filter((theme) => (highlightsByTheme.get(theme.id)?.length ?? 0) > 0);

    return {
        snapshot,
        booksById,
        themesById,
        highlightsById,
        highlightsByBook,
        highlightsByTheme,
        booksInUse,
        themesInUse,
        years: [...years].sort((a, b) => a - b),
        coverage: {
            highlightCount: snapshot.highlights.length,
            bookCount: booksInUse.length,
            themeCount: themesInUse.length,
            yearCount: years.size,
            bands,
            hasOriginalLineBreak: hasLineBreak,
        },
    };
}

/** True when the snapshot carries real material the page can show. */
export function hasContent(snapshot: Snapshot): boolean {
    return snapshot.highlights.length > 0;
}

/** Real local count wording; never presented as the platform-wide total. */
export function describeCollection(index: SnapshotIndex): string {
    return `这里收录了 ${String(index.coverage.highlightCount)} 处划线，来自 ${String(index.coverage.bookCount)} 本书`;
}

export function describePassageLength(highlight: Highlight): string {
    return `${String(countNonWhitespace(highlight.text))} 字 · ${lengthBand(highlight.text)}`;
}
