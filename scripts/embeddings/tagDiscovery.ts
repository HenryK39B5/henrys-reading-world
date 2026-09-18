import type { Snapshot } from '../../src/domain/types.ts';
import { cosineSimilarity, lengthBand, type CachedEmbedding, type EvaluationCorpusEntry } from './core.ts';

export type TagDiscoveryReason = 'book-centroid' | 'book-semantic-edge' | 'theme-diversity-third';

export type TagDiscoveryEntry = EvaluationCorpusEntry & {
    selectionOrder: number;
    reason: TagDiscoveryReason;
    semanticDistance: number;
};

function meanVector(vectors: number[][]): number[] {
    if (vectors.length === 0) {
        throw new Error('cannot compute a centroid without vectors');
    }
    const dimensions = vectors[0]?.length ?? 0;
    if (dimensions === 0 || vectors.some((vector) => vector.length !== dimensions)) {
        throw new Error('centroid vectors must have one non-zero dimension');
    }
    const centroid = Array.from<number>({ length: dimensions }).fill(0);
    for (const vector of vectors) {
        for (let index = 0; index < dimensions; index += 1) {
            centroid[index] = (centroid[index] ?? 0) + (vector[index] ?? 0);
        }
    }
    return centroid.map((value) => value / vectors.length);
}

function bestByScore<T extends { id: string }>(items: T[], score: (item: T) => number): { item: T; score: number } {
    const ranked = items
        .map((item) => ({ item, score: score(item) }))
        .sort((left, right) => right.score - left.score || left.item.id.localeCompare(right.item.id));
    const first = ranked[0];
    if (first === undefined || !Number.isFinite(first.score)) {
        throw new Error('could not rank tag-discovery candidates');
    }
    return first;
}

export function selectTagDiscoverySample(
    snapshot: Snapshot,
    vectors: Record<string, CachedEmbedding>,
    targetCount = 300,
): TagDiscoveryEntry[] {
    if (!Number.isInteger(targetCount) || targetCount < snapshot.books.length || targetCount > snapshot.books.length * 3) {
        throw new Error(`tag-discovery target must be between ${String(snapshot.books.length)} and ${String(snapshot.books.length * 3)}`);
    }
    const books = new Map(snapshot.books.map((book) => [book.id, book]));
    const highlightsByBook = new Map<string, typeof snapshot.highlights>();
    for (const highlight of [...snapshot.highlights].sort((left, right) => left.id.localeCompare(right.id))) {
        const vector = vectors[highlight.id]?.values;
        if (vector === undefined) {
            throw new Error(`tag discovery is missing vector ${highlight.id}`);
        }
        const items = highlightsByBook.get(highlight.bookId) ?? [];
        items.push(highlight);
        highlightsByBook.set(highlight.bookId, items);
    }

    const selected: TagDiscoveryEntry[] = [];
    const selectedIds = new Set<string>();
    const selectedByBook = new Map<string, TagDiscoveryEntry[]>();
    const push = (
        highlight: (typeof snapshot.highlights)[number],
        reason: TagDiscoveryReason,
        semanticDistance: number,
    ): void => {
        if (selectedIds.has(highlight.id)) {
            return;
        }
        const book = books.get(highlight.bookId);
        if (book === undefined) {
            throw new Error(`tag discovery references unknown book ${highlight.bookId}`);
        }
        const entry: TagDiscoveryEntry = {
            id: highlight.id,
            bookId: highlight.bookId,
            themeIds: [...book.themeIds],
            lengthBand: lengthBand(highlight.text),
            selectionOrder: selected.length + 1,
            reason,
            semanticDistance,
        };
        selected.push(entry);
        selectedIds.add(highlight.id);
        const bookEntries = selectedByBook.get(highlight.bookId) ?? [];
        bookEntries.push(entry);
        selectedByBook.set(highlight.bookId, bookEntries);
    };

    for (const book of [...snapshot.books].sort((left, right) => left.id.localeCompare(right.id))) {
        const highlights = highlightsByBook.get(book.id) ?? [];
        if (highlights.length === 0) {
            throw new Error(`book ${book.id} has no highlights for tag discovery`);
        }
        const centroid = meanVector(highlights.map((highlight) => vectors[highlight.id]?.values ?? []));
        const representative = bestByScore(highlights, (highlight) => cosineSimilarity(centroid, vectors[highlight.id]?.values ?? [])).item;
        push(representative, 'book-centroid', 1 - cosineSimilarity(centroid, vectors[representative.id]?.values ?? []));
        if (highlights.length > 1) {
            const representativeBand = lengthBand(representative.text);
            const edge = bestByScore(
                highlights.filter((highlight) => highlight.id !== representative.id),
                (highlight) =>
                    1 - cosineSimilarity(vectors[representative.id]?.values ?? [], vectors[highlight.id]?.values ?? []) +
                    (lengthBand(highlight.text) === representativeBand ? 0 : 0.04),
            );
            push(edge.item, 'book-semantic-edge', edge.score);
        }
    }

    type ThirdCandidate = { id: string; bookId: string; primaryThemeId: string; score: number; highlight: (typeof snapshot.highlights)[number] };
    const thirds: ThirdCandidate[] = [];
    for (const book of [...snapshot.books].sort((left, right) => left.id.localeCompare(right.id))) {
        const highlights = (highlightsByBook.get(book.id) ?? []).filter((highlight) => !selectedIds.has(highlight.id));
        const current = selectedByBook.get(book.id) ?? [];
        if (highlights.length === 0 || current.length < 2) {
            continue;
        }
        const selectedVectors = current.map((entry) => vectors[entry.id]?.values ?? []);
        const usedBands = new Set(current.map((entry) => entry.lengthBand));
        const candidate = bestByScore(highlights, (highlight) => {
            const vector = vectors[highlight.id]?.values ?? [];
            const minimumDistance = Math.min(...selectedVectors.map((selectedVector) => 1 - cosineSimilarity(vector, selectedVector)));
            return minimumDistance + (usedBands.has(lengthBand(highlight.text)) ? 0 : 0.04);
        });
        thirds.push({
            id: candidate.item.id,
            bookId: book.id,
            primaryThemeId: book.themeIds[0] ?? 'theme-unfiled',
            score: candidate.score,
            highlight: candidate.item,
        });
    }

    const byTheme = new Map<string, ThirdCandidate[]>();
    for (const candidate of thirds) {
        const items = byTheme.get(candidate.primaryThemeId) ?? [];
        items.push(candidate);
        byTheme.set(candidate.primaryThemeId, items);
    }
    for (const items of byTheme.values()) {
        items.sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
    }
    const themeIds = [...byTheme.keys()].sort();
    while (selected.length < targetCount) {
        let added = false;
        for (const themeId of themeIds) {
            const candidate = byTheme.get(themeId)?.shift();
            if (candidate === undefined) {
                continue;
            }
            push(candidate.highlight, 'theme-diversity-third', candidate.score);
            added = true;
            if (selected.length === targetCount) {
                break;
            }
        }
        if (!added) {
            throw new Error(`could not fill ${String(targetCount)} tag-discovery entries under the three-per-book cap`);
        }
    }
    return selected;
}
