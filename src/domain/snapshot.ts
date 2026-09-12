import { countNonWhitespace, hasOriginalLineBreak, lengthBand } from './length.ts';
import type { Book, Highlight, LengthBand, Snapshot, Topic } from './types.ts';

export type SnapshotCoverage = {
    highlightCount: number;
    bookCount: number;
    topicCount: number;
    yearCount: number;
    openingCandidateCount: number;
    surpriseCandidateCount: number;
    bands: Record<LengthBand, number>;
    hasOriginalLineBreak: boolean;
};

export type SnapshotIndex = {
    snapshot: Snapshot;
    booksById: Map<string, Book>;
    topicsById: Map<string, Topic>;
    highlightsById: Map<string, Highlight>;
    highlightsByBook: Map<string, Highlight[]>;
    highlightsByTopic: Map<string, Highlight[]>;
    /** Books that actually appear on the page, in snapshot order. */
    booksInUse: Book[];
    topicsInUse: Topic[];
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
    const topicsById = new Map(snapshot.topics.map((topic) => [topic.id, topic]));
    const highlightsById = new Map(snapshot.highlights.map((highlight) => [highlight.id, highlight]));
    const highlightsByBook = new Map<string, Highlight[]>();
    const highlightsByTopic = new Map<string, Highlight[]>();
    const bands: Record<LengthBand, number> = { short: 0, medium: 0, long: 0 };
    const years = new Set<number>();
    let openingCandidateCount = 0;
    let surpriseCandidateCount = 0;
    let hasLineBreak = false;

    for (const highlight of snapshot.highlights) {
        push(highlightsByBook, highlight.bookId, highlight);
        for (const topicId of highlight.topicIds) {
            push(highlightsByTopic, topicId, highlight);
        }
        bands[lengthBand(highlight.text)] += 1;
        if (highlight.year !== undefined) {
            years.add(highlight.year);
        }
        if (highlight.openingCandidate) {
            openingCandidateCount += 1;
        }
        if (highlight.surpriseCandidate) {
            surpriseCandidateCount += 1;
        }
        if (hasOriginalLineBreak(highlight.text)) {
            hasLineBreak = true;
        }
    }

    const booksInUse = snapshot.books.filter((book) => (highlightsByBook.get(book.id)?.length ?? 0) > 0);
    const topicsInUse = snapshot.topics.filter((topic) => (highlightsByTopic.get(topic.id)?.length ?? 0) > 0);

    return {
        snapshot,
        booksById,
        topicsById,
        highlightsById,
        highlightsByBook,
        highlightsByTopic,
        booksInUse,
        topicsInUse,
        years: [...years].sort((a, b) => a - b),
        coverage: {
            highlightCount: snapshot.highlights.length,
            bookCount: booksInUse.length,
            topicCount: topicsInUse.length,
            yearCount: years.size,
            openingCandidateCount,
            surpriseCandidateCount,
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
    return `这里收录了 ${index.coverage.highlightCount} 处划线，来自 ${index.coverage.bookCount} 本书`;
}

export function describePassageLength(highlight: Highlight): string {
    return `${countNonWhitespace(highlight.text)} 字 · ${lengthBand(highlight.text)}`;
}
